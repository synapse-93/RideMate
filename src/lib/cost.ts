export type CostVehicleType = "CAR" | "TWO_WHEELER" | "NONE";

export interface FuelSplitEstimate {
  distanceKm: number;
  vehicleType: CostVehicleType;
  petrolRateInrPerLitre: number;
  mileageKmPerLitre: number;
  totalFuelCostInr: number;
  perSeatCostInr: number;
  totalOccupants: number;
}

const PETROL_RATE_INR_PER_LITRE = 103; // Bengaluru reference petrol rate (INR/L)

const VEHICLE_PROFILES: Record<
  CostVehicleType,
  { mileageKmPerLitre: number; upkeepMultiplier: number }
> = {
  CAR: { mileageKmPerLitre: 15, upkeepMultiplier: 1.1 },
  TWO_WHEELER: { mileageKmPerLitre: 45, upkeepMultiplier: 1.05 },
  NONE: { mileageKmPerLitre: 15, upkeepMultiplier: 1.1 },
};

/**
 * Calculates total fuel estimate and fair per-seat INR (₹) split.
 * Driver + offered passenger seats share fuel cost equally (occupants = seats + 1).
 */
export function estimateFuelSplit(
  distanceKm: number,
  vehicleType: CostVehicleType,
  seatsOffered: number
): FuelSplitEstimate {
  const safeDistanceKm = Math.max(0, distanceKm);
  const safeSeats = Math.max(1, Math.min(6, Math.floor(seatsOffered)));
  const profile = VEHICLE_PROFILES[vehicleType];
  const totalOccupants = safeSeats + 1;

  if (safeDistanceKm === 0) {
    return {
      distanceKm: 0,
      vehicleType,
      petrolRateInrPerLitre: PETROL_RATE_INR_PER_LITRE,
      mileageKmPerLitre: profile.mileageKmPerLitre,
      totalFuelCostInr: 0,
      perSeatCostInr: 0,
      totalOccupants,
    };
  }

  const litresUsed = safeDistanceKm / profile.mileageKmPerLitre;
  const rawTotalInr =
    litresUsed * PETROL_RATE_INR_PER_LITRE * profile.upkeepMultiplier;
  const totalFuelCostInr = Math.max(15, Math.round(rawTotalInr));

  // Round per-seat cost to nearest ₹5 for clean student settlement, minimum ₹10
  const rawPerSeat = totalFuelCostInr / totalOccupants;
  const perSeatCostInr = Math.max(10, Math.round(rawPerSeat / 5) * 5);

  return {
    distanceKm: Math.round(safeDistanceKm * 10) / 10,
    vehicleType,
    petrolRateInrPerLitre: PETROL_RATE_INR_PER_LITRE,
    mileageKmPerLitre: profile.mileageKmPerLitre,
    totalFuelCostInr,
    perSeatCostInr,
    totalOccupants,
  };
}

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
