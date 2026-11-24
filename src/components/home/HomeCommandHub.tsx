"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Car,
  CheckCircle2,
  Search,
} from "lucide-react";
import {
  LocationAutocomplete,
  type SelectedLocation,
} from "@/components/map/LocationAutocomplete";
import { CAMPUS_PRESETS } from "@/lib/presets";

interface CorridorCard {
  id: string;
  fromName: string;
  toName: string;
  fromPresetId: string;
  toPresetId: string;
  distanceKm: string;
  durationMin: string;
  fareInr: string;
  tag: string;
}

const LIVE_CORRIDORS: ReadonlyArray<CorridorCard> = [
  {
    id: "indiranagar-rvce",
    fromName: "Indiranagar Metro",
    toName: "RVCE Campus",
    fromPresetId: "indiranagar",
    toPresetId: "rvce",
    distanceKm: "18.5 km",
    durationMin: "46 min",
    fareInr: "₹35",
    tag: "Direct route",
  },
  {
    id: "jayanagar-rvce",
    fromName: "Jayanagar 4th Block",
    toName: "RVCE Campus",
    fromPresetId: "jayanagar",
    toPresetId: "rvce",
    distanceKm: "12.4 km",
    durationMin: "31 min",
    fareInr: "₹15",
    tag: "Popular morning",
  },
  {
    id: "koramangala-pesu",
    fromName: "Koramangala Sony World",
    toName: "PES University",
    fromPresetId: "koramangala",
    toPresetId: "pesu",
    distanceKm: "12.8 km",
    durationMin: "32 min",
    fareInr: "₹25",
    tag: "Outer Ring Rd",
  },
  {
    id: "bmsce-ecity",
    fromName: "BMSCE Basavanagudi",
    toName: "Electronic City Ph 1",
    fromPresetId: "bmsce",
    toPresetId: "ecity",
    distanceKm: "17.2 km",
    durationMin: "43 min",
    fareInr: "₹20",
    tag: "Evening return",
  },
];

function buildFindUrl(
  origin: SelectedLocation | null,
  dest: SelectedLocation | null
): string {
  const params = new URLSearchParams();
  if (origin) {
    params.set("fromLabel", origin.label);
    params.set("fromLat", String(origin.lat));
    params.set("fromLng", String(origin.lng));
  }
  if (dest) {
    params.set("toLabel", dest.label);
    params.set("toLat", String(dest.lat));
    params.set("toLng", String(dest.lng));
  }
  const qs = params.toString();
  return qs ? `/find?${qs}` : "/find";
}

function getPresetById(id: string): SelectedLocation | null {
  const found = CAMPUS_PRESETS.find((p) => p.id === id);
  if (!found) return null;
  return { label: found.label, lat: found.lat, lng: found.lng };
}

export function HomeCommandHub() {
  const router = useRouter();
  const [origin, setOrigin] = useState<SelectedLocation | null>(null);
  const [dest, setDest] = useState<SelectedLocation | null>(null);
  const [swappedCount, setSwappedCount] = useState(0);

  function handleSwap(): void {
    const prevOrigin = origin;
    setOrigin(dest);
    setDest(prevOrigin);
    setSwappedCount((c) => c + 1);
  }

  function handleSearch(e: FormEvent): void {
    e.preventDefault();
    router.push(buildFindUrl(origin, dest));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 sm:space-y-10 pt-2 sm:pt-4">
      {/* Compact Transit Command Header + Quick Search */}
      <section className="animate-fade-up space-y-5">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--verified-green)]" />
            Verified campus rides · Fair fuel split
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.035em] leading-[1.06] text-[var(--text-ink)]">
            Catch a ride to campus.
          </h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-xl">
            Split daily Bengaluru commutes with verified college students heading
            your way.
          </p>
        </div>

        {/* Interactive Quick Search Bar */}
        <form
          onSubmit={handleSearch}
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 sm:p-3 shadow-sm"
        >
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex-1 min-w-0">
              <LocationAutocomplete
                placeholder="Leaving from…"
                value={origin}
                onChange={setOrigin}
                compact
                dotColor="orange"
              />
            </div>

            <div className="flex justify-center md:block">
              <button
                type="button"
                onClick={handleSwap}
                aria-label="Swap start and destination"
                title="Swap stops"
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
                placeholder="Going to campus…"
                value={dest}
                onChange={setDest}
                compact
                dotColor="ink"
              />
            </div>

            <button
              type="submit"
              className="btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-signal)] px-5 py-3 text-sm font-bold text-white hover:bg-[var(--accent-signal-hover)] shadow-xs shrink-0"
            >
              <Search className="h-4 w-4" />
              Find Rides
            </button>
          </div>
        </form>
      </section>

      {/* Live Campus Corridors */}
      <section className="space-y-3.5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-[-0.02em]">
              Live Campus Corridors
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Tap a route to jump straight into open student seats.
            </p>
          </div>
          <Link
            href="/find"
            className="text-xs sm:text-sm font-bold text-[var(--accent-signal)] hover:underline inline-flex items-center gap-1"
          >
            All rides
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {LIVE_CORRIDORS.map((corridor, idx) => {
            const href = buildFindUrl(
              getPresetById(corridor.fromPresetId),
              getPresetById(corridor.toPresetId)
            );
            return (
              <Link
                key={corridor.id}
                href={href}
                style={{ animationDelay: `${idx * 45}ms` }}
                className="animate-fade-up card-lift group flex items-center justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 hover:border-[var(--accent-signal)]/60"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent-signal)] shrink-0" />
                    <p className="text-sm font-bold text-[var(--text-ink)] truncate">
                      {corridor.fromName}
                      <span className="mx-1.5 text-[var(--text-muted)] font-normal">
                        →
                      </span>
                      {corridor.toName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span className="font-mono font-medium">
                      {corridor.distanceKm}
                    </span>
                    <span>·</span>
                    <span className="font-mono">{corridor.durationMin}</span>
                    <span>·</span>
                    <span>{corridor.tag}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <span className="font-mono text-base font-bold text-[var(--text-ink)]">
                      {corridor.fareInr}
                    </span>
                    <span className="block text-[10px] font-medium text-[var(--text-muted)]">
                      typical split
                    </span>
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:bg-[var(--accent-signal)] group-hover:text-white">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Compact Driver Action Strip */}
      <section>
        <Link
          href="/offer"
          className="card-lift group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-5 py-4 hover:border-[var(--accent-signal)]/50"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--accent-signal)]">
              <Car className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-[var(--text-ink)]">
                Driving to college today?
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Post your empty seats in 20 seconds and share fuel costs with
                verified classmates.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--accent-signal)] shrink-0">
            Offer empty seats
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </Link>
      </section>
    </div>
  );
}
