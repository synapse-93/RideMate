import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessWomenOnlyRides } from "@/lib/matching";
import { serializePolyline } from "@/lib/geo";

export const dynamic = "force-dynamic";

const createRideSchema = z.object({
  originLabel: z.string().trim().min(2).max(200),
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  destLabel: z.string().trim().min(2).max(200),
  destLat: z.number().min(-90).max(90),
  destLng: z.number().min(-180).max(180),
  polyline: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
    )
    .min(2),
  distanceKm: z.number().positive().max(1000),
  estimatedDurationMin: z.number().int().positive().max(1440),
  departureTime: z.string().datetime(),
  seatsTotal: z.number().int().min(1).max(6),
  costPerSeatInr: z.number().int().min(0).max(5000),
  womenOnly: z.boolean().default(false),
  notes: z.string().trim().max(400).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const mine = searchParams.get("mine") === "true";

    if (mine) {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const [offered, requested] = await Promise.all([
        prisma.ride.findMany({
          where: { driverId: user.id },
          include: {
            requests: {
              include: {
                passenger: {
                  select: {
                    id: true,
                    fullName: true,
                    idVerificationStatus: true,
                    avgRating: true,
                    phone: true,
                    showPhonePrivacy: true,
                  },
                },
              },
            },
          },
          orderBy: { departureTime: "desc" },
        }),
        prisma.rideRequest.findMany({
          where: { passengerId: user.id },
          include: {
            ride: {
              include: {
                driver: {
                  select: {
                    id: true,
                    fullName: true,
                    vehicleType: true,
                    vehicleModel: true,
                    vehiclePlate: true,
                    idVerificationStatus: true,
                    avgRating: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return NextResponse.json({ offered, requested });
    }

    const allowWomenOnly = canAccessWomenOnlyRides(user?.gender);

    const rides = await prisma.ride.findMany({
      where: {
        status: { in: ["OPEN", "CONFIRMED"] },
        seatsAvailable: { gt: 0 },
        ...(allowWomenOnly ? {} : { womenOnly: false }),
      },
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            gender: true,
            idVerificationStatus: true,
            vehicleType: true,
            vehicleModel: true,
            vehiclePlate: true,
            avgRating: true,
            totalRatings: true,
            showPhonePrivacy: true,
            phone: true,
          },
        },
      },
      orderBy: { departureTime: "asc" },
    });

    const sanitizedRides = rides.map((ride) => ({
      ...ride,
      driver: {
        ...ride.driver,
        phone: ride.driver.showPhonePrivacy ? ride.driver.phone : null,
      },
    }));

    return NextResponse.json({ rides: sanitizedRides });
  } catch (error: unknown) {
    console.error("GET /api/rides error:", error);
    return NextResponse.json(
      { error: "Failed to load rides." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = createRideSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid ride details" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Server-side women-only invariant
    if (data.womenOnly && !canAccessWomenOnlyRides(user.gender)) {
      return NextResponse.json(
        { error: "Only female students may create Women-Only rides." },
        { status: 403 }
      );
    }

    const departureDate = new Date(data.departureTime);
    if (Number.isNaN(departureDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid departure time." },
        { status: 400 }
      );
    }

    const ride = await prisma.ride.create({
      data: {
        driverId: user.id,
        originLabel: data.originLabel,
        originLat: data.originLat,
        originLng: data.originLng,
        destLabel: data.destLabel,
        destLat: data.destLat,
        destLng: data.destLng,
        routePolyline: serializePolyline(data.polyline),
        distanceKm: data.distanceKm,
        estimatedDurationMin: data.estimatedDurationMin,
        departureTime: departureDate,
        seatsTotal: data.seatsTotal,
        seatsAvailable: data.seatsTotal,
        costPerSeatInr: data.costPerSeatInr,
        womenOnly: data.womenOnly,
        notes: data.notes || null,
        status: "OPEN",
      },
    });

    return NextResponse.json({ ride }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/rides error:", error);
    return NextResponse.json(
      { error: "Failed to create ride." },
      { status: 500 }
    );
  }
}
