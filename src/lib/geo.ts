export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle Haversine distance between two coordinates in kilometres (km).
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const clampedH = Math.min(1, Math.max(0, h));
  const c = 2 * Math.atan2(Math.sqrt(clampedH), Math.sqrt(1 - clampedH));
  return EARTH_RADIUS_KM * c;
}

/**
 * Minimum distance in kilometres (km) from a point to a line segment [start, end].
 * Projects onto a local equirectangular plane to find the clamped nearest point,
 * then measures exact Haversine distance to that point.
 */
export function pointToSegmentDistanceKm(
  point: LatLng,
  start: LatLng,
  end: LatLng
): number {
  const cosLat = Math.cos(toRadians((start.lat + end.lat) / 2));

  const ax = start.lng * cosLat;
  const ay = start.lat;
  const bx = end.lng * cosLat;
  const by = end.lat;
  const px = point.lng * cosLat;
  const py = point.lat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return haversineKm(point, start);
  }

  const rawT = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  const t = Math.max(0, Math.min(1, rawT));

  const closest: LatLng = {
    lat: start.lat + t * (end.lat - start.lat),
    lng: start.lng + t * (end.lng - start.lng),
  };

  return haversineKm(point, closest);
}

/**
 * Minimum distance in kilometres (km) from a point to any segment along a polyline.
 */
export function pointToPolylineMinDistanceKm(
  point: LatLng,
  polyline: ReadonlyArray<LatLng>
): number {
  if (polyline.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (polyline.length === 1) {
    return haversineKm(point, polyline[0]);
  }

  let minKm = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = pointToSegmentDistanceKm(point, polyline[i], polyline[i + 1]);
    if (dist < minKm) {
      minKm = dist;
    }
  }
  return minKm;
}

/**
 * Computes total path length of a polyline in kilometres (km).
 */
export function polylineLengthKm(polyline: ReadonlyArray<LatLng>): number {
  if (polyline.length < 2) {
    return 0;
  }
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    total += haversineKm(polyline[i], polyline[i + 1]);
  }
  return total;
}

/**
 * Returns an interpolated coordinate at progress [0, 1] along a polyline.
 */
export function interpolateAlongPolyline(
  polyline: ReadonlyArray<LatLng>,
  progress: number
): LatLng {
  if (polyline.length === 0) {
    return { lat: 12.9237, lng: 77.4987 };
  }
  if (polyline.length === 1 || progress <= 0) {
    return polyline[0];
  }
  if (progress >= 1) {
    return polyline[polyline.length - 1];
  }

  const totalKm = polylineLengthKm(polyline);
  if (totalKm <= 0) {
    return polyline[0];
  }

  const targetKm = totalKm * progress;
  let traversed = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const segKm = haversineKm(polyline[i], polyline[i + 1]);
    if (traversed + segKm >= targetKm && segKm > 0) {
      const localT = (targetKm - traversed) / segKm;
      return {
        lat: polyline[i].lat + localT * (polyline[i + 1].lat - polyline[i].lat),
        lng: polyline[i].lng + localT * (polyline[i + 1].lng - polyline[i].lng),
      };
    }
    traversed += segKm;
  }

  return polyline[polyline.length - 1];
}

/**
 * Serializes LatLng[] into compact JSON [[lat, lng], ...] for DB storage.
 */
export function serializePolyline(points: ReadonlyArray<LatLng>): string {
  const tuples = points.map((p) => [
    Number(p.lat.toFixed(6)),
    Number(p.lng.toFixed(6)),
  ]);
  return JSON.stringify(tuples);
}

/**
 * Safely parses stored polyline JSON back into LatLng[].
 */
export function parsePolyline(raw: string): LatLng[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const result: LatLng[] = [];
    for (const item of parsed) {
      if (
        Array.isArray(item) &&
        item.length >= 2 &&
        typeof item[0] === "number" &&
        typeof item[1] === "number" &&
        Number.isFinite(item[0]) &&
        Number.isFinite(item[1])
      ) {
        result.push({ lat: item[0], lng: item[1] });
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Estimates travel duration in minutes using metric average speed (km/h).
 */
export function estimateDurationMin(
  distanceKm: number,
  avgSpeedKmh = 24
): number {
  if (distanceKm <= 0 || avgSpeedKmh <= 0) {
    return 0;
  }
  return Math.max(1, Math.round((distanceKm / avgSpeedKmh) * 60));
}

export function roundKm(km: number): number {
  return Math.round(km * 10) / 10;
}
