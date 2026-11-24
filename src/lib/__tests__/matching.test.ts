import { describe, expect, it } from "vitest";
import {
  canAccessWomenOnlyRides,
  filterWomenOnlyVisibility,
  scoreAndRankRides,
  type MatchableRide,
} from "../matching";
import { serializePolyline } from "../geo";

function makeRide(overrides: Partial<MatchableRide> = {}): MatchableRide {
  return {
    id: "ride-1",
    originLat: 12.9784,
    originLng: 77.6408,
    destLat: 12.9237,
    destLng: 77.4987,
    routePolyline: serializePolyline([
      { lat: 12.9784, lng: 77.6408 },
      { lat: 12.9345, lng: 77.5345 },
      { lat: 12.9237, lng: 77.4987 },
    ]),
    departureTime: new Date("2026-11-24T09:00:00.000Z"),
    seatsAvailable: 2,
    womenOnly: false,
    status: "OPEN",
    ...overrides,
  };
}

describe("matching.ts — compatibility ranking & server-side women-only guard", () => {
  it("grants women-only access exclusively to FEMALE users", () => {
    expect(canAccessWomenOnlyRides("FEMALE")).toBe(true);
    expect(canAccessWomenOnlyRides("MALE")).toBe(false);
    expect(canAccessWomenOnlyRides("OTHER")).toBe(false);
    expect(canAccessWomenOnlyRides(null)).toBe(false);
    expect(canAccessWomenOnlyRides(undefined)).toBe(false);
  });

  it("strictly hides womenOnly rides from male, other, and unauthenticated users", () => {
    const rides = [
      makeRide({ id: "open-all", womenOnly: false }),
      makeRide({ id: "women-only", womenOnly: true }),
    ];

    expect(filterWomenOnlyVisibility(rides, "MALE").map((r) => r.id)).toEqual([
      "open-all",
    ]);
    expect(filterWomenOnlyVisibility(rides, "OTHER").map((r) => r.id)).toEqual([
      "open-all",
    ]);
    expect(filterWomenOnlyVisibility(rides, null).map((r) => r.id)).toEqual([
      "open-all",
    ]);
    expect(filterWomenOnlyVisibility(rides, "FEMALE").map((r) => r.id)).toEqual(
      ["open-all", "women-only"]
    );
  });

  it("returns empty list if a non-female requester explicitly queries womenOnly: true", () => {
    const rides = [makeRide({ id: "w1", womenOnly: true })];
    const maleResult = scoreAndRankRides(rides, { womenOnly: true }, "MALE");
    const femaleResult = scoreAndRankRides(rides, { womenOnly: true }, "FEMALE");

    expect(maleResult).toHaveLength(0);
    expect(femaleResult).toHaveLength(1);
  });

  it("ranks rides with closer pickup, destination, and departure time higher", () => {
    const closeRide = makeRide({
      id: "close-fast",
      departureTime: new Date("2026-11-24T09:05:00.000Z"),
    });
    const furtherRide = makeRide({
      id: "further-later",
      originLat: 13.0,
      originLng: 77.65,
      routePolyline: serializePolyline([
        { lat: 13.0, lng: 77.65 },
        { lat: 12.95, lng: 77.52 },
        { lat: 12.9237, lng: 77.4987 },
      ]),
      departureTime: new Date("2026-11-24T09:50:00.000Z"),
    });
    const fullRide = makeRide({ id: "full", seatsAvailable: 0 });
    const completedRide = makeRide({ id: "done", status: "COMPLETED" });

    const ranked = scoreAndRankRides(
      [furtherRide, fullRide, completedRide, closeRide],
      {
        origin: { lat: 12.9348, lng: 77.5349 }, // Right next to PESU on closeRide polyline
        dest: { lat: 12.9237, lng: 77.4987 }, // RVCE
        desiredDepartureTime: new Date("2026-11-24T09:00:00.000Z"),
        windowMinutes: 60,
        maxPickupRadiusKm: 5,
      },
      "MALE"
    );

    expect(ranked.map((r) => r.ride.id)).toEqual(["close-fast", "further-later"]);
    expect(ranked[0].matchScore).toBeGreaterThan(ranked[1].matchScore);
    expect(ranked[0].pickupDistKm).toBeLessThan(0.5);
  });
});
