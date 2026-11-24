import { NextResponse } from "next/server";
import { z } from "zod";
import { CAMPUS_PRESETS } from "@/lib/presets";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(2).max(120),
});

interface NominatimItem {
  display_name?: string;
  lat?: string;
  lon?: string;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ q: searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({
      results: [] as GeocodeResult[],
      source: "presets_fallback" as const,
    });
  }

  const trimmed = parsed.data.q;
  const lower = trimmed.toLowerCase();

  const localMatches: GeocodeResult[] = CAMPUS_PRESETS.filter(
    (p) =>
      p.label.toLowerCase().includes(lower) ||
      p.shortLabel.toLowerCase().includes(lower)
  ).map((p) => ({ label: p.label, lat: p.lat, lng: p.lng }));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(
      `${trimmed}, Bengaluru`
    )}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "RideMate-StudentCarpool/1.0",
      },
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as NominatimItem[];
      const remote: GeocodeResult[] = [];
      for (const item of data) {
        const lat = Number(item.lat);
        const lng = Number(item.lon);
        if (
          typeof item.display_name === "string" &&
          Number.isFinite(lat) &&
          Number.isFinite(lng)
        ) {
          remote.push({ label: item.display_name, lat, lng });
        }
      }

      if (remote.length > 0) {
        return NextResponse.json({
          results: [...localMatches, ...remote].slice(0, 6),
          source: "nominatim" as const,
        });
      }
    }
  } catch {
    // Rate-limit (429), timeout (4s), or 5xx: fall back smoothly to campus presets
  }

  return NextResponse.json({
    results: localMatches,
    source: "presets_fallback" as const,
  });
}
