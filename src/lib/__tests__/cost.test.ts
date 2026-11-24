import { describe, expect, it } from "vitest";
import { estimateFuelSplit, formatInr } from "../cost";

describe("cost.ts — INR fuel-cost split calculator", () => {
  it("returns zero cost when distance is 0 km", () => {
    const res = estimateFuelSplit(0, "CAR", 3);
    expect(res.totalFuelCostInr).toBe(0);
    expect(res.perSeatCostInr).toBe(0);
    expect(res.totalOccupants).toBe(4);
  });

  it("computes lower fuel cost for a TWO_WHEELER than a CAR over the same distance", () => {
    const car = estimateFuelSplit(18, "CAR", 3);
    const scooter = estimateFuelSplit(18, "TWO_WHEELER", 1);

    expect(car.totalFuelCostInr).toBeGreaterThan(scooter.totalFuelCostInr);
    expect(car.perSeatCostInr).toBeGreaterThanOrEqual(10);
    expect(scooter.perSeatCostInr).toBeGreaterThanOrEqual(10);
  });

  it("reduces per-seat cost as more passengers split a car ride", () => {
    const oneSeat = estimateFuelSplit(20, "CAR", 1);
    const threeSeats = estimateFuelSplit(20, "CAR", 3);
    expect(threeSeats.perSeatCostInr).toBeLessThan(oneSeat.perSeatCostInr);
    expect(threeSeats.totalOccupants).toBe(4);
  });

  it("formats Indian Rupees cleanly with ₹ symbol", () => {
    expect(formatInr(45)).toBe("₹45");
    expect(formatInr(1250)).toBe("₹1,250");
  });
});
