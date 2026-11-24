import { NextResponse } from "next/server";
import { z } from "zod";
import { CAMPUS_PRESETS } from "@/lib/presets";

export const dynamic = "force-dynamic";

const forwardQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
});

const reverseQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

interface NominatimItem {
  display_name?: string;
  lat?: string;
  lon?: string;
}

interface NominatimReverseAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city_district?: string;
  city?: string;
}

interface NominatimReverseResponse {
  display_name?: string;
  name?: string;
  address?: NominatimReverseAddress;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

function formatFallbackPin(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `Custom Pin (${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lng).toFixed(2)}°${lngDir})`;
}

function formatConciseReverseLabel(data: NominatimReverseResponse): string | null {
  const addr = data.address;
  if (addr) {
    const primary =
      data.name ||
      addr.neighbourhood ||
      addr.suburb ||
      addr.village ||
      addr.road;
    const secondary =
      addr.road && addr.road !== primary
        ? addr.road
        : addr.suburb && addr.suburb !== primary
        ? addr.suburb
        : addr.city_district || addr.city;

    if (primary && secondary) {
      return `${primary}, ${secondary}`;
    }
    if (primary) {
      return primary;
    }
  }
  if (typeof data.display_name === "string" && data.display_name.trim().length > 0) {
    return data.display_name
      .split(",")
      .slice(0, 2)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Reverse geocoding mode (?lat=...&lng=...)
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  if (latParam !== null && lngParam !== null) {
    const parsedReverse = reverseQuerySchema.safeParse({
      lat: latParam,
      lng: lngParam,
    });
    if (!parsedReverse.success) {
      return NextResponse.json(
        { error: "Invalid coordinates" },
        { status: 400 }
      );
    }

    const { lat, lng } = parsedReverse.data;
    const fallbackLabel = formatFallbackPin(lat, lng);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        String(lat)
      )}&lon=${encodeURIComponent(String(lng))}&zoom=16&addressdetails=1`;

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
        const data = (await res.json()) as NominatimReverseResponse;
        const concise = formatConciseReverseLabel(data);
        if (concise) {
          return NextResponse.json({
            label: concise,
            lat,
            lng,
            source: "nominatim" as const,
          });
        }
      }
    } catch {
      // Rate-limit (429), timeout (4s), or network error -> clean coordinate fallback
    }

    return NextResponse.json({
      label: fallbackLabel,
      lat,
      lng,
      source: "fallback" as const,
    });
  }

  // Forward search mode (?q=...)
  const parsed = forwardQuerySchema.safeParse({ q: searchParams.get("q") ?? "" });
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
