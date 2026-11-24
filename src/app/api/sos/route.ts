import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const createSosSchema = z.object({
  rideId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  note: z.string().trim().max(300).optional(),
});

const resolveSosSchema = z.object({
  sosId: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = createSosSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid SOS payload" },
        { status: 400 }
      );
    }

    const { rideId, lat, lng, note } = parsed.data;
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        requests: {
          where: { status: { in: ["ACCEPTED", "PENDING"] } },
          select: { passengerId: true },
        },
      },
    });

    if (!ride) {
      return NextResponse.json({ error: "Ride not found." }, { status: 404 });
    }

    const participantIds = new Set<string>([
      ride.driverId,
      ...ride.requests.map((r) => r.passengerId),
    ]);

    if (!participantIds.has(user.id) && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only active ride participants can trigger SOS." },
        { status: 403 }
      );
    }

    const sosEvent = await prisma.sosEvent.create({
      data: {
        rideId,
        userId: user.id,
        lat,
        lng,
        note: note || "Simulated SOS triggered during active ride.",
      },
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
    });

    // Notify all other participants + campus admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    const notifyTargets = new Set<string>([
      ...participantIds,
      ...admins.map((a) => a.id),
    ]);
    notifyTargets.delete(user.id);

    if (notifyTargets.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(notifyTargets).map((targetId) => ({
          userId: targetId,
          type: "SOS_ALERT",
          title: "SOS Alert Triggered (Demo Simulation)",
          body: `${user.fullName} triggered an SOS alert at (${lat.toFixed(4)}, ${lng.toFixed(4)}).`,
          linkUrl: `/rides/${rideId}`,
        })),
      });
    }

    return NextResponse.json({ sosEvent }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/sos error:", error);
    return NextResponse.json(
      { error: "Failed to log SOS event." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = resolveSosSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid SOS id" }, { status: 400 });
    }

    const updated = await prisma.sosEvent.update({
      where: { id: parsed.data.sosId },
      data: { resolved: true },
    });

    return NextResponse.json({ sosEvent: updated });
  } catch (error: unknown) {
    console.error("PATCH /api/sos error:", error);
    return NextResponse.json(
      { error: "Failed to resolve SOS event." },
      { status: 500 }
    );
  }
}
