"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeftRight,
  BadgeCheck,
  Car,
  Clock,
  Search,
  Shield,
  SlidersHorizontal,
  Star,
  X,
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

function shortPlace(label: string): string {
  const first = label.split(",")[0]?.trim();
  return first || label;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "DR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function parseLocParam(
  label: string | null,
  latStr: string | null,
  lngStr: string | null
): SelectedLocation | null {
  if (!label || !latStr || !lngStr) return null;
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { label, lat, lng };
}

function FindRideContent() {
  const searchParams = useSearchParams();
  const [origin, setOrigin] = useState<SelectedLocation | null>(() =>
    parseLocParam(
      searchParams.get("fromLabel"),
      searchParams.get("fromLat"),
      searchParams.get("fromLng")
    )
  );
  const [dest, setDest] = useState<SelectedLocation | null>(() =>
    parseLocParam(
      searchParams.get("toLabel"),
      searchParams.get("toLat"),
      searchParams.get("toLng")
    )
  );
  const [departureLocal, setDepartureLocal] = useState("");
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [maxPickupRadiusKm, setMaxPickupRadiusKm] = useState(5);
  const [womenOnly, setWomenOnly] = useState(false);

  const [swappedCount, setSwappedCount] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [womenOnlyEligible, setWomenOnlyEligible] = useState(false);
  const [matches, setMatches] = useState<MatchedRideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent): void {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const hasRouteFilter = Boolean(origin || dest || departureLocal);
  const activeFilterCount =
    (windowMinutes !== 60 ? 1 : 0) +
    (maxPickupRadiusKm !== 5 ? 1 : 0) +
    (womenOnly ? 1 : 0);

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

  function handleSwap(): void {
    const prev = origin;
    setOrigin(dest);
    setDest(prev);
    setSwappedCount((c) => c + 1);
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    void runSearch();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em]">
            Find a Ride
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Verified student seats heading across Bengaluru campus corridors.
          </p>
        </div>
        {hasRouteFilter && (
          <button
            type="button"
            onClick={() => {
              setOrigin(null);
              setDest(null);
              setDepartureLocal("");
              setWomenOnly(false);
            }}
            className="btn-press inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-ink)]"
          >
            <X className="h-3.5 w-3.5" />
            Clear search
          </button>
        )}
      </div>

      {/* Compact Single-Row Transit Search Bar + Filters Popover */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 shadow-xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="flex-1 min-w-0">
            <LocationAutocomplete
              placeholder="Pickup stop…"
              value={origin}
              onChange={setOrigin}
              compact
              dotColor="orange"
            />
          </div>

          <div className="flex justify-center lg:block">
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Swap pickup and destination"
              className="btn-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-ink)] hover:border-[var(--accent-signal)] hover:text-[var(--accent-signal)]"
            >
              <ArrowLeftRight
                className="h-4 w-4 transition-transform duration-300 ease-out"
                style={{ transform: `rotate(${swappedCount * 180}deg)` }}
              />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <LocationAutocomplete
              placeholder="Drop-off stop…"
              value={dest}
              onChange={setDest}
              compact
              dotColor="ink"
            />
          </div>

          {/* Compact When Input */}
          <div className="lg:w-48 shrink-0">
            <input
              type="datetime-local"
              aria-label="Preferred departure time"
              value={departureLocal}
              onChange={(e) => setDepartureLocal(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs font-mono font-medium text-[var(--text-ink)] outline-none focus:border-[var(--accent-signal)]"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Collapsible Filters Popover */}
            <div ref={filterRef} className="relative">
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                className={`btn-press inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold ${
                  filtersOpen || activeFilterCount > 0
                    ? "border-[var(--accent-signal)] bg-[var(--accent-signal)]/10 text-[var(--accent-signal)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-ink)]"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-signal)] px-1 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {filtersOpen && (
                <div className="animate-fade-up absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Ride Preferences
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-ink)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-ink)]">
                      Departure flexibility
                    </label>
                    <select
                      value={windowMinutes}
                      onChange={(e) => setWindowMinutes(Number(e.target.value))}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-medium outline-none focus:border-[var(--accent-signal)]"
                    >
                      <option value={30}>±30 min window</option>
                      <option value={60}>±60 min window</option>
                      <option value={120}>±2 hours window</option>
                      <option value={360}>±6 hours window</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--text-ink)]">
                        Max pickup distance
                      </span>
                      <span className="font-mono font-bold text-[var(--accent-signal)]">
                        {maxPickupRadiusKm} km
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={15}
                      step={0.5}
                      value={maxPickupRadiusKm}
                      onChange={(e) =>
                        setMaxPickupRadiusKm(Number(e.target.value))
                      }
                      className="w-full accent-[#FF5A26]"
                    />
                  </div>

                  {womenOnlyEligible && (
                    <label className="flex items-center justify-between rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-3 py-2.5 cursor-pointer">
                      <span className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                        <Shield className="h-3.5 w-3.5" />
                        Women-Only rides
                      </span>
                      <input
                        type="checkbox"
                        checked={womenOnly}
                        onChange={(e) => setWomenOnly(e.target.checked)}
                        className="h-4 w-4 accent-rose-600"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn-press flex-1 lg:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-signal)] px-4 py-2.5 text-xs font-bold text-white hover:bg-[var(--accent-signal-hover)]"
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Results — Boarding-Pass Ride Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
            />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center space-y-2.5">
          <p className="text-base font-bold">No open seats match this route</p>
          <p className="text-sm text-[var(--text-muted)]">
            Try widening your pickup distance in Filters, clearing the time, or{" "}
            <Link
              href="/offer"
              className="font-bold text-[var(--accent-signal)] hover:underline"
            >
              offering your own ride
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {matches.map(({ ride, pickupDistKm, timeDeltaMin }, idx) => {
            const seatsTaken = Math.max(0, ride.seatsTotal - ride.seatsAvailable);
            const proximityBadge = hasRouteFilter
              ? pickupDistKm !== null && pickupDistKm <= 0.6
                ? "Direct route"
                : pickupDistKm !== null
                ? `${pickupDistKm} km pickup`
                : timeDeltaMin !== null
                ? `${timeDeltaMin} min flex`
                : "Route match"
              : `${ride.seatsAvailable} ${
                  ride.seatsAvailable === 1 ? "seat" : "seats"
                } left`;

            return (
              <Link
                key={ride.id}
                href={`/rides/${ride.id}`}
                style={{ animationDelay: `${idx * 45}ms` }}
                className="animate-fade-up card-lift group rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-signal)]/60 overflow-hidden flex flex-col justify-between"
              >
                {/* Top Boarding-Pass Section */}
                <div className="p-5 flex items-start justify-between gap-4">
                  {/* Left: Vertical Dotted Transit Spine */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          hasRouteFilter
                            ? "bg-[var(--accent-signal)]/12 text-[var(--accent-signal)]"
                            : "bg-[var(--verified-green)]/12 text-[var(--verified-green)]"
                        }`}
                      >
                        {proximityBadge}
                      </span>
                      {ride.womenOnly && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-300">
                          <Shield className="h-3 w-3" />
                          Women-Only
                        </span>
                      )}
                    </div>

                    {/* Vertical Transit Line */}
                    <div className="relative pl-5 space-y-2 pt-1">
                      <span className="absolute left-[5px] top-2.5 bottom-2.5 border-l-2 border-dotted border-[var(--border-subtle)]" />

                      <div className="relative">
                        <span className="absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--accent-signal)] ring-4 ring-[var(--bg-surface)]" />
                        <p className="text-sm font-bold text-[var(--text-ink)] truncate">
                          {shortPlace(ride.originLabel)}
                        </p>
                      </div>

                      <p className="font-mono text-[11px] font-medium text-[var(--text-muted)]">
                        {ride.distanceKm} km · {ride.estimatedDurationMin} min
                      </p>

                      <div className="relative">
                        <span className="absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--text-ink)] ring-4 ring-[var(--bg-surface)]" />
                        <p className="text-sm font-bold text-[var(--text-ink)] truncate">
                          {shortPlace(ride.destLabel)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Mono Fare + Tactile Seat Dots + Departure Time */}
                  <div className="shrink-0 text-right space-y-2.5">
                    <div>
                      <p className="font-mono text-xl font-bold tracking-tight text-[var(--text-ink)]">
                        {formatInr(ride.costPerSeatInr)}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        per seat
                      </p>
                    </div>

                    {/* Tactile Seat Dots (filled = open, hollow = booked) */}
                    <div
                      className="flex items-center justify-end gap-1.5"
                      title={`${ride.seatsAvailable} of ${ride.seatsTotal} seats available`}
                    >
                      {Array.from({ length: ride.seatsTotal }).map((_, i) => {
                        const isOpen = i < ride.seatsAvailable;
                        return (
                          <span
                            key={i}
                            className={`h-2.5 w-2.5 rounded-full ${
                              isOpen
                                ? "bg-[var(--accent-signal)]"
                                : "border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                            }`}
                          />
                        );
                      })}
                      <span className="sr-only">
                        {ride.seatsAvailable} open, {seatsTaken} taken
                      </span>
                    </div>

                    <p className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-[var(--text-muted)]">
                      <Clock className="h-3 w-3" />
                      {new Date(ride.departureTime).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Perforated Ticket Footer: Driver Info */}
                <div className="flex items-center justify-between gap-3 border-t border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)]/55 px-5 py-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--text-ink)] text-[10px] font-bold text-[var(--bg-surface)]">
                      {getInitials(ride.driver.fullName)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--text-ink)] flex items-center gap-1 truncate">
                        <span className="truncate">{ride.driver.fullName}</span>
                        {ride.driver.idVerificationStatus === "APPROVED" && (
                          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--verified-green)]" />
                        )}
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="font-mono">
                          {ride.driver.totalRatings > 0
                            ? ride.driver.avgRating.toFixed(1)
                            : "New"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] shrink-0 max-w-[155px] truncate">
                    <Car className="h-3 w-3 shrink-0 text-[var(--text-ink)]" />
                    <span className="truncate">
                      {ride.driver.vehicleModel ??
                        (ride.driver.vehicleType === "TWO_WHEELER"
                          ? "Two-wheeler"
                          : "Car")}
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FindRidePage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">
          Loading campus rides…
        </div>
      }
    >
      <FindRideContent />
    </Suspense>
  );
}
