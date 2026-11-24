"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  PlusCircle,
  Route,
  Shield,
  Ticket,
  Users,
} from "lucide-react";
import { formatInr } from "@/lib/cost";

interface OfferedRide {
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
  requests: Array<{
    id: string;
    status: string;
    paymentStatus: string;
    passenger: { id: string; fullName: string };
  }>;
}

interface RequestedRide {
  id: string;
  pickupLabel: string;
  status: string;
  paymentStatus: string;
  ride: {
    id: string;
    originLabel: string;
    destLabel: string;
    distanceKm: number;
    estimatedDurationMin: number;
    departureTime: string;
    costPerSeatInr: number;
    womenOnly: boolean;
    status: string;
    driver: {
      id: string;
      fullName: string;
      idVerificationStatus: string;
      vehicleModel: string | null;
      vehicleType: string;
    };
  };
}

function shortPlace(label: string): string {
  return label.split(",")[0]?.trim() || label;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "OPEN":
    case "ACCEPTED":
      return "bg-[var(--verified-green)]/12 text-[var(--verified-green)]";
    case "CONFIRMED":
    case "IN_PROGRESS":
      return "bg-[var(--accent-signal)]/12 text-[var(--accent-signal)]";
    case "PENDING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "COMPLETED":
      return "bg-[var(--bg-subtle)] text-[var(--text-muted)]";
    default:
      return "bg-rose-500/12 text-rose-600 dark:text-rose-300";
  }
}

export default function TripsPage() {
  const [tab, setTab] = useState<"REQUESTED" | "OFFERED">("REQUESTED");
  const [offered, setOffered] = useState<OfferedRide[]>([]);
  const [requested, setRequested] = useState<RequestedRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch("/api/rides?mine=true", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          setError("Please sign in to view your trips.");
          return;
        }
        const data = (await res.json()) as {
          offered: OfferedRide[];
          requested: RequestedRide[];
        };
        setOffered(data.offered ?? []);
        setRequested(data.requested ?? []);
        if (
          (data.requested?.length ?? 0) === 0 &&
          (data.offered?.length ?? 0) > 0
        ) {
          setTab("OFFERED");
        }
      } catch {
        if (!cancelled) setError("Failed to load trips.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-muted)]">
        Loading your trips…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-sm text-rose-500">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] flex items-center gap-2">
            <Ticket className="h-6 w-6 text-[var(--accent-signal)]" />
            My Trips
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Track seats, coordinate pickups, and settle fair fuel splits.
          </p>
        </div>
        <Link
          href="/offer"
          className="btn-press inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-signal)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--accent-signal-hover)]"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Offer Ride
        </Link>
      </div>

      {/* Segmented Pill Tabs */}
      <div className="inline-flex gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
        <button
          type="button"
          onClick={() => setTab("REQUESTED")}
          className={`btn-press rounded-full px-4 py-1.5 text-xs font-bold ${
            tab === "REQUESTED"
              ? "bg-[var(--text-ink)] text-[var(--bg-surface)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-ink)]"
          }`}
        >
          Booked ({requested.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("OFFERED")}
          className={`btn-press rounded-full px-4 py-1.5 text-xs font-bold ${
            tab === "OFFERED"
              ? "bg-[var(--text-ink)] text-[var(--bg-surface)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-ink)]"
          }`}
        >
          Driving ({offered.length})
        </button>
      </div>

      {tab === "REQUESTED" ? (
        requested.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center space-y-2">
            <p className="font-bold">No booked rides yet</p>
            <p className="text-sm text-[var(--text-muted)]">
              Explore open campus commutes in{" "}
              <Link
                href="/find"
                className="font-bold text-[var(--accent-signal)] hover:underline"
              >
                Find Ride
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {requested.map((req, idx) => (
              <Link
                key={req.id}
                href={`/rides/${req.ride.id}`}
                style={{ animationDelay: `${idx * 45}ms` }}
                className="animate-fade-up card-lift rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-signal)]/60 overflow-hidden"
              >
                <div className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${statusBadgeClass(
                          req.status
                        )}`}
                      >
                        Seat: {req.status}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${statusBadgeClass(
                          req.ride.status
                        )}`}
                      >
                        {req.ride.status.replace("_", " ")}
                      </span>
                      {req.paymentStatus === "SIMULATED_PAID" && (
                        <span className="rounded-full bg-[var(--verified-green)]/12 px-2.5 py-0.5 text-[11px] font-bold text-[var(--verified-green)]">
                          Paid (Demo)
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-lg font-bold">
                      {formatInr(req.ride.costPerSeatInr)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-bold truncate">
                      {shortPlace(req.ride.originLabel)} →{" "}
                      {shortPlace(req.ride.destLabel)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      Pickup: {shortPlace(req.pickupLabel)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)]/55 px-5 py-3 text-xs text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    Driver:{" "}
                    <strong className="text-[var(--text-ink)]">
                      {req.ride.driver.fullName}
                    </strong>
                    {req.ride.driver.idVerificationStatus === "APPROVED" && (
                      <BadgeCheck className="h-3.5 w-3.5 text-[var(--verified-green)]" />
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-[var(--accent-signal)]">
                    Open pass <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : offered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center space-y-2">
          <p className="font-bold">No offered rides yet</p>
          <p className="text-sm text-[var(--text-muted)]">
            Have spare seats on your drive?{" "}
            <Link
              href="/offer"
              className="font-bold text-[var(--accent-signal)] hover:underline"
            >
              Offer a ride
            </Link>{" "}
            and share fuel costs.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {offered.map((ride, idx) => {
            const pendingCount = ride.requests.filter(
              (r) => r.status === "PENDING"
            ).length;
            const acceptedCount = ride.requests.filter(
              (r) => r.status === "ACCEPTED"
            ).length;
            return (
              <Link
                key={ride.id}
                href={`/rides/${ride.id}`}
                style={{ animationDelay: `${idx * 45}ms` }}
                className="animate-fade-up card-lift rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-signal)]/60 overflow-hidden"
              >
                <div className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${statusBadgeClass(
                          ride.status
                        )}`}
                      >
                        {ride.status.replace("_", " ")}
                      </span>
                      {ride.womenOnly && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-300">
                          <Shield className="h-3 w-3" />
                          Women-Only
                        </span>
                      )}
                      {pendingCount > 0 && (
                        <span className="rounded-full bg-[var(--accent-signal)]/12 px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-signal)]">
                          {pendingCount} pending
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-lg font-bold">
                      {formatInr(ride.costPerSeatInr)}
                      <span className="font-sans text-[11px] font-normal text-[var(--text-muted)]">
                        /seat
                      </span>
                    </span>
                  </div>

                  <p className="text-sm font-bold line-clamp-1">
                    {shortPlace(ride.originLabel)} →{" "}
                    {shortPlace(ride.destLabel)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)]/55 px-5 py-3 text-xs text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(ride.departureTime).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Route className="h-3.5 w-3.5" />
                    {ride.distanceKm} km
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {acceptedCount} confirmed · {ride.seatsAvailable} open
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
