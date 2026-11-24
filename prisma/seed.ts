import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  Gender,
  IdVerificationStatus,
  RideStatus,
  Role,
  VehicleType,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { estimateFuelSplit } from "../src/lib/cost";
import {
  estimateDurationMin,
  polylineLengthKm,
  roundKm,
  serializePolyline,
  type LatLng,
} from "../src/lib/geo";

const DEMO_PASSWORD = "Password123!";

// Clean sample SVG data URL representing a student ID card for Admin queue testing
const SAMPLE_ID_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="240" viewBox="0 0 420 240">
      <rect width="420" height="240" rx="16" fill="#18181b"/>
      <rect x="0" y="0" width="420" height="56" rx="16" fill="#10b981"/>
      <text x="24" y="36" fill="#09090b" font-family="sans-serif" font-size="18" font-weight="bold">COLLEGE STUDENT ID CARD (DEMO)</text>
      <circle cx="72" cy="136" r="36" fill="#27272a" stroke="#10b981" stroke-width="3"/>
      <text x="72" y="143" text-anchor="middle" fill="#e4e4e7" font-family="sans-serif" font-size="22" font-weight="bold">RK</text>
      <text x="132" y="114" fill="#ffffff" font-family="sans-serif" font-size="20" font-weight="bold">Rohan Kulkarni</text>
      <text x="132" y="142" fill="#a1a1aa" font-family="sans-serif" font-size="14">USN: 1CL22CS089</text>
      <text x="132" y="168" fill="#a1a1aa" font-family="sans-serif" font-size="14">Email: rohan.student@college.edu.in</text>
      <text x="132" y="198" fill="#10b981" font-family="sans-serif" font-size="12">VALID FOR CAMPUS COMMUTE VERIFICATION</text>
    </svg>`
  );

function hoursFromNow(hours: number): Date {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + hours);
  return date;
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 1. Seed 5 Demo Accounts (1 Admin, 2 Verified Drivers, 2 Passengers)
  const admin = await prisma.user.upsert({
    where: { email: "admin@rvce.edu.in" },
    update: {
      fullName: "Campus Admin",
      role: Role.ADMIN,
      emailVerified: true,
      idVerificationStatus: IdVerificationStatus.APPROVED,
    },
    create: {
      email: "admin@rvce.edu.in",
      passwordHash,
      fullName: "Campus Admin",
      collegeIdNumber: "RVCE-ADMIN-01",
      gender: Gender.OTHER,
      role: Role.ADMIN,
      emailVerified: true,
      idVerificationStatus: IdVerificationStatus.APPROVED,
      vehicleType: VehicleType.NONE,
      phone: "+91 98450 00001",
      showPhonePrivacy: false,
      emergencyContactName: "Campus Security Desk",
      emergencyContactPhone: "+91 80 6717 8021",
    },
  });

  const driverMale = await prisma.user.upsert({
    where: { email: "aarav.driver@rvce.edu.in" },
    update: {
      fullName: "Aarav Sharma",
      emailVerified: true,
      idVerificationStatus: IdVerificationStatus.APPROVED,
      vehicleType: VehicleType.CAR,
      vehicleModel: "Maruti Suzuki Swift (White)",
      vehiclePlate: "KA-05-MN-4821",
      avgRating: 4.8,
      totalRatings: 12,
    },
    create: {
      email: "aarav.driver@rvce.edu.in",
      passwordHash,
      fullName: "Aarav Sharma",
      collegeIdNumber: "1RV22CS014",
      gender: Gender.MALE,
      role: Role.STUDENT,
      emailVerified: true,
      idVerificationStatus: IdVerificationStatus.APPROVED,
      vehicleType: VehicleType.CAR,
      vehicleModel: "Maruti Suzuki Swift (White)",
      vehiclePlate: "KA-05-MN-4821",
      phone: "+91 98451 11223",
      showPhonePrivacy: true,
      avgRating: 4.8,
      totalRatings: 12,
      emergencyContactName: "Vikram Sharma",
      emergencyContactPhone: "+91 98451 99887",
    },
  });

  const driverFemale = await prisma.user.upsert({
    where: { email: "priya.driver@rvce.edu.in" },
    update: {
      fullName: "Priya Nair",
      emailVerified: true,
      idVerificationStatus: IdVerificationStatus.APPROVED,
      vehicleType: VehicleType.TWO_WHEELER,
      vehicleModel: "Honda Activa 6G (Matte Grey)",
      vehiclePlate: "KA-01-EQ-7392",
      avgRating: 4.9,
      totalRatings: 18,
    },
    create: {
      email: "priya.driver@rvce.edu.in",
      passwordHash,
      fullName: "Priya Nair",
      collegeIdNumber: "1RV22EC042",
      gender: Gender.FEMALE,
      role: Role.STUDENT,
      emailVerified: true,
      idVerificationStatus: IdVerificationStatus.APPROVED,
      vehicleType: VehicleType.TWO_WHEELER,
      vehicleModel: "Honda Activa 6G (Matte Grey)",
      vehiclePlate: "KA-01-EQ-7392",
      phone: "+91 99002 33445",
      showPhonePrivacy: true,
      avgRating: 4.9,
      totalRatings: 18,
      emergencyContactName: "Meera Nair",
      emergencyContactPhone: "+91 99002 77889",
    },
  });

  const passengerFemale = await prisma.user.upsert({
    where: { email: "ananya.student@college.edu.in" },
    update: {
      fullName: "Ananya Rao",
      emailVerified: true,
      idVerificationStatus: IdVerificationStatus.APPROVED,
      avgRating: 4.9,
      totalRatings: 7,
    },
    create: {
      email: "ananya.student@college.edu.in",
      passwordHash,
      fullName: "Ananya Rao",
      collegeIdNumber: "1CL23IS027",
      gender: Gender.FEMALE,
      role: Role.STUDENT,
      emailVerified: true,
      idVerificationStatus: IdVerificationStatus.APPROVED,
      vehicleType: VehicleType.NONE,
      phone: "+91 97400 55667",
      showPhonePrivacy: false,
      avgRating: 4.9,
      totalRatings: 7,
      emergencyContactName: "Suresh Rao",
      emergencyContactPhone: "+91 97400 11223",
    },
  });

  const passengerMale = await prisma.user.upsert({
    where: { email: "rohan.student@college.edu.in" },
    update: {
      fullName: "Rohan Kulkarni",
      emailVerified: true,
    },
    create: {
      email: "rohan.student@college.edu.in",
      passwordHash,
      fullName: "Rohan Kulkarni",
      collegeIdNumber: "1CL22CS089",
      gender: Gender.MALE,
      role: Role.STUDENT,
      emailVerified: true,
      idCardUrl: SAMPLE_ID_SVG,
      idVerificationStatus: IdVerificationStatus.PENDING,
      vehicleType: VehicleType.NONE,
      phone: "+91 96112 77889",
      showPhonePrivacy: true,
      avgRating: 4.7,
      totalRatings: 4,
      emergencyContactName: "Deepak Kulkarni",
      emergencyContactPhone: "+91 96112 44556",
    },
  });

  // 2. Seed 4 Realistic Bengaluru Campus-Corridor Rides
  interface SeedRideSpec {
    id: string;
    driverId: string;
    vehicleType: VehicleType;
    originLabel: string;
    destLabel: string;
    waypoints: LatLng[];
    departureHoursFromNow: number;
    seatsTotal: number;
    womenOnly: boolean;
    notes: string;
  }

  const rideSpecs: SeedRideSpec[] = [
    {
      id: "ride-blr-indiranagar-rvce",
      driverId: driverMale.id,
      vehicleType: VehicleType.CAR,
      originLabel: "Indiranagar Metro Station, 100 Feet Road, Bengaluru",
      destLabel: "RV College of Engineering (RVCE), Mysore Road, Bengaluru",
      waypoints: [
        { lat: 12.9784, lng: 77.6408 }, // Indiranagar Metro
        { lat: 12.9716, lng: 77.5946 }, // MG Road / Cubbon Park
        { lat: 12.9592, lng: 77.5655 }, // Chamrajpet
        { lat: 12.941, lng: 77.5345 }, // Nayandahalli / PESU corridor
        { lat: 12.9237, lng: 77.4987 }, // RVCE Mysore Road
      ],
      departureHoursFromNow: 2,
      seatsTotal: 3,
      womenOnly: false,
      notes: "AC on, leaving sharp on time from Indiranagar Metro Gate B. Quick stops along Mysore Rd.",
    },
    {
      id: "ride-blr-jayanagar-rvce-women",
      driverId: driverFemale.id,
      vehicleType: VehicleType.TWO_WHEELER,
      originLabel: "Jayanagar 4th Block Shopping Complex, Bengaluru",
      destLabel: "RV College of Engineering (RVCE), Mysore Road, Bengaluru",
      waypoints: [
        { lat: 12.925, lng: 77.5938 }, // Jayanagar 4th Block
        { lat: 12.9312, lng: 77.5655 }, // Banashankari / BMSCE corridor
        { lat: 12.9345, lng: 77.5345 }, // PESU Ring Road
        { lat: 12.9288, lng: 77.5152 }, // RR Nagar Arch
        { lat: 12.9237, lng: 77.4987 }, // RVCE Mysore Road
      ],
      departureHoursFromNow: 3,
      seatsTotal: 1,
      womenOnly: true,
      notes: "Women-only pillion ride. Spare ISI helmet provided. Pickup near Cool Joint, Jayanagar.",
    },
    {
      id: "ride-blr-koramangala-pesu",
      driverId: driverMale.id,
      vehicleType: VehicleType.CAR,
      originLabel: "Koramangala Sony World Junction, Bengaluru",
      destLabel: "PES University Ring Road Campus, Banashankari, Bengaluru",
      waypoints: [
        { lat: 12.9352, lng: 77.6245 }, // Koramangala Sony World
        { lat: 12.9177, lng: 77.6238 }, // Silk Board
        { lat: 12.9165, lng: 77.5855 }, // JP Nagar / Jayadeva
        { lat: 12.9255, lng: 77.5562 }, // Banashankari Bus Stand
        { lat: 12.9345, lng: 77.5345 }, // PESU Ring Road
      ],
      departureHoursFromNow: 5,
      seatsTotal: 3,
      womenOnly: false,
      notes: "Taking Outer Ring Road via Jayadeva & Banashankari. Plenty of boot space for laptops/bags.",
    },
    {
      id: "ride-blr-bmsce-ecity-women",
      driverId: driverFemale.id,
      vehicleType: VehicleType.TWO_WHEELER,
      originLabel: "BMS College of Engineering (BMSCE), Basavanagudi, Bengaluru",
      destLabel: "Electronic City Phase 1 Toll Gate, Bengaluru",
      waypoints: [
        { lat: 12.941, lng: 77.5655 }, // BMSCE
        { lat: 12.925, lng: 77.5938 }, // Jayanagar
        { lat: 12.9177, lng: 77.6238 }, // Silk Board
        { lat: 12.8855, lng: 77.6412 }, // Bommanahalli / Elevated Flyover
        { lat: 12.8452, lng: 77.6602 }, // Electronic City Phase 1
      ],
      departureHoursFromNow: 6,
      seatsTotal: 1,
      womenOnly: true,
      notes: "Evening return via Silk Board elevated corridor. Extra helmet ready!",
    },
  ];

  for (const spec of rideSpecs) {
    const origin = spec.waypoints[0];
    const dest = spec.waypoints[spec.waypoints.length - 1];
    // Multiply straight segment polyline length slightly (1.18x) to mirror actual Bengaluru road distance
    const distanceKm = roundKm(polylineLengthKm(spec.waypoints) * 1.18);
    const estimatedDurationMin = estimateDurationMin(distanceKm, 24);
    const cost = estimateFuelSplit(distanceKm, spec.vehicleType, spec.seatsTotal);

    await prisma.ride.upsert({
      where: { id: spec.id },
      update: {
        originLabel: spec.originLabel,
        originLat: origin.lat,
        originLng: origin.lng,
        destLabel: spec.destLabel,
        destLat: dest.lat,
        destLng: dest.lng,
        routePolyline: serializePolyline(spec.waypoints),
        distanceKm,
        estimatedDurationMin,
        departureTime: hoursFromNow(spec.departureHoursFromNow),
        seatsTotal: spec.seatsTotal,
        costPerSeatInr: cost.perSeatCostInr,
        womenOnly: spec.womenOnly,
        notes: spec.notes,
      },
      create: {
        id: spec.id,
        driverId: spec.driverId,
        originLabel: spec.originLabel,
        originLat: origin.lat,
        originLng: origin.lng,
        destLabel: spec.destLabel,
        destLat: dest.lat,
        destLng: dest.lng,
        routePolyline: serializePolyline(spec.waypoints),
        distanceKm,
        estimatedDurationMin,
        departureTime: hoursFromNow(spec.departureHoursFromNow),
        seatsTotal: spec.seatsTotal,
        seatsAvailable: spec.seatsTotal,
        costPerSeatInr: cost.perSeatCostInr,
        womenOnly: spec.womenOnly,
        status: RideStatus.OPEN,
        notes: spec.notes,
      },
    });
  }

  console.log("RideMate seed completed successfully!");
  console.log(
    `Seeded 5 users (admin: ${admin.email}, drivers: ${driverMale.email}, ${driverFemale.email}, passengers: ${passengerFemale.email}, ${passengerMale.email}) and ${rideSpecs.length} Bengaluru campus rides.`
  );
  console.log(`Demo password for all accounts: ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
