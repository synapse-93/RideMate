"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Clock,
  IndianRupee,
  Loader2,
  MapPin,
  PlusCircle,
  Route,
  Shield,
} from "lucide-react";
import { RideMap } from "@/components/map/RideMap";
import {
  LocationAutocomplete,
  type SelectedLocation,
} from "@/components/map/LocationAutocomplete";
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

export default function OfferRidePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);
  const [pickMode, setPickMode] = useState<"ORIGIN" | "DEST">("ORIGIN");

  const [origin, setOrigin] = useState<SelectedLocation | null>(null);
  const [dest, setDest] = useState<SelectedLocation | null>(null);
  const [polyline, setPolyline] = useState<LatLng[]>([]);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [estimatedDurationMin, setEstimatedDurationMin] = useState<number>(0);
  const [routeSource, setRouteSource] = useState<"osrm" | "haversine_fallback" | null>(null);
  const [routing, setRouting] = useState(false);

  const [departureLocal, setDepartureLocal] = useState(defaultDepartureLocalValue);
  const [seatsTotal, setSeatsTotal] = useState(3);
  const [costPerSeatInr, setCostPerSeatInr] = useState(35);
  const [womenOnly, setWomenOnly] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMe(): Promise<void> {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
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
  }, []);

  // Recompute OSRM route whenever origin and destination are both set
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
            source: "osrm" | "haversine_fallback";
          };
          setPolyline(data.polyline);
          setDistanceKm(data.distanceKm);
          setEstimatedDurationMin(data.estimatedDurationMin);
          setRouteSource(data.source);

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
  const activeRouteSource = hasBothEndpoints ? routeSource : null;

  const fuelEstimate = estimateFuelSplit(
    activeDistanceKm,
    me?.vehicleType ?? "CAR",
    seatsTotal
  );

  function handleMapClick(coords: LatLng): void {
    const label = `Pinned (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
    if (pickMode === "ORIGIN") {
      setOrigin({ label, lat: coords.lat, lng: coords.lng });
      setPickMode("DEST");
    } else {
      setDest({ label, lat: coords.lat, lng: coords.lng });
    }
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!origin || !dest || polyline.length < 2) {
      setError("Please select both origin and destination so a route can be computed.");
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
          polyline,
          distanceKm,
          estimatedDurationMin,
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
      router.push(`/rides/${data.ride.id}`);
    } catch {
      setError("Network error while publishing ride.");
    } finally {
      setSubmitting(false);
    }
  }

  const canEnableWomenOnly = me?.gender === "FEMALE";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Offer a Campus Ride</h1>
        <p className="text-sm text-zinc-500">
          Pick your start and destination to auto-compute the OSRM route (km) and
          fair INR fuel split.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Form Column */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 space-y-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6"
        >
          <LocationAutocomplete
            label="Origin (Pickup Corridor Start)"
            value={origin}
            onChange={setOrigin}
          />

          <LocationAutocomplete
            label="Destination (Campus / Drop-off)"
            value={dest}
            onChange={setDest}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Departure Date & Time
              </label>
              <input
                type="datetime-local"
                required
                value={departureLocal}
                onChange={(e) => setDepartureLocal(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Available Seats
              </label>
              <select
                value={seatsTotal}
                onChange={(e) => setSeatsTotal(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "seat" : "seats"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fuel Cost Summary */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <IndianRupee className="h-3.5 w-3.5" />
                Suggested Fuel Split ({me?.vehicleType ?? "CAR"})
              </span>
              <span className="text-zinc-500">
                Total fuel est: {formatInr(fuelEstimate.totalFuelCostInr)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-zinc-500 shrink-0">
                Cost per seat (INR ₹):
              </label>
              <input
                type="number"
                min={0}
                max={2000}
                value={costPerSeatInr}
                onChange={(e) => setCostPerSeatInr(Number(e.target.value))}
                className="w-28 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-sm font-bold outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Women-Only Toggle (Only enabled for FEMALE users) */}
          <div
            className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
              canEnableWomenOnly
                ? "border-rose-500/30 bg-rose-500/5"
                : "border-zinc-200 dark:border-zinc-800 opacity-60"
            }`}
          >
            <div className="space-y-0.5 pr-3">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-rose-500" />
                Women-Only Ride
              </p>
              <p className="text-xs text-zinc-500">
                {canEnableWomenOnly
                  ? "Only verified female students will see or request this ride."
                  : "Available only for drivers whose profile gender is Female."}
              </p>
            </div>
            <input
              type="checkbox"
              disabled={!canEnableWomenOnly}
              checked={canEnableWomenOnly && womenOnly}
              onChange={(e) => setWomenOnly(e.target.checked)}
              className="h-5 w-5 accent-rose-600 disabled:cursor-not-allowed cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Pickup Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Leaving sharp on time from Gate B. Spare helmet available."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || routing || !origin || !dest}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4" />
            {submitting ? "Publishing Ride..." : "Publish Ride"}
          </button>
        </form>

        {/* Interactive Map Column */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-xs">
            <span className="font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-emerald-500" />
              Click map to pin:
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPickMode("ORIGIN")}
                className={`rounded-lg px-3 py-1 font-semibold ${
                  pickMode === "ORIGIN"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                Origin (A)
              </button>
              <button
                type="button"
                onClick={() => setPickMode("DEST")}
                className={`rounded-lg px-3 py-1 font-semibold ${
                  pickMode === "DEST"
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                Destination (B)
              </button>
            </div>
          </div>

          <RideMap
            origin={origin}
            dest={dest}
            polyline={activePolyline}
            onMapClick={handleMapClick}
            heightClassName="h-80 sm:h-[420px]"
          />

          {/* Route Telemetry Strip */}
          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                Distance
              </p>
              <p className="mt-0.5 text-base font-bold flex items-center justify-center gap-1">
                {routing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                ) : (
                  <>
                    <Route className="h-4 w-4 text-emerald-500" />
                    {activeDistanceKm > 0 ? `${activeDistanceKm} km` : "—"}
                  </>
                )}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                Est. Time
              </p>
              <p className="mt-0.5 text-base font-bold flex items-center justify-center gap-1">
                <Clock className="h-4 w-4 text-emerald-500" />
                {activeDurationMin > 0 ? `${activeDurationMin} min` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                Routing
              </p>
              <p className="mt-0.5 text-xs font-semibold pt-1">
                {activeRouteSource === "osrm"
                  ? "OSRM Road"
                  : activeRouteSource === "haversine_fallback"
                  ? "Haversine Est."
                  : "Pick points"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
