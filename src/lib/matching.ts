import {
  haversineKm,
  parsePolyline,
  pointToPolylineMinDistanceKm,
  roundKm,
  type LatLng,
} from "./geo";

export type MatchGender = "MALE" | "FEMALE" | "OTHER";
export type MatchRideStatus =
  | "OPEN"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface MatchableRide {
  id: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  routePolyline: string;
  departureTime: Date;
  seatsAvailable: number;
  womenOnly: boolean;
  status: MatchRideStatus;
}

export interface MatchQuery {
  origin?: LatLng;
  dest?: LatLng;
  desiredDepartureTime?: Date;
  windowMinutes?: number;
  maxPickupRadiusKm?: number;
  womenOnly?: boolean;
}

export interface RankedRide<T extends MatchableRide> {
  ride: T;
  matchScore: number;
  pickupDistKm: number | null;
  destDistKm: number | null;
  timeDeltaMin: number | null;
}

/**
 * Server-side invariant: only FEMALE users may create, discover, or request womenOnly rides.
 */
export function canAccessWomenOnlyRides(
  gender: MatchGender | null | undefined
): boolean {
  return gender === "FEMALE";
}

/**
 * Strictly excludes womenOnly rides whenever the requester is not FEMALE.
 */
export function filterWomenOnlyVisibility<T extends { womenOnly: boolean }>(
  rides: ReadonlyArray<T>,
  requesterGender: MatchGender | null | undefined
): T[] {
  if (canAccessWomenOnlyRides(requesterGender)) {
    return [...rides];
  }
  return rides.filter((r) => !r.womenOnly);
}

/**
 * Ranks OPEN (or seat-available CONFIRMED) rides by route proximity (km),
 * destination proximity (km), and departure time alignment (min).
 * Strictly enforces women-only visibility server-side.
 */
export function scoreAndRankRides<T extends MatchableRide>(
  rides: ReadonlyArray<T>,
  query: MatchQuery,
  requesterGender: MatchGender | null | undefined
): RankedRide<T>[] {
  const windowMinutes = Math.max(5, query.windowMinutes ?? 60);
  const maxPickupRadiusKm = Math.max(0.5, query.maxPickupRadiusKm ?? 5);
  const maxDestRadiusKm = Math.max(maxPickupRadiusKm * 1.6, 6);

  // 1. Enforce server-side women-only access rule
  const visibleRides = filterWomenOnlyVisibility(rides, requesterGender);

  // If a non-female user explicitly asks for womenOnly rides, return empty immediately
  if (query.womenOnly && !canAccessWomenOnlyRides(requesterGender)) {
    return [];
  }

  const ranked: RankedRide<T>[] = [];

  for (const ride of visibleRides) {
    if (ride.status !== "OPEN" && ride.status !== "CONFIRMED") {
      continue;
    }
    if (ride.seatsAvailable < 1) {
      continue;
    }
    if (query.womenOnly && !ride.womenOnly) {
      continue;
    }

    const parsedPoly = parsePolyline(ride.routePolyline);
    const polyline: LatLng[] =
      parsedPoly.length >= 2
        ? parsedPoly
        : [
            { lat: ride.originLat, lng: ride.originLng },
            { lat: ride.destLat, lng: ride.destLng },
          ];

    let pickupDistKm: number | null = null;
    let pickupScore = 1;
    if (query.origin) {
      pickupDistKm = pointToPolylineMinDistanceKm(query.origin, polyline);
      if (pickupDistKm > maxPickupRadiusKm) {
        continue;
      }
      pickupScore = Math.max(0, 1 - pickupDistKm / maxPickupRadiusKm);
    }

    let destDistKm: number | null = null;
    let destScore = 1;
    if (query.dest) {
      const rideDest: LatLng = { lat: ride.destLat, lng: ride.destLng };
      const directDestKm = haversineKm(query.dest, rideDest);
      const tailStart = Math.floor(polyline.length / 2);
      const tailPoly = polyline.slice(tailStart);
      const tailDistKm =
        tailPoly.length >= 2
          ? pointToPolylineMinDistanceKm(query.dest, tailPoly)
          : directDestKm;
      destDistKm = Math.min(directDestKm, tailDistKm);

      if (destDistKm > maxDestRadiusKm) {
        continue;
      }
      destScore = Math.max(0, 1 - destDistKm / maxDestRadiusKm);
    }

    let timeDeltaMin: number | null = null;
    let timeScore = 1;
    if (query.desiredDepartureTime) {
      timeDeltaMin = Math.round(
        Math.abs(
          ride.departureTime.getTime() - query.desiredDepartureTime.getTime()
        ) / 60000
      );
      if (timeDeltaMin > windowMinutes) {
        continue;
      }
      timeScore = Math.max(0, 1 - timeDeltaMin / windowMinutes);
    }

    const weightedScore =
      pickupScore * 45 + destScore * 35 + timeScore * 20;

    ranked.push({
      ride,
      matchScore: Math.round(weightedScore),
      pickupDistKm: pickupDistKm !== null ? roundKm(pickupDistKm) : null,
      destDistKm: destDistKm !== null ? roundKm(destDistKm) : null,
      timeDeltaMin,
    });
  }

  ranked.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return (
      a.ride.departureTime.getTime() - b.ride.departureTime.getTime()
    );
  });

  return ranked;
}
