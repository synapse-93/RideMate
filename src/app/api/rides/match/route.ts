import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  canAccessWomenOnlyRides,
  scoreAndRankRides,
} from "@/lib/matching";

export const dynamic = "force-dynamic";

const matchRequestSchema = z.object({
  origin: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  dest: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  departureTime: z.string().datetime().optional(),
  windowMinutes: z.number().int().min(10).max(720).default(60),
  maxPickupRadiusKm: z.number().min(0.5).max(50).default(5),
  womenOnly: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const rawBody: unknown = await request.json();
    const parsed = matchRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid search parameters" },
        { status: 400 }
      );
    }

    const params = parsed.data;
    const allowWomenOnly = canAccessWomenOnlyRides(user?.gender);

    // Server-side guard: non-female users cannot filter for or receive womenOnly rides
    if (params.womenOnly && !allowWomenOnly) {
      return NextResponse.json({
        matches: [],
        womenOnlyEligible: false,
      });
    }

    const candidates = await prisma.ride.findMany({
      where: {
        status: { in: ["OPEN", "CONFIRMED"] },
        seatsAvailable: { gt: 0 },
        ...(allowWomenOnly
          ? params.womenOnly
            ? { womenOnly: true }
            : {}
          : { womenOnly: false }),
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

    const ranked = scoreAndRankRides(
      candidates,
      {
        origin: params.origin,
        dest: params.dest,
        desiredDepartureTime: params.departureTime
          ? new Date(params.departureTime)
          : undefined,
        windowMinutes: params.windowMinutes,
        maxPickupRadiusKm: params.maxPickupRadiusKm,
        womenOnly: params.womenOnly,
      },
      user?.gender ?? null
    );

    const matches = ranked.map((entry) => ({
      matchScore: entry.matchScore,
      pickupDistKm: entry.pickupDistKm,
      destDistKm: entry.destDistKm,
      timeDeltaMin: entry.timeDeltaMin,
      ride: {
        ...entry.ride,
        driver: {
          ...entry.ride.driver,
          phone: entry.ride.driver.showPhonePrivacy
            ? entry.ride.driver.phone
            : null,
        },
      },
    }));

    return NextResponse.json({
      matches,
      womenOnlyEligible: allowWomenOnly,
    });
  } catch (error: unknown) {
    console.error("POST /api/rides/match error:", error);
    return NextResponse.json(
      { error: "Failed to match rides." },
      { status: 500 }
    );
  }
}
