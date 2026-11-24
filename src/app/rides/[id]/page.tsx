"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  IndianRupee,
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
}

interface SessionUser {
  id: string;
  fullName: string;
  role: "STUDENT" | "ADMIN";
  gender: "MALE" | "FEMALE" | "OTHER";
}

export default function RideDetailPage() {
  const params = useParams<{ id: string }>();
  const rideId = params.id;

  const [me, setMe] = useState<SessionUser | null>(null);
  const [ride, setRide] = useState<RideDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Seat Request state
  const [pickup, setPickup] = useState<SelectedLocation | null>(null);
  const [requesting, setRequesting] = useState(false);

  // Simulated Live Tracking state
  const [simProgress, setSimProgress] = useState(0.12);
  const [simRunning, setSimRunning] = useState(true);

  // Chat state (4-second polling)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatTargetId, setChatTargetId] = useState<string>("");
  const [sendingChat, setSendingChat] = useState(false);

  // Review state
  const [reviewTargetId, setReviewTargetId] = useState<string>("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Report state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTargetId, setReportTargetId] = useState("");
  const [reportReason, setReportReason] = useState("Unsafe driving or behavior");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  // SOS state
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

  const canParticipateInChat = Boolean(
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

  // Simulated live GPS ticker when ride is IN_PROGRESS
  useEffect(() => {
    if (!ride || ride.status !== "IN_PROGRESS" || !simRunning) {
      return;
    }
    const timer = setInterval(() => {
      setSimProgress((prev) => (prev >= 0.98 ? 0.05 : Number((prev + 0.03).toFixed(3))));
    }, 1500);
    return () => clearInterval(timer);
  }, [ride, simRunning]);

  const liveCoords = useMemo<LatLng | null>(() => {
    if (!ride || ride.status !== "IN_PROGRESS" || polyline.length < 2) {
      return null;
    }
    return interpolateAlongPolyline(polyline, simProgress);
  }, [ride, polyline, simProgress]);

  // 4-second chat polling
  useEffect(() => {
    if (!canParticipateInChat) return;
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
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [canParticipateInChat, rideId]);

  const activeRiders = useMemo(
    () =>
      ride?.requests.filter(
        (r) => r.status === "PENDING" || r.status === "ACCEPTED"
      ) ?? [],
    [ride]
  );

  const effectiveChatTargetId =
    chatTargetId ||
    (isDriver ? activeRiders[0]?.passengerId ?? "" : ride?.driverId ?? "");

  const acceptedCoRiders = useMemo(() => {
    if (!ride || !me) return [];
    const list: Array<{ id: string; fullName: string }> = [];
    if (ride.driverId !== me.id) {
      list.push({ id: ride.driverId, fullName: `${ride.driver.fullName} (Driver)` });
    }
    for (const r of ride.requests) {
      if (r.status === "ACCEPTED" && r.passengerId !== me.id) {
        list.push({ id: r.passengerId, fullName: `${r.passenger.fullName} (Passenger)` });
      }
    }
    return list;
  }, [ride, me]);

  const effectiveReviewTargetId =
    reviewTargetId || acceptedCoRiders[0]?.id || "";

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
    setActionNotice(`Ride status updated to ${nextStatus}.`);
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
      setActionNotice("Seat request sent to driver!");
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
    if (!chatInput.trim() || !effectiveChatTargetId) return;
    setSendingChat(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId,
          receiverId: effectiveChatTargetId,
          body: chatInput.trim(),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { message: ChatMessage };
        setMessages((prev) => [...prev, data.message]);
        setChatInput("");
      }
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
          note: "Emergency SOS triggered from active ride screen (Demo Simulation).",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionNotice(data.error ?? "SOS trigger failed");
        return;
      }
      setActionNotice(
        "Demo SOS alert logged! Ride participants and campus admins have been notified."
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
      setActionNotice("Thank you! Your review has updated the user's rating.");
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
        setActionNotice("Safety report submitted to Campus Admin queue.");
      }
    } finally {
      setSubmittingReport(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500">
        Loading ride details...
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-sm text-rose-500">{error ?? "Ride not found."}</p>
        <Link
          href="/find"
          className="inline-block text-xs font-semibold text-emerald-600 underline"
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
    <div className="space-y-6">
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
              className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-500"
            >
              Mark Resolved
            </button>
          </div>
          <p className="text-xs text-rose-800 dark:text-rose-200">
            Coordinates logged: ({sos.lat.toFixed(4)}, {sos.lng.toFixed(4)}) at{" "}
            {new Date(sos.createdAt).toLocaleTimeString("en-IN")} · {sos.note}
          </p>
          {sos.user.emergencyContactPhone && (
            <p className="text-xs font-semibold text-rose-900 dark:text-rose-100">
              Emergency Contact: {sos.user.emergencyContactName ?? "Guardian"} —{" "}
              {sos.user.emergencyContactPhone}
            </p>
          )}
        </div>
      ))}

      {actionNotice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          <span>{actionNotice}</span>
          <button type="button" onClick={() => setActionNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-900 dark:bg-zinc-100 px-3 py-0.5 text-xs font-bold text-white dark:text-zinc-950">
                {ride.status}
              </span>
              {ride.womenOnly && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                  <Shield className="h-3.5 w-3.5" />
                  Women-Only
                </span>
              )}
              <span className="text-xs text-zinc-500 flex items-center gap-1">
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

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {ride.originLabel.split(",")[0]} → {ride.destLabel.split(",")[0]}
            </h1>

            <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <Route className="h-3.5 w-3.5 text-emerald-500" />
                {ride.distanceKm} km · {ride.estimatedDurationMin} min
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-emerald-500" />
                {ride.seatsAvailable} of {ride.seatsTotal} seats left
              </span>
              <span className="inline-flex items-center gap-1">
                <Car className="h-3.5 w-3.5 text-emerald-500" />
                {ride.driver.vehicleModel ?? ride.driver.vehicleType}{" "}
                {ride.driver.vehiclePlate ? `(${ride.driver.vehiclePlate})` : ""}
              </span>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-2xl font-extrabold">
              {formatInr(ride.costPerSeatInr)}
              <span className="text-xs font-normal text-zinc-500"> / seat</span>
            </p>
            <p className="text-xs text-zinc-500">
              Est. total fuel: {formatInr(fuelEstimate.totalFuelCostInr)}
            </p>
          </div>
        </div>

        {ride.notes && (
          <p className="rounded-xl bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
            <strong>Driver Note:</strong> {ride.notes}
          </p>
        )}

        {/* Driver Lifecycle Controls */}
        {isDriver && ride.status !== "COMPLETED" && ride.status !== "CANCELLED" && (
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mr-2">
              Trip Controls:
            </span>
            {ride.status === "OPEN" && (
              <button
                type="button"
                onClick={() => void handleStatusTransition("CONFIRMED")}
                className="rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-500"
              >
                Confirm Ride
              </button>
            )}
            {(ride.status === "OPEN" || ride.status === "CONFIRMED") && (
              <button
                type="button"
                onClick={() => void handleStatusTransition("IN_PROGRESS")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                <Play className="h-3.5 w-3.5" />
                Start Ride (Live GPS Sim)
              </button>
            )}
            {ride.status === "IN_PROGRESS" && (
              <button
                type="button"
                onClick={() => void handleStatusTransition("COMPLETED")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 dark:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white dark:text-zinc-950"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete Ride
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleStatusTransition("CANCELLED")}
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
            >
              Cancel Ride
            </button>
          </div>
        )}
      </div>

      {/* Map + Live GPS Simulation + SOS */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          {/* Simulated Live Tracking Telemetry */}
          {ride.status === "IN_PROGRESS" && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <Navigation className="h-4 w-4 animate-pulse" />
                  Live GPS Tracking
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300">
                    Demo Simulation
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span>ETA: {etaRemainingMin} min</span>
                  <span>24 km/h</span>
                  <button
                    type="button"
                    onClick={() => setSimRunning((r) => !r)}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-[11px]"
                  >
                    {simRunning ? "Pause" : "Resume"}
                  </button>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${Math.round(simProgress * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span>{Math.round(simProgress * 100)}% along OSRM route</span>
                {liveCoords && (
                  <span className="font-mono">
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
                ? (coords) =>
                    setPickup({
                      label: `Custom pickup (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
                      lat: coords.lat,
                      lng: coords.lng,
                    })
                : undefined
            }
            heightClassName="h-80 sm:h-96"
          />

          {/* Safety & SOS Strip */}
          {canParticipateInChat && ride.status !== "CANCELLED" && (
            <div className="rounded-2xl border border-rose-500/30 bg-white dark:bg-zinc-900 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" />
                  Emergency Safety & SOS
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                    Demo Simulation
                  </span>
                </p>
                <p className="text-xs text-zinc-500">
                  Logs current simulated GPS coordinates to the DB and notifies
                  co-riders &amp; campus admins immediately.
                </p>
              </div>
              <button
                type="button"
                disabled={triggeringSos}
                onClick={() => void handleTriggerSos()}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50 shrink-0"
              >
                {triggeringSos ? "Logging SOS..." : "Trigger SOS Alert"}
              </button>
            </div>
          )}

          {/* In-App Chat (4-second polling) */}
          {canParticipateInChat && (
            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-500" />
                  Ride Chat (Live 4s Sync)
                </h2>
                {isDriver && activeRiders.length > 0 && (
                  <select
                    value={effectiveChatTargetId}
                    onChange={(e) => setChatTargetId(e.target.value)}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 text-xs"
                  >
                    {activeRiders.map((r) => (
                      <option key={r.passengerId} value={r.passengerId}>
                        To: {r.passenger.fullName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="h-60 overflow-y-auto space-y-2 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-zinc-400 py-16">
                    No messages yet. Coordinate pickup gate or arrival time here.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === me?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isMine ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs ${
                            isMine
                              ? "bg-zinc-900 text-white dark:bg-emerald-500 dark:text-zinc-950"
                              : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                          }`}
                        >
                          <p className="text-[10px] opacity-70 font-semibold mb-0.5">
                            {msg.sender.fullName}
                          </p>
                          <p>{msg.body}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    effectiveChatTargetId
                      ? "Message your co-rider..."
                      : "Waiting for a passenger request before chatting..."
                  }
                  disabled={!effectiveChatTargetId}
                  className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2 text-sm outline-none focus:border-emerald-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={sendingChat || !effectiveChatTargetId || !chatInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-emerald-500 dark:text-zinc-950 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </button>
              </form>
            </section>
          )}
        </div>

        {/* Right Column: Driver Card, Seat Booking / Requests, Fuel Split, Reviews & Report */}
        <div className="lg:col-span-5 space-y-5">
          {/* Driver Card */}
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Driver
                </p>
                <p className="font-bold text-base flex items-center gap-1.5">
                  {ride.driver.fullName}
                  {ride.driver.idVerificationStatus === "APPROVED" && (
                    <BadgeCheck className="h-4 w-4 text-emerald-500" />
                  )}
                </p>
                <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {ride.driver.totalRatings > 0
                    ? `${ride.driver.avgRating.toFixed(1)} (${ride.driver.totalRatings} reviews)`
                    : "New campus driver"}
                </p>
              </div>
              {me && !isDriver && (
                <button
                  type="button"
                  onClick={() => {
                    setReportTargetId(ride.driverId);
                    setReportOpen((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-500 hover:text-rose-600"
                >
                  <Flag className="h-3 w-3" />
                  Report
                </button>
              )}
            </div>

            {ride.driver.phone ? (
              <p className="text-xs flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                <Phone className="h-3.5 w-3.5 text-emerald-500" />
                {ride.driver.phone}
              </p>
            ) : (
              <p className="text-xs text-zinc-400">
                Phone hidden by driver privacy setting (use in-app chat).
              </p>
            )}
          </section>

          {/* Report Form Drawer */}
          {reportOpen && me && (
            <form
              onSubmit={handleSubmitReport}
              className="rounded-2xl border border-rose-500/40 bg-rose-500/5 p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-rose-700 dark:text-rose-300">
                  Flag User or Ride for Admin Review
                </h3>
                <button type="button" onClick={() => setReportOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs"
              >
                <option value="Unsafe driving or behavior">Unsafe driving or behavior</option>
                <option value="No-show or late cancellation">No-show or late cancellation</option>
                <option value="Fare overcharging / off-app demand">Fare overcharging / off-app demand</option>
                <option value="Suspicious identity or profile">Suspicious identity or profile</option>
              </select>
              <textarea
                rows={2}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Describe what happened..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={submittingReport}
                className="w-full rounded-xl bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-500"
              >
                {submittingReport ? "Submitting..." : "Submit Report to Admin"}
              </button>
            </form>
          )}

          {/* Passenger Seat Request Form */}
          {!isDriver && !myRequest && (ride.status === "OPEN" || ride.status === "CONFIRMED") && (
            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-500" />
                Request a Seat
              </h2>
              {!me ? (
                <p className="text-xs text-zinc-500">
                  <Link
                    href={`/login?next=/rides/${ride.id}`}
                    className="font-semibold text-emerald-600 underline"
                  >
                    Sign in with your college email
                  </Link>{" "}
                  to request a seat on this ride.
                </p>
              ) : ride.seatsAvailable < 1 ? (
                <p className="text-xs text-amber-600 font-medium">
                  This ride is currently full.
                </p>
              ) : (
                <form onSubmit={handleRequestSeat} className="space-y-3">
                  <LocationAutocomplete
                    label="Your Pickup Point (or click the map)"
                    value={pickup}
                    onChange={setPickup}
                    showQuickPicks={false}
                  />
                  <button
                    type="submit"
                    disabled={requesting || !pickup}
                    className="w-full rounded-xl bg-zinc-950 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {requesting
                      ? "Sending Request..."
                      : `Request Seat · ${formatInr(ride.costPerSeatInr)}`}
                  </button>
                </form>
              )}
            </section>
          )}

          {/* Cost & Payment Summary + Requests Management */}
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-emerald-500" />
                Seats &amp; Fuel Split Summary
              </h2>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                Payment: Demo Simulation
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 p-3 text-xs border border-zinc-100 dark:border-zinc-800">
              <div>
                <p className="text-zinc-500">Total Fuel Est.</p>
                <p className="font-bold text-sm">
                  {formatInr(fuelEstimate.totalFuelCostInr)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Per-Seat Share</p>
                <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  {formatInr(ride.costPerSeatInr)}
                </p>
              </div>
            </div>

            {ride.requests.length === 0 ? (
              <p className="text-xs text-zinc-500">No seat requests yet.</p>
            ) : (
              <div className="space-y-3">
                {ride.requests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold flex items-center gap-1">
                          {req.passenger.fullName}
                          {req.passenger.idVerificationStatus === "APPROVED" && (
                            <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                        </p>
                        <p className="text-[11px] text-zinc-500 line-clamp-1">
                          Pickup: {req.pickupLabel}
                        </p>
                      </div>
                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                        {req.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isDriver && req.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleRequestAction(req.id, "ACCEPT")}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Accept Seat
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRequestAction(req.id, "REJECT")}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </>
                      )}

                      {me?.id === req.passengerId &&
                        (req.status === "PENDING" || req.status === "ACCEPTED") &&
                        ride.status !== "COMPLETED" && (
                          <button
                            type="button"
                            onClick={() => void handleRequestAction(req.id, "CANCEL")}
                            className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400"
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
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                              req.paymentStatus === "SIMULATED_PAID"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : "border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
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

          {/* Post-Ride Ratings & Reviews */}
          {ride.status === "COMPLETED" && acceptedCoRiders.length > 0 && (
            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                Rate Your Co-Riders
              </h2>
              <form onSubmit={handleSubmitReview} className="space-y-3">
                <select
                  value={effectiveReviewTargetId}
                  onChange={(e) => setReviewTargetId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs"
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
                      className="p-1"
                      aria-label={`Rate ${star} stars`}
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= reviewRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-zinc-300 dark:text-zinc-700"
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
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs"
                />

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full rounded-xl bg-zinc-950 py-2 text-xs font-semibold text-white dark:bg-emerald-500 dark:text-zinc-950"
                >
                  {submittingReview ? "Submitting..." : "Submit Rating"}
                </button>
              </form>

              {ride.reviews.length > 0 && (
                <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                  {ride.reviews.map((rev) => (
                    <div key={rev.id} className="text-xs space-y-0.5">
                      <p className="font-semibold">
                        {rev.author.fullName} → {rev.target.fullName} ·{" "}
                        {"★".repeat(rev.rating)}
                      </p>
                      {rev.comment && (
                        <p className="text-zinc-500">{rev.comment}</p>
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
