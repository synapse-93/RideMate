"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  Fuel,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Play,
  Route,
  Send,
  Shield,
  ShieldAlert,
  Star,
  Users,
  X,
} from "lucide-react";
import { RideMap } from "@/components/map/RideMap";
import {
  LocationAutocomplete,
  type SelectedLocation,
} from "@/components/map/LocationAutocomplete";
import { ConfettiBurst } from "@/components/ui/ConfettiBurst";
import { estimateFuelSplit, formatInr, type CostVehicleType } from "@/lib/cost";
import {
  interpolateAlongPolyline,
  parsePolyline,
  type LatLng,
} from "@/lib/geo";

interface RideUser {
  id: string;
  fullName: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  idVerificationStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  vehicleType?: CostVehicleType;
  vehicleModel?: string | null;
  vehiclePlate?: string | null;
  avgRating: number;
  totalRatings: number;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

interface RideRequestItem {
  id: string;
  passengerId: string;
  pickupLabel: string;
  pickupLat: number;
  pickupLng: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  paymentStatus: "UNPAID" | "SIMULATED_PAID";
  passenger: RideUser;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  author: { id: string; fullName: string };
  target: { id: string; fullName: string };
  createdAt: string;
}

interface SosItem {
  id: string;
  lat: number;
  lng: number;
  note: string | null;
  resolved: boolean;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
  };
}

interface RideDetail {
  id: string;
  driverId: string;
  originLabel: string;
  originLat: number;
  originLng: number;
  destLabel: string;
  destLat: number;
  destLng: number;
  routePolyline: string;
  distanceKm: number;
  estimatedDurationMin: number;
  departureTime: string;
  seatsTotal: number;
  seatsAvailable: number;
  costPerSeatInr: number;
  womenOnly: boolean;
  status: "OPEN" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  notes: string | null;
  driver: RideUser;
  requests: RideRequestItem[];
  reviews: ReviewItem[];
  sosEvents: SosItem[];
}

interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  receiverId: string;
  sender: { id: string; fullName: string };
  receiver: { id: string; fullName: string };
  optimistic?: boolean;
}

interface SessionUser {
  id: string;
  fullName: string;
  role: "STUDENT" | "ADMIN";
  gender: "MALE" | "FEMALE" | "OTHER";
}

function shortPlace(label: string): string {
  return label.split(",")[0]?.trim() || label;
}

