"use client";

import dynamic from "next/dynamic";
import type { RideMapProps } from "./RideMapClient";

const DynamicRideMap = dynamic(() => import("./RideMapClient"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 sm:h-80 w-full items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-xs text-zinc-500">
      Loading OpenStreetMap...
    </div>
  ),
});

export function RideMap(props: RideMapProps) {
  return <DynamicRideMap {...props} />;
}
