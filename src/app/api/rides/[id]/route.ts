import { NextResponse } from "next/server";
import { z } from "zod";
import type { RideStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessWomenOnlyRides } from "@/lib/matching";

export const dynamic = "force-dynamic";

const statusUpdateSchema = z.object({
  status: z.enum(["OPEN", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
});

const ALLOWED_TRANSITIONS: Record<RideStatus, ReadonlyArray<RideStatus>> = {
  OPEN: ["CONFIRMED", "IN_PROGRESS", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();

    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            email: true,
            gender: true,
            idVerificationStatus: true,
            vehicleType: true,
            vehicleModel: true,
            vehiclePlate: true,
            avgRating: true,
            totalRatings: true,
            showPhonePrivacy: true,
            phone: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
          },
        },
        requests: {
          include: {
            passenger: {
              select: {
                id: true,
                fullName: true,
                gender: true,
                idVerificationStatus: true,
                avgRating: true,
                totalRatings: true,
                showPhonePrivacy: true,
                phone: true,
                emergencyContactName: true,
                emergencyContactPhone: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        reviews: {
          include: {
            author: { select: { id: true, fullName: true } },
            target: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        sosEvents: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                emergencyContactName: true,
                emergencyContactPhone: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!ride) {
      return NextResponse.json({ error: "Ride not found." }, { status: 404 });
    }

    const isDriver = user?.id === ride.driverId;
    const isAdmin = user?.role === "ADMIN";
    if (
      ride.womenOnly &&
      !isDriver &&
      !isAdmin &&
      !canAccessWomenOnlyRides(user?.gender)
    ) {
      return NextResponse.json(
        { error: "This ride is restricted to verified female students." },
        { status: 403 }
      );
    }

    const isParticipant =
      isDriver ||
      isAdmin ||
      Boolean(
        user &&
          ride.requests.some(
            (r) =>
              r.passengerId === user.id &&
              (r.status === "ACCEPTED" || r.status === "PENDING")
          )
      );

    // Apply phone privacy toggle strictly
    const sanitizedRide = {
      ...ride,
      driver: {
        ...ride.driver,
        phone:
          isDriver || ride.driver.showPhonePrivacy ? ride.driver.phone : null,
        emergencyContactName: isParticipant
          ? ride.driver.emergencyContactName
          : null,
        emergencyContactPhone: isParticipant
          ? ride.driver.emergencyContactPhone
          : null,
      },
      requests: ride.requests
        .filter((req) => isDriver || isAdmin || req.passengerId === user?.id || req.status === "ACCEPTED")
        .map((req) => ({
          ...req,
          passenger: {
            ...req.passenger,
            phone:
              req.passengerId === user?.id || req.passenger.showPhonePrivacy
                ? req.passenger.phone
                : null,
            emergencyContactName: isParticipant
              ? req.passenger.emergencyContactName
              : null,
            emergencyContactPhone: isParticipant
              ? req.passenger.emergencyContactPhone
              : null,
          },
        })),
    };

    return NextResponse.json({ ride: sanitizedRide });
  } catch (error: unknown) {
    console.error("GET /api/rides/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to load ride details." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const rawBody: unknown = await request.json();
    const parsed = statusUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid status" },
        { status: 400 }
      );
    }

    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        requests: {
          where: { status: { in: ["ACCEPTED", "PENDING"] } },
        },
      },
    });

    if (!ride) {
      return NextResponse.json({ error: "Ride not found." }, { status: 404 });
    }

    if (ride.driverId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only the driver can update ride status." },
        { status: 403 }
      );
    }

    const nextStatus = parsed.data.status;
    if (!ALLOWED_TRANSITIONS[ride.status].includes(nextStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition ride from ${ride.status} to ${nextStatus}.`,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.ride.update({
      where: { id },
      data: { status: nextStatus },
    });

    // Notify passengers on key lifecycle transitions
    const passengerIds = ride.requests.map((r) => r.passengerId);
    if (passengerIds.length > 0) {
      const titles: Record<RideStatus, string> = {
        OPEN: "Ride Reopened",
        CONFIRMED: "Ride Confirmed by Driver",
        IN_PROGRESS: "Ride Started — Live Tracking Active",
        COMPLETED: "Ride Completed — Leave a Review",
        CANCELLED: "Ride Cancelled by Driver",
      };
      const bodies: Record<RideStatus, string> = {
        OPEN: `Your ride to ${ride.destLabel.split(",")[0]} is open.`,
        CONFIRMED: `Driver confirmed the trip to ${ride.destLabel.split(",")[0]}.`,
        IN_PROGRESS: `Your trip to ${ride.destLabel.split(",")[0]} is now in progress. Open the map to track live progress (Demo Simulation).`,
        COMPLETED: `You have arrived at ${ride.destLabel.split(",")[0]}. Rate your co-riders now!`,
        CANCELLED: `The driver cancelled the ride to ${ride.destLabel.split(",")[0]}.`,
      };

      await prisma.notification.createMany({
        data: passengerIds.map((pid) => ({
          userId: pid,
          type: `RIDE_${nextStatus}`,
          title: titles[nextStatus],
          body: bodies[nextStatus],
          linkUrl: `/rides/${ride.id}`,
        })),
      });
    }

    return NextResponse.json({ ride: updated });
  } catch (error: unknown) {
    console.error("PATCH /api/rides/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update ride status." },
      { status: 500 }
    );
  }
}
