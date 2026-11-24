import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT", "CANCEL", "TOGGLE_PAYMENT"]),
});

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
    const parsed = actionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid action" },
        { status: 400 }
      );
    }

    const { action } = parsed.data;

    // Run seat accounting and state changes inside an atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const reqRecord = await tx.rideRequest.findUnique({
        where: { id },
        include: {
          ride: true,
          passenger: { select: { id: true, fullName: true } },
        },
      });

      if (!reqRecord) {
        return { error: "Ride request not found.", status: 404 as const };
      }

      const isDriver = reqRecord.ride.driverId === user.id;
      const isPassenger = reqRecord.passengerId === user.id;

      if (action === "ACCEPT") {
        if (!isDriver) {
          return {
            error: "Only the driver can accept seat requests.",
            status: 403 as const,
          };
        }
        if (reqRecord.status !== "PENDING") {
          return {
            error: "Only pending requests can be accepted.",
            status: 400 as const,
          };
        }
        if (reqRecord.ride.seatsAvailable < 1) {
          return {
            error: "No seats available to accept this request.",
            status: 409 as const,
          };
        }

        const updatedRide = await tx.ride.updateMany({
          where: {
            id: reqRecord.rideId,
            seatsAvailable: { gte: 1 },
          },
          data: {
            seatsAvailable: { decrement: 1 },
          },
        });

        if (updatedRide.count === 0) {
          return {
            error: "Seat was just taken by another request.",
            status: 409 as const,
          };
        }

        const updatedRequest = await tx.rideRequest.update({
          where: { id: reqRecord.id },
          data: { status: "ACCEPTED" },
        });

        await tx.notification.create({
          data: {
            userId: reqRecord.passengerId,
            type: "REQUEST_ACCEPTED",
            title: "Seat Request Accepted!",
            body: `Your seat for ${reqRecord.ride.destLabel.split(",")[0]} has been confirmed.`,
            linkUrl: `/rides/${reqRecord.rideId}`,
          },
        });

        return { request: updatedRequest, status: 200 as const };
      }

      if (action === "REJECT") {
        if (!isDriver) {
          return {
            error: "Only the driver can reject seat requests.",
            status: 403 as const,
          };
        }
        if (reqRecord.status === "REJECTED" || reqRecord.status === "CANCELLED") {
          return {
            error: "Request is already closed.",
            status: 400 as const,
          };
        }

        const wasAccepted = reqRecord.status === "ACCEPTED";
        const updatedRequest = await tx.rideRequest.update({
          where: { id: reqRecord.id },
          data: { status: "REJECTED" },
        });

        if (wasAccepted) {
          await tx.ride.update({
            where: { id: reqRecord.rideId },
            data: { seatsAvailable: { increment: 1 } },
          });
        }

        await tx.notification.create({
          data: {
            userId: reqRecord.passengerId,
            type: "REQUEST_REJECTED",
            title: "Seat Request Declined",
            body: `The driver declined your request for ${reqRecord.ride.destLabel.split(",")[0]}.`,
            linkUrl: `/find`,
          },
        });

        return { request: updatedRequest, status: 200 as const };
      }

      if (action === "CANCEL") {
        if (!isPassenger) {
          return {
            error: "Only the passenger can cancel their request.",
            status: 403 as const,
          };
        }
        if (reqRecord.status === "CANCELLED" || reqRecord.status === "REJECTED") {
          return {
            error: "Request is already closed.",
            status: 400 as const,
          };
        }

        const wasAccepted = reqRecord.status === "ACCEPTED";
        const updatedRequest = await tx.rideRequest.update({
          where: { id: reqRecord.id },
          data: { status: "CANCELLED" },
        });

        if (wasAccepted) {
          await tx.ride.update({
            where: { id: reqRecord.rideId },
            data: { seatsAvailable: { increment: 1 } },
          });
        }

        await tx.notification.create({
          data: {
            userId: reqRecord.ride.driverId,
            type: "REQUEST_CANCELLED",
            title: "Passenger Cancelled Seat",
            body: `${reqRecord.passenger.fullName} cancelled their seat request.`,
            linkUrl: `/rides/${reqRecord.rideId}`,
          },
        });

        return { request: updatedRequest, status: 200 as const };
      }

      // TOGGLE_PAYMENT (Demo Simulation)
      if (!isDriver && !isPassenger) {
        return { error: "Forbidden", status: 403 as const };
      }
      if (reqRecord.status !== "ACCEPTED") {
        return {
          error: "Payment settlement is available for accepted seats only.",
          status: 400 as const,
        };
      }

      const nextPaymentStatus =
        reqRecord.paymentStatus === "SIMULATED_PAID"
          ? "UNPAID"
          : "SIMULATED_PAID";

      const updatedRequest = await tx.rideRequest.update({
        where: { id: reqRecord.id },
        data: { paymentStatus: nextPaymentStatus },
      });

      return { request: updatedRequest, status: 200 as const };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ request: result.request });
  } catch (error: unknown) {
    console.error("PATCH /api/requests/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to process seat request action." },
      { status: 500 }
    );
  }
}
