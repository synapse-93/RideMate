import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessWomenOnlyRides } from "@/lib/matching";

export const dynamic = "force-dynamic";

const createRequestSchema = z.object({
  rideId: z.string().min(1),
  pickupLabel: z.string().trim().min(2).max(200),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = createRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid pickup details" },
        { status: 400 }
      );
    }

    const { rideId, pickupLabel, pickupLat, pickupLng } = parsed.data;
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });

    if (!ride) {
      return NextResponse.json({ error: "Ride not found." }, { status: 404 });
    }

    if (ride.driverId === user.id) {
      return NextResponse.json(
        { error: "You cannot request a seat on your own ride." },
        { status: 400 }
      );
    }

    // Server-side women-only guard
    if (ride.womenOnly && !canAccessWomenOnlyRides(user.gender)) {
      return NextResponse.json(
        { error: "Only verified female students can request Women-Only rides." },
        { status: 403 }
      );
    }

    if (ride.status !== "OPEN" && ride.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "This ride is no longer accepting seat requests." },
        { status: 400 }
      );
    }

    if (ride.seatsAvailable < 1) {
      return NextResponse.json(
        { error: "No seats remaining on this ride." },
        { status: 400 }
      );
    }

    const existing = await prisma.rideRequest.findUnique({
      where: {
        rideId_passengerId: { rideId, passengerId: user.id },
      },
    });

    if (
      existing &&
      (existing.status === "PENDING" || existing.status === "ACCEPTED")
    ) {
      return NextResponse.json(
        { error: "You already have an active request for this ride." },
        { status: 409 }
      );
    }

    const rideRequest = existing
      ? await prisma.rideRequest.update({
          where: { id: existing.id },
          data: {
            pickupLabel,
            pickupLat,
            pickupLng,
            status: "PENDING",
          },
        })
      : await prisma.rideRequest.create({
          data: {
            rideId,
            passengerId: user.id,
            pickupLabel,
            pickupLat,
            pickupLng,
            status: "PENDING",
          },
        });

    await prisma.notification.create({
      data: {
        userId: ride.driverId,
        type: "RIDE_REQUEST",
        title: "New Seat Request",
        body: `${user.fullName} requested a seat with pickup at ${pickupLabel.split(",")[0]}.`,
        linkUrl: `/rides/${ride.id}`,
      },
    });

    return NextResponse.json({ request: rideRequest }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/requests error:", error);
    return NextResponse.json(
      { error: "Failed to submit seat request." },
      { status: 500 }
    );
  }
}
