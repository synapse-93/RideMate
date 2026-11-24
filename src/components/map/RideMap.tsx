"use client";

import dynamic from "next/dynamic";
import type { RideMapProps } from "./RideMapClient";

const DynamicRideMap = dynamic(() => import("./RideMapClient"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 sm:h-80 w-full items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-muted)]">
      Loading Bengaluru map…
    </div>
  ),
});

export function RideMap(props: RideMapProps) {
  return <DynamicRideMap {...props} />;
}
