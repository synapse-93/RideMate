"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Car,
  Clock,
  PlusCircle,
  Route,
  Shield,
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

function statusBadgeClass(status: string): string {
  switch (status) {
    case "OPEN":
    case "ACCEPTED":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "CONFIRMED":
    case "IN_PROGRESS":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
    case "PENDING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "COMPLETED":
      return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
    default:
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
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
        if ((data.requested?.length ?? 0) === 0 && (data.offered?.length ?? 0) > 0) {
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
      <div className="py-12 text-center text-sm text-zinc-500">
        Loading your trips...
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Car className="h-6 w-6 text-emerald-500" />
            My Trips
          </h1>
          <p className="text-sm text-zinc-500">
            Manage seat requests, track live trips, chat with co-riders, and
            settle fuel splits.
          </p>
        </div>
        <Link
          href="/offer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-emerald-500 dark:text-zinc-950"
        >
          <PlusCircle className="h-4 w-4" />
          Offer Ride
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => setTab("REQUESTED")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
            tab === "REQUESTED"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          }`}
        >
          Booked / Requested ({requested.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("OFFERED")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
            tab === "OFFERED"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          }`}
        >
          Offered as Driver ({offered.length})
        </button>
      </div>

      {tab === "REQUESTED" ? (
        requested.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center space-y-2">
            <p className="font-semibold">No passenger trips yet</p>
            <p className="text-sm text-zinc-500">
              Browse available campus corridors in{" "}
              <Link
                href="/find"
                className="text-emerald-600 dark:text-emerald-400 underline"
              >
                Find Ride
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {requested.map((req) => (
              <Link
                key={req.id}
                href={`/rides/${req.ride.id}`}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-emerald-500/60 transition-all space-y-3"
              >
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
                      Trip: {req.ride.status}
                    </span>
                    {req.paymentStatus === "SIMULATED_PAID" && (
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Paid (Demo)
                      </span>
                    )}
                  </div>
                  <span className="font-bold">
                    {formatInr(req.ride.costPerSeatInr)}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold line-clamp-1">
                    {req.ride.originLabel} → {req.ride.destLabel}
                  </p>
                  <p className="text-xs text-zinc-500 line-clamp-1">
                    Your pickup: {req.pickupLabel}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-3 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    Driver: <strong>{req.ride.driver.fullName}</strong>
                    {req.ride.driver.idVerificationStatus === "APPROVED" && (
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    Open Trip <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : offered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center space-y-2">
          <p className="font-semibold">No offered rides yet</p>
          <p className="text-sm text-zinc-500">
            Have spare seats on your commute?{" "}
            <Link
              href="/offer"
              className="text-emerald-600 dark:text-emerald-400 underline"
            >
              Offer a ride
            </Link>{" "}
            and split fuel costs.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {offered.map((ride) => {
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
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-emerald-500/60 transition-all space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${statusBadgeClass(
                        ride.status
                      )}`}
                    >
                      {ride.status}
                    </span>
                    {ride.womenOnly && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                        <Shield className="h-3 w-3" />
                        Women-Only
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                        {pendingCount} pending request{pendingCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span className="font-bold">
                    {formatInr(ride.costPerSeatInr)}/seat
                  </span>
                </div>

                <p className="text-sm font-semibold line-clamp-2">
                  {ride.originLabel.split(",")[0]} → {ride.destLabel.split(",")[0]}
                </p>

                <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
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
