import { describe, expect, it } from "vitest";
import {
  estimateDurationMin,
  haversineKm,
  interpolateAlongPolyline,
  parsePolyline,
  pointToPolylineMinDistanceKm,
  pointToSegmentDistanceKm,
  serializePolyline,
  type LatLng,
} from "../geo";

describe("geo.ts — metric distance & polyline math", () => {
  const rvce: LatLng = { lat: 12.9237, lng: 77.4987 };
  const indiranagar: LatLng = { lat: 12.9784, lng: 77.6408 };
  const pesu: LatLng = { lat: 12.9345, lng: 77.5345 };

  it("returns 0 km for identical coordinates", () => {
    expect(haversineKm(rvce, rvce)).toBe(0);
  });

  it("computes realistic km distance between Indiranagar and RVCE symmetrically", () => {
    const ab = haversineKm(indiranagar, rvce);
    const ba = haversineKm(rvce, indiranagar);
    expect(ab).toBeGreaterThan(15);
    expect(ab).toBeLessThan(18);
    expect(Math.abs(ab - ba)).toBeLessThan(0.0001);
  });

  it("computes near-zero distance for a point lying directly on a polyline segment", () => {
    const mid: LatLng = {
      lat: (rvce.lat + indiranagar.lat) / 2,
      lng: (rvce.lng + indiranagar.lng) / 2,
    };
    const distKm = pointToSegmentDistanceKm(mid, rvce, indiranagar);
    expect(distKm).toBeLessThan(0.05);
  });

  it("computes accurate minimum km distance from a pickup point to a multi-point corridor", () => {
    const corridor: LatLng[] = [
      indiranagar,
      { lat: 12.9592, lng: 77.5655 },
      pesu,
      rvce,
    ];
    // Point very close to PESU waypoint
    const nearPesu: LatLng = { lat: 12.9355, lng: 77.5355 };
    const farPoint: LatLng = { lat: 13.1986, lng: 77.7066 }; // Kempegowda Airport

    expect(pointToPolylineMinDistanceKm(nearPesu, corridor)).toBeLessThan(0.2);
    expect(pointToPolylineMinDistanceKm(farPoint, corridor)).toBeGreaterThan(20);
    expect(pointToPolylineMinDistanceKm(nearPesu, [])).toBe(
      Number.POSITIVE_INFINITY
    );
  });

  it("round-trips serialized polylines safely and ignores malformed input", () => {
    const pts: LatLng[] = [indiranagar, pesu, rvce];
    const encoded = serializePolyline(pts);
    const decoded = parsePolyline(encoded);
    expect(decoded).toHaveLength(3);
    expect(decoded[0].lat).toBeCloseTo(indiranagar.lat, 4);
    expect(parsePolyline("not-json")).toEqual([]);
  });

  it("interpolates smoothly along a polyline and estimates metric duration", () => {
    const poly: LatLng[] = [
      { lat: 12.9, lng: 77.5 },
      { lat: 12.9, lng: 77.6 },
    ];
    const mid = interpolateAlongPolyline(poly, 0.5);
    expect(mid.lat).toBeCloseTo(12.9, 4);
    expect(mid.lng).toBeCloseTo(77.55, 3);
    expect(estimateDurationMin(12, 24)).toBe(30);
    expect(estimateDurationMin(0, 24)).toBe(0);
  });
});
