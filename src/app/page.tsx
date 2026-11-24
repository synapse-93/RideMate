import Link from "next/link";
import {
  ArrowRight,
  Compass,
  IndianRupee,
  MapPin,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Verified Campus Network",
    description:
      "College email domain check, mock 6-digit OTP verification, and optional Admin-reviewed Student ID badges.",
  },
  {
    icon: MapPin,
    title: "Smart Polyline Matching",
    description:
      "Ranks rides by real road proximity (km) along OSRM corridors, destination fit, and ±60 min departure alignment.",
  },
  {
    icon: IndianRupee,
    title: "Fair INR Fuel Splits",
    description:
      "Transparent per-seat ₹ calculation based on road distance (km), vehicle mileage, and total occupants.",
  },
  {
    icon: Users,
    title: "Women-Only Safety Option",
    description:
      "Server-enforced women-only carpool matching, privacy phone controls, live trip simulation, and instant SOS logs.",
  },
] as const;

const CORRIDORS = [
  { from: "Indiranagar Metro", to: "RVCE Mysore Road", dist: "18.5 km", fare: "₹35" },
  { from: "Jayanagar 4th Block", to: "RVCE Mysore Road", dist: "12.4 km", fare: "₹15" },
  { from: "Koramangala Sony World", to: "PES University BSK", dist: "12.8 km", fare: "₹25" },
  { from: "BMSCE Basavanagudi", to: "Electronic City Ph 1", dist: "17.2 km", fare: "₹20" },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-10 md:p-14">
        <div className="max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            Zero-Cost Student Carpooling · Metric (km) & INR (₹)
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
            Share the campus commute.{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              Split fuel, not trust.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            RideMate connects verified college students along daily Bengaluru
            corridors using open maps, transparent INR fuel splits, women-only
            matching, and real-time trip coordination.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/find"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-6 py-3.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 transition-colors"
            >
              <Compass className="h-4 w-4" />
              Find a Ride
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/offer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-6 py-3.5 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Offer a Ride
            </Link>
          </div>
        </div>
      </section>

      {/* Core Pillars */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.title}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-base">{feat.title}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {feat.description}
              </p>
            </div>
          );
        })}
      </section>

      {/* Popular Campus Corridors */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              Popular Bengaluru Campus Corridors
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Sample fuel-split estimates across active student routes.
            </p>
          </div>
          <Link
            href="/find"
            className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
          >
            Browse all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {CORRIDORS.map((c) => (
            <Link
              key={`${c.from}-${c.to}`}
              href="/find"
              className="group flex items-center justify-between rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-emerald-500/60 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {c.from} → {c.to}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Approx. {c.dist} · Verified campus drivers
                </p>
              </div>
              <div className="shrink-0 pl-4 text-right">
                <span className="inline-block rounded-lg bg-emerald-500/10 px-2.5 py-1 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  ~{c.fare}/seat
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
