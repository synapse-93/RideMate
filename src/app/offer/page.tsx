"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  Clock,
  Fuel,
  Loader2,
  PlusCircle,
  Route,
  Shield,
} from "lucide-react";
import { RideMap } from "@/components/map/RideMap";
import {
  LocationAutocomplete,
  type SelectedLocation,
} from "@/components/map/LocationAutocomplete";
import { ConfettiBurst } from "@/components/ui/ConfettiBurst";
import { estimateFuelSplit, formatInr, type CostVehicleType } from "@/lib/cost";
import type { LatLng } from "@/lib/geo";

interface MeUser {
  id: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  vehicleType: CostVehicleType;
  vehicleModel: string | null;
}

function defaultDepartureLocalValue(): string {
  const d = new Date(Date.now() + 90 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function vehicleDisplayLabel(type: CostVehicleType | undefined): string {
  if (type === "TWO_WHEELER") return "Two-wheeler";
  if (type === "CAR") return "Car";
  return "";
}

function formatFallbackPin(coords: LatLng): string {
  const latDir = coords.lat >= 0 ? "N" : "S";
  const lngDir = coords.lng >= 0 ? "E" : "W";
  return `Custom Pin (${Math.abs(coords.lat).toFixed(2)}°${latDir}, ${Math.abs(
    coords.lng
  ).toFixed(2)}°${lngDir})`;
}

export default function OfferRidePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);
  const [pickMode, setPickMode] = useState<"ORIGIN" | "DEST">("ORIGIN");
  const [swappedCount, setSwappedCount] = useState(0);

  const [origin, setOrigin] = useState<SelectedLocation | null>(null);
  const [dest, setDest] = useState<SelectedLocation | null>(null);
  const [polyline, setPolyline] = useState<LatLng[]>([]);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [estimatedDurationMin, setEstimatedDurationMin] = useState<number>(0);
  const [routing, setRouting] = useState(false);

  const [departureLocal, setDepartureLocal] = useState(defaultDepartureLocalValue);
  const [seatsTotal, setSeatsTotal] = useState(3);
  const [costPerSeatInr, setCostPerSeatInr] = useState(35);
  const [womenOnly, setWomenOnly] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMe(): Promise<void> {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!cancelled && res.ok) {
        const data = (await res.json()) as { user: MeUser | null };
        if (data.user) {
          setMe(data.user);
          if (data.user.vehicleType === "TWO_WHEELER") {
            setSeatsTotal(1);
          }
        }
      }
    }
    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!origin || !dest) {
      return;
    }

    let cancelled = false;
    async function fetchRoute(): Promise<void> {
      if (!origin || !dest) return;
      setRouting(true);
      try {
        const res = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: { lat: origin.lat, lng: origin.lng },
            dest: { lat: dest.lat, lng: dest.lng },
          }),
        });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as {
            polyline: LatLng[];
            distanceKm: number;
            estimatedDurationMin: number;
          };
          setPolyline(data.polyline);
          setDistanceKm(data.distanceKm);
          setEstimatedDurationMin(data.estimatedDurationMin);

          const vehicle: CostVehicleType = me?.vehicleType ?? "CAR";
          const est = estimateFuelSplit(data.distanceKm, vehicle, seatsTotal);
          setCostPerSeatInr(est.perSeatCostInr);
        }
      } finally {
        if (!cancelled) setRouting(false);
      }
    }
    void fetchRoute();
    return () => {
      cancelled = true;
    };
  }, [origin, dest, me?.vehicleType, seatsTotal]);

  const hasBothEndpoints = Boolean(origin && dest);
  const activePolyline = hasBothEndpoints ? polyline : [];
  const activeDistanceKm = hasBothEndpoints ? distanceKm : 0;
  const activeDurationMin = hasBothEndpoints ? estimatedDurationMin : 0;
  const routeReady = hasBothEndpoints && activeDistanceKm > 0;

  const fuelEstimate = estimateFuelSplit(
    activeDistanceKm,
    me?.vehicleType ?? "CAR",
    seatsTotal
  );

  function handleSwap(): void {
    const prev = origin;
    setOrigin(dest);
    setDest(prev);
    setSwappedCount((c) => c + 1);
  }

  async function resolveAndSetPin(
    target: "ORIGIN" | "DEST",
    coords: LatLng
  ): Promise<void> {
    const fallbackLabel = formatFallbackPin(coords);
    const optimistic: SelectedLocation = {
      label: fallbackLabel,
      lat: coords.lat,
      lng: coords.lng,
    };

    if (target === "ORIGIN") {
      setOrigin(optimistic);
      setPickMode("DEST");
    } else {
      setDest(optimistic);
    }

    try {
      const res = await fetch(
        `/api/geocode?lat=${encodeURIComponent(
          String(coords.lat)
        )}&lng=${encodeURIComponent(String(coords.lng))}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = (await res.json()) as { label?: string };
        if (typeof data.label === "string" && data.label.trim().length > 0) {
          const resolved: SelectedLocation = {
            label: data.label.trim(),
            lat: coords.lat,
            lng: coords.lng,
          };
          if (target === "ORIGIN") {
            setOrigin((cur) =>
              cur && cur.lat === coords.lat && cur.lng === coords.lng
                ? resolved
                : cur
            );
          } else {
            setDest((cur) =>
              cur && cur.lat === coords.lat && cur.lng === coords.lng
                ? resolved
                : cur
            );
          }
        }
      }
    } catch {
      // Keep clean Custom Pin fallback
    }
  }

  function handleMapClick(coords: LatLng): void {
    void resolveAndSetPin(pickMode, coords);
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!origin || !dest || activePolyline.length < 2) {
      setError("Pick both your start and drop-off points to plot the route.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originLabel: origin.label,
          originLat: origin.lat,
          originLng: origin.lng,
          destLabel: dest.label,
          destLat: dest.lat,
          destLng: dest.lng,
          polyline: activePolyline,
          distanceKm: activeDistanceKm,
          estimatedDurationMin: activeDurationMin,
          departureTime: new Date(departureLocal).toISOString(),
          seatsTotal,
          costPerSeatInr,
          womenOnly: me?.gender === "FEMALE" ? womenOnly : false,
          notes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ride?: { id: string }; error?: string };
      if (!res.ok || !data.ride) {
        setError(data.error ?? "Failed to publish ride.");
        return;
      }
      setShowConfetti(true);
      const rideId = data.ride.id;
      setTimeout(() => {
        setShowConfetti(false);
        router.push(`/rides/${rideId}`);
      }, 650);
    } catch {
      setError("Network error while publishing ride.");
    } finally {
      setSubmitting(false);
    }
  }

  const canEnableWomenOnly = me?.gender === "FEMALE";
  const vehicleTag = vehicleDisplayLabel(me?.vehicleType);

  return (
    <div className="space-y-5">
      <ConfettiBurst active={showConfetti} />

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em]">
          Offer a Ride
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Set your route, pick open seats, and share fuel costs fairly.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Compact Transit Offer Card */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-xs"
        >
          {/* Connected Start / Drop-off Input Group with Integrated Right-Edge Swap */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Route Stops
            </span>
            <div className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/45 p-2.5 pr-12 space-y-2">
              <LocationAutocomplete
                placeholder="Start location…"
                value={origin}
                onChange={setOrigin}
                compact
                dotColor="orange"
              />
              <LocationAutocomplete
                placeholder="Drop-off campus or stop…"
                value={dest}
                onChange={setDest}
                compact
                dotColor="ink"
              />

              {/* Integrated Right-Edge Swap Button */}
              <button
                type="button"
                onClick={handleSwap}
                aria-label="Swap start and drop-off"
                title="Swap stops"
                className="btn-press absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-ink)] shadow-xs hover:border-[var(--accent-signal)] hover:text-[var(--accent-signal)]"
              >
                <ArrowUpDown
                  className="h-3.5 w-3.5 transition-transform duration-300 ease-out"
                  style={{ transform: `rotate(${swappedCount * 180}deg)` }}
                />
              </button>
            </div>
          </div>

          {/* Departure Time + Spring-Animated Seat Stepper Pills */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Departure
              </label>
              <input
                type="datetime-local"
                required
                value={departureLocal}
                onChange={(e) => setDepartureLocal(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs font-mono font-medium outline-none focus:border-[var(--accent-signal)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Empty Seats
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((count) => {
                  const selected = seatsTotal === count;
                  return (
                    <button
                      key={selected ? `${count}-active` : count}
                      type="button"
                      onClick={() => setSeatsTotal(count)}
                      className={`btn-press rounded-xl py-2 font-mono text-sm font-bold border ${
                        selected
                          ? "pop-spring border-[var(--accent-signal)] bg-[var(--accent-signal)] text-white shadow-xs"
                          : "border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-ink)] hover:border-[var(--accent-signal)]/50"
                      }`}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Fair Fuel Split Box */}
          {!routeReady ? (
            <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-4 py-3.5 flex items-center gap-2.5 text-xs text-[var(--text-muted)]">
              {routing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-signal)] shrink-0" />
                  <span>Calculating direct route and fair fuel split…</span>
                </>
              ) : (
                <>
                  <Fuel className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  <span>Pick start &amp; drop-off to calculate fair fuel split</span>
                </>
              )}
            </div>
          ) : (
            <div className="card-enter rounded-xl border border-[var(--accent-signal)]/30 bg-[var(--accent-signal)]/[0.06] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--text-ink)] flex items-center gap-1.5">
                  <Fuel className="h-3.5 w-3.5 text-[var(--accent-signal)]" />
                  Fair fuel split{vehicleTag ? ` · ${vehicleTag}` : ""}
                </span>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  Trip est. {formatInr(fuelEstimate.totalFuelCostInr)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Your ask per seat
                </label>
                <div className="relative flex items-center">
                  <span className="pointer-events-none absolute left-3 font-mono text-sm font-bold text-[var(--text-muted)]">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    value={costPerSeatInr}
                    onChange={(e) => setCostPerSeatInr(Number(e.target.value))}
                    className="w-28 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-7 pr-3 py-1.5 font-mono text-sm font-bold outline-none focus:border-[var(--accent-signal)]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Women-Only Toggle — Strictly shown ONLY to Female drivers */}
          {canEnableWomenOnly && (
            <label className="flex items-center justify-between rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3 cursor-pointer">
              <div className="space-y-0.5 pr-3">
                <p className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Women-Only Ride
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Visible and bookable only by female students.
                </p>
              </div>
              <input
                type="checkbox"
                checked={womenOnly}
                onChange={(e) => setWomenOnly(e.target.checked)}
                className="h-4 w-4 accent-rose-600 cursor-pointer"
              />
            </label>
          )}

          {/* Pickup Note */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Pickup Note (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Leaving on time from Gate B · spare helmet ready"
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent-signal)]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || routing || !origin || !dest}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-signal)] px-5 py-3 text-sm font-bold text-white hover:bg-[var(--accent-signal-hover)] disabled:opacity-50 shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            {submitting ? "Publishing…" : "Publish Ride"}
          </button>
        </form>

        {/* Right: Sticky Styled Map + Non-Overlapping Top-Right Pin Switcher */}
        <div className="lg:col-span-7 lg:sticky lg:top-20 relative">
          {/* Top-Right Floating Pin Switcher (never overlaps Leaflet top-left + / - zoom controls) */}
          <div className="pointer-events-auto absolute top-3 right-3 z-20 inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/92 backdrop-blur-md p-1 shadow-md">
            <button
              type="button"
              onClick={() => setPickMode("ORIGIN")}
              className={`btn-press rounded-full px-3 py-1 text-[11px] font-bold ${
                pickMode === "ORIGIN"
                  ? "bg-[var(--accent-signal)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-ink)]"
              }`}
            >
              Pin Start (A)
            </button>
            <button
              type="button"
              onClick={() => setPickMode("DEST")}
              className={`btn-press rounded-full px-3 py-1 text-[11px] font-bold ${
                pickMode === "DEST"
                  ? "bg-[var(--text-ink)] text-[var(--bg-surface)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-ink)]"
              }`}
            >
              Pin Drop-off (B)
            </button>
          </div>

          {/* Bottom-Left Floating Distance/Duration Pill */}
          {(routing || routeReady) && (
            <div className="pointer-events-auto absolute bottom-3 left-3 z-20 inline-flex items-center gap-2.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/94 backdrop-blur-md px-3.5 py-1.5 text-xs font-mono font-bold text-[var(--text-ink)] shadow-md">
              {routing ? (
                <span className="inline-flex items-center gap-1.5 text-[var(--accent-signal)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Routing…
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1">
                    <Route className="h-3.5 w-3.5 text-[var(--accent-signal)]" />
                    {activeDistanceKm} km
                  </span>
                  <span className="text-[var(--text-muted)]">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    {activeDurationMin} min
                  </span>
                </>
              )}
            </div>
          )}

          <RideMap
            origin={origin}
            dest={dest}
            polyline={activePolyline}
            onMapClick={handleMapClick}
            heightClassName="h-[360px] sm:h-[460px] lg:h-[560px]"
          />
        </div>
      </div>
    </div>
  );
}
