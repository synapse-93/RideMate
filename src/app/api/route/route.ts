import { NextResponse } from "next/server";
import { z } from "zod";
import {
  estimateDurationMin,
  haversineKm,
  roundKm,
  type LatLng,
} from "@/lib/geo";

export const dynamic = "force-dynamic";

const routeRequestSchema = z.object({
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  dest: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

interface OsrmRouteGeometry {
  coordinates?: unknown;
}

interface OsrmRouteEntry {
  distance?: number;
  duration?: number;
  geometry?: OsrmRouteGeometry;
}

interface OsrmResponse {
  code?: string;
  routes?: OsrmRouteEntry[];
}

function buildFallbackPolyline(origin: LatLng, dest: LatLng): LatLng[] {
  const steps = 6;
  const points: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      lat: Number((origin.lat + (dest.lat - origin.lat) * t).toFixed(6)),
      lng: Number((origin.lng + (dest.lng - origin.lng) * t).toFixed(6)),
    });
  }
  return points;
}

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json();
    const parsed = routeRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid coordinates" },
        { status: 400 }
      );
    }

    const { origin, dest } = parsed.data;
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(osrmUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "RideMate-StudentCarpool/1.0",
        },
        cache: "no-store",
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as OsrmResponse;
        const first = data.routes?.[0];
        const coords = first?.geometry?.coordinates;

        if (
          data.code === "Ok" &&
          first &&
          typeof first.distance === "number" &&
          typeof first.duration === "number" &&
          Array.isArray(coords) &&
          coords.length >= 2
        ) {
          const polyline: LatLng[] = [];
          for (const pair of coords) {
            if (
              Array.isArray(pair) &&
              pair.length >= 2 &&
              typeof pair[0] === "number" &&
              typeof pair[1] === "number"
            ) {
              // GeoJSON is [lng, lat]
              polyline.push({ lat: pair[1], lng: pair[0] });
            }
          }

          if (polyline.length >= 2) {
            return NextResponse.json({
              polyline,
              distanceKm: roundKm(first.distance / 1000),
              estimatedDurationMin: Math.max(1, Math.round(first.duration / 60)),
              source: "osrm" as const,
            });
          }
        }
      }
    } catch {
      // Gracefully fall through to Haversine fallback
    }

    // Haversine fallback with 1.22x Bengaluru road winding factor
    const straightKm = haversineKm(origin, dest);
    const roadKm = roundKm(Math.max(0.2, straightKm * 1.22));
    const estimatedDurationMin = estimateDurationMin(roadKm, 24);
    const polyline = buildFallbackPolyline(origin, dest);

    return NextResponse.json({
      polyline,
      distanceKm: roadKm,
      estimatedDurationMin,
      source: "haversine_fallback" as const,
    });
  } catch (error: unknown) {
    console.error("Route proxy error:", error);
    return NextResponse.json(
      { error: "Failed to calculate route." },
      { status: 500 }
    );
  }
}
