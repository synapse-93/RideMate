"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BadgeCheck,
  Car,
  Clock,
  Compass,
  Route,
  Search,
  Shield,
  Star,
  Users,
} from "lucide-react";
import {
  LocationAutocomplete,
  type SelectedLocation,
} from "@/components/map/LocationAutocomplete";
import { formatInr } from "@/lib/cost";

interface MatchedRideItem {
  matchScore: number;
  pickupDistKm: number | null;
  destDistKm: number | null;
  timeDeltaMin: number | null;
  ride: {
    id: string;
    originLabel: string;
    destLabel: string;
    distanceKm: number;
    estimatedDurationMin: number;
    departureTime: string;
    seatsTotal: number;
    seatsAvailable: number;
    costPerSeatInr: number;
    womenOnly: boolean;
    status: string;
    notes: string | null;
    driver: {
      id: string;
      fullName: string;
      idVerificationStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
      vehicleType: "TWO_WHEELER" | "CAR" | "NONE";
      vehicleModel: string | null;
      avgRating: number;
      totalRatings: number;
    };
  };
}

export default function FindRidePage() {
  const [origin, setOrigin] = useState<SelectedLocation | null>(null);
  const [dest, setDest] = useState<SelectedLocation | null>(null);
  const [departureLocal, setDepartureLocal] = useState("");
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [maxPickupRadiusKm, setMaxPickupRadiusKm] = useState(5);
  const [womenOnly, setWomenOnly] = useState(false);

  const [womenOnlyEligible, setWomenOnlyEligible] = useState(false);
  const [matches, setMatches] = useState<MatchedRideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rides/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: origin ? { lat: origin.lat, lng: origin.lng } : undefined,
          dest: dest ? { lat: dest.lat, lng: dest.lng } : undefined,
          departureTime: departureLocal
            ? new Date(departureLocal).toISOString()
            : undefined,
          windowMinutes,
          maxPickupRadiusKm,
          womenOnly,
        }),
      });
      const data = (await res.json()) as {
        matches?: MatchedRideItem[];
        womenOnlyEligible?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        return;
      }
      setMatches(data.matches ?? []);
      setWomenOnlyEligible(Boolean(data.womenOnlyEligible));
    } catch {
      setError("Network error while searching rides.");
    } finally {
      setLoading(false);
    }
  }, [origin, dest, departureLocal, windowMinutes, maxPickupRadiusKm, womenOnly]);

  useEffect(() => {
    let cancelled = false;
    async function fetchMatches(): Promise<void> {
      try {
        const res = await fetch("/api/rides/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: origin ? { lat: origin.lat, lng: origin.lng } : undefined,
            dest: dest ? { lat: dest.lat, lng: dest.lng } : undefined,
            departureTime: departureLocal
              ? new Date(departureLocal).toISOString()
              : undefined,
            windowMinutes,
            maxPickupRadiusKm,
            womenOnly,
          }),
        });
        if (cancelled) return;
        const data = (await res.json()) as {
          matches?: MatchedRideItem[];
          womenOnlyEligible?: boolean;
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Search failed");
          return;
        }
        setError(null);
        setMatches(data.matches ?? []);
        setWomenOnlyEligible(Boolean(data.womenOnlyEligible));
      } catch {
        if (!cancelled) setError("Network error while searching rides.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchMatches();
    return () => {
      cancelled = true;
    };
  }, [origin, dest, departureLocal, windowMinutes, maxPickupRadiusKm, womenOnly]);

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    void runSearch();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Compass className="h-6 w-6 text-emerald-500" />
          Find a Campus Ride
        </h1>
        <p className="text-sm text-zinc-500">
          Ranked by compatibility along driver OSRM routes (km), destination
          proximity, and ±{windowMinutes} min departure window.
        </p>
      </div>

      {/* Filter Panel */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <LocationAutocomplete
            label="Pickup Area (Origin)"
            placeholder="Where should the driver pick you up?"
            value={origin}
            onChange={setOrigin}
          />
          <LocationAutocomplete
            label="Destination"
            placeholder="Where are you heading?"
            value={dest}
            onChange={setDest}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Preferred Departure
            </label>
            <input
              type="datetime-local"
              value={departureLocal}
              onChange={(e) => setDepartureLocal(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Time Window (± min)
            </label>
            <select
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(Number(e.target.value))}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value={30}>±30 min</option>
              <option value={60}>±60 min</option>
              <option value={120}>±120 min</option>
              <option value={360}>±6 hours</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Max Pickup Radius: {maxPickupRadiusKm} km
            </label>
            <input
              type="range"
              min={1}
              max={15}
              step={0.5}
              value={maxPickupRadiusKm}
              onChange={(e) => setMaxPickupRadiusKm(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            {womenOnlyEligible ? (
              <label className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={womenOnly}
                  onChange={(e) => setWomenOnly(e.target.checked)}
                  className="h-4 w-4 accent-rose-600"
                />
                Women-Only
              </label>
            ) : (
              <span className="text-[11px] text-zinc-400">
                Women-only rides hidden (server-enforced)
              </span>
            )}

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 shrink-0"
            >
              <Search className="h-3.5 w-3.5" />
              Match
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-500">
          Computing route matches...
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center space-y-2">
          <p className="font-semibold">No matching rides found</p>
          <p className="text-sm text-zinc-500">
            Try widening your pickup radius (km), clearing the time filter, or{" "}
            <Link
              href="/offer"
              className="text-emerald-600 dark:text-emerald-400 underline"
            >
              offering a ride yourself
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {matches.map(({ ride, matchScore, pickupDistKm, destDistKm, timeDeltaMin }) => (
            <Link
              key={ride.id}
              href={`/rides/${ride.id}`}
              className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-emerald-500/60 transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                {/* Badges row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {matchScore}% Match
                    </span>
                    {ride.womenOnly && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                        <Shield className="h-3 w-3" />
                        Women-Only
                      </span>
                    )}
                  </div>
                  <span className="text-lg font-extrabold text-zinc-950 dark:text-white">
                    {formatInr(ride.costPerSeatInr)}
                    <span className="text-xs font-normal text-zinc-500">
                      /seat
                    </span>
                  </span>
                </div>

                {/* Route Origin -> Dest */}
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <p className="text-sm font-semibold line-clamp-1">
                      {ride.originLabel}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-zinc-900 dark:bg-zinc-200 shrink-0" />
                    <p className="text-sm font-semibold line-clamp-1">
                      {ride.destLabel}
                    </p>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(ride.departureTime).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Route className="h-3.5 w-3.5" />
                    {ride.distanceKm} km · {ride.estimatedDurationMin} min
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {ride.seatsAvailable}/{ride.seatsTotal} seats
                  </span>
                </div>

                {(pickupDistKm !== null || destDistKm !== null || timeDeltaMin !== null) && (
                  <div className="flex flex-wrap gap-2 text-[11px] text-emerald-700 dark:text-emerald-400">
                    {pickupDistKm !== null && (
                      <span>Pickup {pickupDistKm} km from route</span>
                    )}
                    {destDistKm !== null && (
                      <span>· Drop {destDistKm} km away</span>
                    )}
                    {timeDeltaMin !== null && (
                      <span>· {timeDeltaMin} min offset</span>
                    )}
                  </div>
                )}
              </div>

              {/* Driver Footer */}
              <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold truncate">
                    {ride.driver.fullName}
                  </span>
                  {ride.driver.idVerificationStatus === "APPROVED" && (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                  )}
                  <span className="inline-flex items-center gap-0.5 text-zinc-500">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {ride.driver.totalRatings > 0
                      ? ride.driver.avgRating.toFixed(1)
                      : "New"}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-zinc-500 shrink-0">
                  <Car className="h-3.5 w-3.5" />
                  {ride.driver.vehicleModel ?? ride.driver.vehicleType}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