function formatFallbackPin(coords: LatLng): string {
  const latDir = coords.lat >= 0 ? "N" : "S";
  const lngDir = coords.lng >= 0 ? "E" : "W";
  return `Custom Pin (${Math.abs(coords.lat).toFixed(2)}°${latDir}, ${Math.abs(
    coords.lng
  ).toFixed(2)}°${lngDir})`;
}

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 45) return "just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function RideDetailPage() {
  const params = useParams<{ id: string }>();
  const rideId = params.id;

  const [me, setMe] = useState<SessionUser | null>(null);
  const [ride, setRide] = useState<RideDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [pickup, setPickup] = useState<SelectedLocation | null>(null);
  const [requesting, setRequesting] = useState(false);

  const [simProgress, setSimProgress] = useState(0.12);
  const [simRunning, setSimRunning] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatTargetId, setChatTargetId] = useState<string>("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [sendingChat, setSendingChat] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [reviewTargetId, setReviewTargetId] = useState<string>("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTargetId, setReportTargetId] = useState("");
  const [reportReason, setReportReason] = useState("Unsafe driving or behavior");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const [triggeringSos, setTriggeringSos] = useState(false);

  const reloadRide = useCallback(async () => {
    const res = await fetch(`/api/rides/${rideId}`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { ride: RideDetail };
      setRide(data.ride);
    }
  }, [rideId]);

  useEffect(() => {
    let cancelled = false;
    async function init(): Promise<void> {
      try {
        const [meRes, rideRes] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch(`/api/rides/${rideId}`, { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (meRes.ok) {
          const meData = (await meRes.json()) as { user: SessionUser | null };
          setMe(meData.user);
        }
        if (!rideRes.ok) {
          const errData = (await rideRes.json()) as { error?: string };
          setError(errData.error ?? "Unable to load ride.");
          return;
        }
        const rideData = (await rideRes.json()) as { ride: RideDetail };
        setRide(rideData.ride);
        setPickup({
          label: rideData.ride.originLabel,
          lat: rideData.ride.originLat,
          lng: rideData.ride.originLng,
        });
      } catch {
        if (!cancelled) setError("Network error while loading ride.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  const isDriver = Boolean(me && ride && me.id === ride.driverId);
  const myRequest = useMemo(
    () => ride?.requests.find((r) => r.passengerId === me?.id) ?? null,
    [ride, me]
  );

  const isSosParticipant = Boolean(
    me &&
      ride &&
      (isDriver ||
        me.role === "ADMIN" ||
        (myRequest &&
          (myRequest.status === "PENDING" || myRequest.status === "ACCEPTED")))
  );

  const polyline = useMemo<LatLng[]>(() => {
    if (!ride) return [];
    const parsed = parsePolyline(ride.routePolyline);
    if (parsed.length >= 2) return parsed;
    return [
      { lat: ride.originLat, lng: ride.originLng },
      { lat: ride.destLat, lng: ride.destLng },
    ];
  }, [ride]);

  useEffect(() => {
    if (!ride || ride.status !== "IN_PROGRESS" || !simRunning) {
      return;
    }
    const timer = setInterval(() => {
      setSimProgress((prev) =>
        prev >= 0.98 ? 0.05 : Number((prev + 0.03).toFixed(3))
      );
    }, 1500);
    return () => clearInterval(timer);
  }, [ride, simRunning]);

  const liveCoords = useMemo<LatLng | null>(() => {
    if (!ride || ride.status !== "IN_PROGRESS" || polyline.length < 2) {
      return null;
    }
    return interpolateAlongPolyline(polyline, simProgress);
  }, [ride, polyline, simProgress]);

  // 3-second chat polling for ANY logged-in user viewing an accessible ride (pre-booking & post-booking)
  useEffect(() => {
    if (!me || !ride) return;
    let cancelled = false;
    async function pollMessages(): Promise<void> {
      try {
        const res = await fetch(`/api/messages?rideId=${rideId}`, {
          cache: "no-store",
        });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { messages: ChatMessage[] };
          setMessages(data.messages ?? []);
        }
      } catch {
        // Ignore transient poll errors
      }
    }
    void pollMessages();
    const interval = setInterval(() => {
      void pollMessages();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [me, ride, rideId]);

  // Auto-scroll inside chat box when message count grows
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Build driver's reply threads from BOTH inbound message senders AND booking requests
  const driverThreads = useMemo(() => {
    if (!ride || !isDriver) return [];
    const map = new Map<string, { id: string; fullName: string }>();

    // Prefer most recent inbound chat senders first
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.senderId !== ride.driverId && !map.has(m.senderId)) {
        map.set(m.senderId, { id: m.senderId, fullName: m.sender.fullName });
      }
      if (m.receiverId !== ride.driverId && !map.has(m.receiverId)) {
        map.set(m.receiverId, { id: m.receiverId, fullName: m.receiver.fullName });
      }
    }
    // Also include active booking requesters
    for (const r of ride.requests) {
      if (
        (r.status === "PENDING" || r.status === "ACCEPTED") &&
        !map.has(r.passengerId)
      ) {
        map.set(r.passengerId, {
          id: r.passengerId,
          fullName: r.passenger.fullName,
        });
      }
    }
    return Array.from(map.values());
  }, [ride, isDriver, messages]);

  const effectiveChatTargetId = isDriver
    ? chatTargetId && driverThreads.some((t) => t.id === chatTargetId)
      ? chatTargetId
      : driverThreads[0]?.id ?? ""
    : ride?.driverId ?? "";

  const visibleMessages = useMemo(() => {
    if (!isDriver || !effectiveChatTargetId) return messages;
    return messages.filter(
      (m) =>
        m.senderId === effectiveChatTargetId ||
        m.receiverId === effectiveChatTargetId
    );
  }, [isDriver, effectiveChatTargetId, messages]);

  const acceptedCoRiders = useMemo(() => {
    if (!ride || !me) return [];
    const list: Array<{ id: string; fullName: string }> = [];
    if (ride.driverId !== me.id) {
      list.push({
        id: ride.driverId,
        fullName: `${ride.driver.fullName} (Driver)`,
      });
    }
    for (const r of ride.requests) {
      if (r.status === "ACCEPTED" && r.passengerId !== me.id) {
        list.push({
          id: r.passengerId,
          fullName: `${r.passenger.fullName} (Rider)`,
        });
      }
    }
    return list;
  }, [ride, me]);

  const effectiveReviewTargetId =
    reviewTargetId || acceptedCoRiders[0]?.id || "";

  async function handlePickupMapClick(coords: LatLng): Promise<void> {
    const fallbackLabel = formatFallbackPin(coords);
    setPickup({ label: fallbackLabel, lat: coords.lat, lng: coords.lng });
    try {
      const res = await fetch(
        `/api/geocode?lat=${encodeURIComponent(
          String(coords.lat)
        )}&lng=${encodeURIComponent(String(coords.lng))}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = (await res.json()) as { label?: string };
        if (typeof data.label === "string" && data.label.trim()) {
          setPickup({
            label: data.label.trim(),
            lat: coords.lat,
            lng: coords.lng,
          });
        }
      }
    } catch {
      // Keep clean fallback
    }
  }

  async function handleStatusTransition(
    nextStatus: RideDetail["status"]
  ): Promise<void> {
    setActionNotice(null);
    const res = await fetch(`/api/rides/${rideId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setActionNotice(data.error ?? "Status update failed");
      return;
    }
    setActionNotice(`Trip updated to ${nextStatus.replace("_", " ")}.`);
    await reloadRide();
  }

  async function handleRequestSeat(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!pickup) return;
    setRequesting(true);
    setActionNotice(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId,
          pickupLabel: pickup.label,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionNotice(data.error ?? "Could not request seat.");
        return;
      }
      setActionNotice("Seat request sent to the driver!");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1200);
      await reloadRide();
    } finally {
      setRequesting(false);
    }
  }

  async function handleRequestAction(
    requestId: string,
    action: "ACCEPT" | "REJECT" | "CANCEL" | "TOGGLE_PAYMENT"
  ): Promise<void> {
    setActionNotice(null);
    const res = await fetch(`/api/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setActionNotice(data.error ?? "Action failed");
      return;
    }
    await reloadRide();
  }

  async function handleSendChat(e: FormEvent): Promise<void> {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || !me || !ride || !effectiveChatTargetId) return;

    setChatError(null);
    setSendingChat(true);

    const optimisticId = `optimistic-${Date.now()}`;
    const receiverName = isDriver
      ? driverThreads.find((t) => t.id === effectiveChatTargetId)?.fullName ??
        "Student"
      : ride.driver.fullName;

    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      body: trimmed,
      createdAt: new Date().toISOString(),
      senderId: me.id,
      receiverId: effectiveChatTargetId,
      sender: { id: me.id, fullName: me.fullName },
      receiver: { id: effectiveChatTargetId, fullName: receiverName },
      optimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setChatInput("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId,
          receiverId: effectiveChatTargetId,
          body: trimmed,
        }),
      });
      const data = (await res.json()) as {
        message?: ChatMessage;
        error?: string;
      };
      if (!res.ok || !data.message) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setChatInput(trimmed);
        setChatError(data.error ?? "Could not send message.");
        return;
      }
      const saved = data.message;
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? saved : m))
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setChatInput(trimmed);
      setChatError("Network error — try again.");
    } finally {
      setSendingChat(false);
    }
  }

  async function handleTriggerSos(): Promise<void> {
    if (!ride) return;
    setTriggeringSos(true);
    setActionNotice(null);
    const coords = liveCoords ?? { lat: ride.originLat, lng: ride.originLng };
    try {
      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId,
          lat: coords.lat,
          lng: coords.lng,
          note: "Emergency SOS triggered during active trip (Demo Simulation).",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionNotice(data.error ?? "SOS trigger failed");
        return;
      }
      setActionNotice(
        "SOS alert logged (Demo Simulation). Co-riders and campus admins have been notified."
      );
      await reloadRide();
    } finally {
      setTriggeringSos(false);
    }
  }

  async function handleResolveSos(sosId: string): Promise<void> {
    await fetch("/api/sos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sosId }),
    });
    await reloadRide();
  }

  async function handleSubmitReview(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!effectiveReviewTargetId) return;
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId,
          targetId: effectiveReviewTargetId,
          rating: reviewRating,
          comment: reviewComment.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionNotice(data.error ?? "Review failed");
        return;
      }
      setReviewComment("");
      setActionNotice("Thanks! Your rating has been saved.");
      await reloadRide();
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleSubmitReport(e: FormEvent): Promise<void> {
    e.preventDefault();
    const targetId = reportTargetId || ride?.driverId;
    if (!targetId) return;
    setSubmittingReport(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportedUserId: targetId,
          rideId,
          reason: reportReason,
          details: reportDetails.trim() || undefined,
        }),
      });
      if (res.ok) {
        setReportOpen(false);
        setReportDetails("");
        setActionNotice("Safety report sent to Campus Admin.");
      }
    } finally {
      setSubmittingReport(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-muted)]">
        Loading ride pass…
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-sm text-rose-500">{error ?? "Ride not found."}</p>
        <Link
          href="/find"
          className="inline-block text-xs font-bold text-[var(--accent-signal)] hover:underline"
        >
          Back to Find Ride
        </Link>
      </div>
    );
  }

  const fuelEstimate = estimateFuelSplit(
    ride.distanceKm,
    ride.driver.vehicleType ?? "CAR",
    ride.seatsTotal
  );
  const etaRemainingMin = Math.max(
    1,
    Math.round(ride.estimatedDurationMin * (1 - simProgress))
  );
  const activeSosEvents = ride.sosEvents.filter((s) => !s.resolved);

  return (
    <div className="space-y-6 card-enter">
      <ConfettiBurst active={showConfetti} />

      {/* Active SOS Alert Banner (Demo Simulation) */}
      {activeSosEvents.map((sos) => (
        <div
          key={sos.id}
          className="rounded-2xl border-2 border-rose-600 bg-rose-600/10 p-4 sm:p-5 space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-sm">
              <AlertTriangle className="h-5 w-5" />
              ACTIVE SOS ALERT — {sos.user.fullName}
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300">
                Demo Simulation
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleResolveSos(sos.id)}
              className="btn-press rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500"
            >
              Mark Resolved
            </button>
          </div>
          <p className="text-xs text-rose-800 dark:text-rose-200 font-mono">
            Location: ({sos.lat.toFixed(4)}, {sos.lng.toFixed(4)}) ·{" "}
            {new Date(sos.createdAt).toLocaleTimeString("en-IN")}
          </p>
          {sos.user.emergencyContactPhone && (
            <p className="text-xs font-bold text-rose-900 dark:text-rose-100">
              Emergency Contact: {sos.user.emergencyContactName ?? "Guardian"} —{" "}
              <span className="font-mono">{sos.user.emergencyContactPhone}</span>
            </p>
          )}
        </div>
      ))}

      {actionNotice && (
        <div className="flex items-center justify-between rounded-2xl border border-[var(--verified-green)]/30 bg-[var(--verified-green)]/10 px-4 py-3 text-sm font-medium text-[var(--verified-green)]">
          <span>{actionNotice}</span>
          <button type="button" onClick={() => setActionNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Boarding-Pass Header */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--text-ink)] px-3 py-0.5 text-[11px] font-bold uppercase text-[var(--bg-surface)]">
                {ride.status.replace("_", " ")}
              </span>
              {ride.womenOnly && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-2.5 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-300">
                  <Shield className="h-3.5 w-3.5" />
                  Women-Only
                </span>
              )}
              <span className="font-mono text-xs text-[var(--text-muted)] flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {new Date(ride.departureTime).toLocaleString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold tracking-[-0.03em]">
              {shortPlace(ride.originLabel)} → {shortPlace(ride.destLabel)}
            </h1>

            <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1 font-mono font-medium">
                <Route className="h-3.5 w-3.5 text-[var(--accent-signal)]" />
                {ride.distanceKm} km · {ride.estimatedDurationMin} min
              </span>
              <span className="inline-flex items-center gap-1 font-mono">
                <Users className="h-3.5 w-3.5 text-[var(--accent-signal)]" />
                {ride.seatsAvailable}/{ride.seatsTotal} seats left
              </span>
              <span className="inline-flex items-center gap-1">
                <Car className="h-3.5 w-3.5 text-[var(--accent-signal)]" />
                {ride.driver.vehicleModel ?? ride.driver.vehicleType}{" "}
                {ride.driver.vehiclePlate ? (
                  <span className="font-mono">({ride.driver.vehiclePlate})</span>
                ) : (
                  ""
                )}
              </span>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="font-mono text-2xl font-extrabold text-[var(--text-ink)]">
              {formatInr(ride.costPerSeatInr)}
              <span className="font-sans text-xs font-normal text-[var(--text-muted)]">
                {" "}
                / seat
              </span>
            </p>
            <p className="font-mono text-xs text-[var(--text-muted)]">
              Trip fuel est. {formatInr(fuelEstimate.totalFuelCostInr)}
            </p>
          </div>
        </div>

        {ride.notes && (
          <p className="rounded-xl bg-[var(--bg-subtle)]/70 px-3.5 py-2.5 text-xs text-[var(--text-ink)] border border-[var(--border-subtle)]">
            <strong className="text-[var(--text-muted)]">Driver note:</strong>{" "}
            {ride.notes}
          </p>
        )}

        {/* Driver Trip Controls */}
        {isDriver && ride.status !== "COMPLETED" && ride.status !== "CANCELLED" && (
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--border-subtle)] pt-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1">
              Trip Controls:
            </span>
            {ride.status === "OPEN" && (
              <button
                type="button"
                onClick={() => void handleStatusTransition("CONFIRMED")}
                className="btn-press rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-2 text-xs font-bold hover:border-[var(--accent-signal)]"
              >
                Confirm Ride
              </button>
            )}
            {(ride.status === "OPEN" || ride.status === "CONFIRMED") && (
              <button
                type="button"
                onClick={() => void handleStatusTransition("IN_PROGRESS")}
                className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-signal)] px-3.5 py-2 text-xs font-bold text-white hover:bg-[var(--accent-signal-hover)]"
              >
                <Play className="h-3.5 w-3.5" />
                Start Ride
              </button>
            )}
            {ride.status === "IN_PROGRESS" && (
              <button
                type="button"
                onClick={() => void handleStatusTransition("COMPLETED")}
                className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[var(--verified-green)] px-3.5 py-2 text-xs font-bold text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete Ride
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleStatusTransition("CANCELLED")}
              className="btn-press rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-300"
            >
              Cancel Ride
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Map + Always-Accessible Chat | Right Sidebar */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          {ride.status === "IN_PROGRESS" && (
            <div className="rounded-2xl border border-[var(--accent-signal)]/35 bg-[var(--accent-signal)]/[0.06] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-signal)]">
                  <Navigation className="h-4 w-4 animate-pulse" />
                  Live Tracking
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300">
                    Demo Simulation
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs font-bold">
                  <span>ETA {etaRemainingMin} min</span>
                  <span className="text-[var(--text-muted)]">24 km/h</span>
                  <button
                    type="button"
                    onClick={() => setSimRunning((r) => !r)}
                    className="btn-press font-sans rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-0.5 text-[11px]"
                  >
                    {simRunning ? "Pause" : "Resume"}
                  </button>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-signal)] transition-all duration-700"
                  style={{ width: `${Math.round(simProgress * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between font-mono text-[11px] text-[var(--text-muted)]">
                <span>{Math.round(simProgress * 100)}% along direct route</span>
                {liveCoords && (
                  <span>
                    {liveCoords.lat.toFixed(4)}, {liveCoords.lng.toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          )}

          <RideMap
            origin={{
              lat: ride.originLat,
              lng: ride.originLng,
              label: ride.originLabel,
            }}
            dest={{
              lat: ride.destLat,
              lng: ride.destLng,
              label: ride.destLabel,
            }}
            pickup={
              !isDriver && !myRequest && pickup
                ? { lat: pickup.lat, lng: pickup.lng, label: pickup.label }
                : myRequest
                ? {
                    lat: myRequest.pickupLat,
                    lng: myRequest.pickupLng,
                    label: myRequest.pickupLabel,
                  }
                : null
            }
            livePosition={
              liveCoords
                ? {
                    lat: liveCoords.lat,
                    lng: liveCoords.lng,
                    label: `ETA ${etaRemainingMin} min`,
                  }
                : null
            }
            polyline={polyline}
            onMapClick={
              !isDriver && !myRequest
                ? (coords) => {
                    void handlePickupMapClick(coords);
                  }
                : undefined
            }
            heightClassName="h-80 sm:h-96"
          />

          {/* Safety & SOS Strip */}
          {isSosParticipant && ride.status !== "CANCELLED" && (
            <div className="rounded-2xl border border-rose-500/30 bg-[var(--bg-surface)] p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" />
                  Emergency SOS
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                    Demo Simulation
                  </span>
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Logs your live coordinates and alerts co-riders &amp; campus
                  admins instantly.
                </p>
              </div>
              <button
                type="button"
                disabled={triggeringSos}
                onClick={() => void handleTriggerSos()}
                className="btn-press rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50 shrink-0"
              >
                {triggeringSos ? "Sending SOS…" : "Trigger SOS Alert"}
              </button>
            </div>
          )}

          {/* Always-Accessible Ride Chat (Pre-Booking Questions + Driver Replies + 3s Polling) */}
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[var(--accent-signal)]" />
                <h2 className="font-bold text-sm">Ride Chat</h2>
                {me && (
                  <span className="rounded-full bg-[var(--verified-green)]/12 px-2 py-0.5 text-[10px] font-bold text-[var(--verified-green)]">
                    Live
                  </span>
                )}
              </div>

              {isDriver && driverThreads.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {driverThreads.map((thread) => {
                    const active = effectiveChatTargetId === thread.id;
                    return (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => setChatTargetId(thread.id)}
                        className={`btn-press rounded-full px-3 py-1 text-[11px] font-bold border ${
                          active
                            ? "border-[var(--accent-signal)] bg-[var(--accent-signal)] text-white"
                            : "border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-ink)]"
                        }`}
                      >
                        {thread.fullName.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {!me ? (
              <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-6 text-center space-y-2">
                <p className="text-xs text-[var(--text-muted)]">
                  Want to ask {ride.driver.fullName.split(" ")[0]} about pickup
                  timing or luggage space?
                </p>
                <Link
                  href={`/login?next=/rides/${ride.id}`}
                  className="btn-press inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-signal)] px-4 py-2 text-xs font-bold text-white"
                >
                  Sign in to message driver
                </Link>
              </div>
            ) : (
              <>
                <div
                  ref={chatScrollRef}
                  className="h-64 overflow-y-auto space-y-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/45 p-3.5"
                >
                  {visibleMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center px-4">
                      <p className="text-xs text-[var(--text-muted)] max-w-xs">
                        {isDriver
                          ? "No messages yet. Students can message you here before or after booking."
                          : `Ask ${ride.driver.fullName.split(" ")[0]} a quick question about pickup stop or timing before or after booking.`}
                      </p>
                    </div>
                  ) : (
                    visibleMessages.map((msg) => {
                      const isMine = msg.senderId === me.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isMine ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs shadow-2xs ${
                              isMine
                                ? "rounded-br-sm bg-[var(--accent-signal)] text-white"
                                : "rounded-bl-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink)]"
                            } ${msg.optimistic ? "opacity-75" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-3 mb-0.5">
                              <span className="text-[10px] font-bold opacity-80">
                                {isMine ? "You" : msg.sender.fullName}
                              </span>
                              <span className="font-mono text-[10px] opacity-70">
                                {formatRelativeTime(msg.createdAt)}
                              </span>
                            </div>
                            <p className="leading-relaxed break-words">
                              {msg.body}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {chatError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {chatError}
                  </p>
                )}

                <form onSubmit={handleSendChat} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={
                      effectiveChatTargetId
                        ? isDriver
                          ? "Reply to student…"
                          : `Message ${ride.driver.fullName.split(" ")[0]}…`
                        : "Waiting for a student message or booking…"
                    }
                    disabled={!effectiveChatTargetId}
                    className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)] disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={
                      sendingChat || !effectiveChatTargetId || !chatInput.trim()
                    }
                    className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-signal)] px-4 py-2.5 text-xs font-bold text-white hover:bg-[var(--accent-signal-hover)] disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </button>
                </form>
              </>
            )}
          </section>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-5 space-y-5">
          {/* Driver Card */}
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Driver
                </p>
                <p className="font-extrabold text-base flex items-center gap-1.5">
                  {ride.driver.fullName}
                  {ride.driver.idVerificationStatus === "APPROVED" && (
                    <BadgeCheck className="h-4 w-4 text-[var(--verified-green)]" />
                  )}
                </p>
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-mono">
                    {ride.driver.totalRatings > 0
                      ? `${ride.driver.avgRating.toFixed(1)} (${ride.driver.totalRatings} reviews)`
                      : "New campus driver"}
                  </span>
                </p>
              </div>
              {me && !isDriver && (
                <button
                  type="button"
                  onClick={() => {
                    setReportTargetId(ride.driverId);
                    setReportOpen((v) => !v);
                  }}
                  className="btn-press inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-rose-600"
                >
                  <Flag className="h-3 w-3" />
                  Report
                </button>
              )}
            </div>

            {ride.driver.phone ? (
              <p className="font-mono text-xs flex items-center gap-1.5 text-[var(--text-ink)]">
                <Phone className="h-3.5 w-3.5 text-[var(--verified-green)]" />
                {ride.driver.phone}
              </p>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                Phone private — coordinate via Ride Chat.
              </p>
            )}
          </section>

          {/* Report Form */}
          {reportOpen && me && (
            <form
              onSubmit={handleSubmitReport}
              className="card-enter rounded-2xl border border-rose-500/35 bg-rose-500/[0.06] p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-rose-700 dark:text-rose-300">
                  Flag for Campus Admin Review
                </h3>
                <button type="button" onClick={() => setReportOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
              >
                <option value="Unsafe driving or behavior">
                  Unsafe driving or behavior
                </option>
                <option value="No-show or late cancellation">
                  No-show or late cancellation
                </option>
                <option value="Fare overcharging / off-app demand">
                  Fare overcharging / off-app demand
                </option>
                <option value="Suspicious identity or profile">
                  Suspicious identity or profile
                </option>
              </select>
              <textarea
                rows={2}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Share brief details…"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={submittingReport}
                className="btn-press w-full rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-500"
              >
                {submittingReport ? "Submitting…" : "Submit Report"}
              </button>
            </form>
          )}

          {/* Seat Request Card */}
          {!isDriver &&
            !myRequest &&
            (ride.status === "OPEN" || ride.status === "CONFIRMED") && (
              <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[var(--accent-signal)]" />
                  Book a Seat
                </h2>
                {!me ? (
                  <p className="text-xs text-[var(--text-muted)]">
                    <Link
                      href={`/login?next=/rides/${ride.id}`}
                      className="font-bold text-[var(--accent-signal)] hover:underline"
                    >
                      Sign in with your college email
                    </Link>{" "}
                    to request a seat on this ride.
                  </p>
                ) : ride.seatsAvailable < 1 ? (
                  <p className="text-xs text-amber-600 font-semibold">
                    All seats on this ride are filled.
                  </p>
                ) : (
                  <form onSubmit={handleRequestSeat} className="space-y-3">
                    <LocationAutocomplete
                      label="Your Pickup Point (or tap map)"
                      value={pickup}
                      onChange={setPickup}
                      compact
                      dotColor="green"
                    />
                    <button
                      type="submit"
                      disabled={requesting || !pickup}
                      className="btn-press w-full rounded-xl bg-[var(--accent-signal)] py-3 text-sm font-bold text-white hover:bg-[var(--accent-signal-hover)] disabled:opacity-50"
                    >
                      {requesting
                        ? "Sending Request…"
                        : `Request Seat · ${formatInr(ride.costPerSeatInr)}`}
                    </button>
                  </form>
                )}
              </section>
            )}

          {/* Seats & Fair Fuel Split Summary */}
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Fuel className="h-4 w-4 text-[var(--accent-signal)]" />
                Seats &amp; Fair Fuel Split
              </h2>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                Payment: Demo Simulation
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--bg-subtle)]/70 p-3 text-xs border border-[var(--border-subtle)]">
              <div>
                <p className="text-[var(--text-muted)]">Trip Fuel Est.</p>
                <p className="font-mono font-bold text-sm">
                  {formatInr(fuelEstimate.totalFuelCostInr)}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-muted)]">Per-Seat Share</p>
                <p className="font-mono font-bold text-sm text-[var(--accent-signal)]">
                  {formatInr(ride.costPerSeatInr)}
                </p>
              </div>
            </div>

            {ride.requests.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No seat requests yet.
              </p>
            ) : (
              <div className="space-y-3">
                {ride.requests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold flex items-center gap-1">
                          {req.passenger.fullName}
                          {req.passenger.idVerificationStatus === "APPROVED" && (
                            <BadgeCheck className="h-3.5 w-3.5 text-[var(--verified-green)]" />
                          )}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          Pickup: {shortPlace(req.pickupLabel)}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase">
                        {req.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isDriver && req.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              void handleRequestAction(req.id, "ACCEPT")
                            }
                            className="btn-press inline-flex items-center gap-1 rounded-lg bg-[var(--verified-green)] px-3 py-1.5 text-xs font-bold text-white"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Accept Seat
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleRequestAction(req.id, "REJECT")
                            }
                            className="btn-press inline-flex items-center gap-1 rounded-lg border border-rose-500/35 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-300"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </>
                      )}

                      {me?.id === req.passengerId &&
                        (req.status === "PENDING" ||
                          req.status === "ACCEPTED") &&
                        ride.status !== "COMPLETED" && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleRequestAction(req.id, "CANCEL")
                            }
                            className="btn-press rounded-lg border border-rose-500/35 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-300"
                          >
                            Cancel Seat
                          </button>
                        )}

                      {req.status === "ACCEPTED" &&
                        (isDriver || me?.id === req.passengerId) && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleRequestAction(req.id, "TOGGLE_PAYMENT")
                            }
                            className={`btn-press rounded-lg px-3 py-1.5 text-xs font-bold ${
                              req.paymentStatus === "SIMULATED_PAID"
                                ? "bg-[var(--verified-green)]/12 text-[var(--verified-green)]"
                                : "border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-signal)]"
                            }`}
                          >
                            {req.paymentStatus === "SIMULATED_PAID"
                              ? "✓ Paid (Demo)"
                              : "Mark Paid (Demo)"}
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Post-Ride Ratings */}
          {ride.status === "COMPLETED" && acceptedCoRiders.length > 0 && (
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                Rate Your Co-Riders
              </h2>
              <form onSubmit={handleSubmitReview} className="space-y-3">
                <select
                  value={effectiveReviewTargetId}
                  onChange={(e) => setReviewTargetId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-medium"
                >
                  {acceptedCoRiders.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="btn-press p-1"
                      aria-label={`Rate ${star} stars`}
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= reviewRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-[var(--border-subtle)]"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Punctual, smooth ride, great co-commuter!"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3 py-2 text-xs outline-none focus:border-[var(--accent-signal)]"
                />

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="btn-press w-full rounded-xl bg-[var(--accent-signal)] py-2.5 text-xs font-bold text-white hover:bg-[var(--accent-signal-hover)]"
                >
                  {submittingReview ? "Saving…" : "Submit Rating"}
                </button>
              </form>

              {ride.reviews.length > 0 && (
                <div className="space-y-2 border-t border-dashed border-[var(--border-subtle)] pt-3">
                  {ride.reviews.map((rev) => (
                    <div key={rev.id} className="text-xs space-y-0.5">
                      <p className="font-bold">
                        {rev.author.fullName} → {rev.target.fullName} ·{" "}
                        <span className="text-amber-500">
                          {"★".repeat(rev.rating)}
                        </span>
                      </p>
                      {rev.comment && (
                        <p className="text-[var(--text-muted)]">{rev.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
