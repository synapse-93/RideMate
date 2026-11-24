import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessWomenOnlyRides } from "@/lib/matching";

export const dynamic = "force-dynamic";

const sendMessageSchema = z.object({
  rideId: z.string().min(1),
  receiverId: z.string().min(1).optional(),
  body: z.string().trim().min(1, "Message cannot be empty").max(1000),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rideId = searchParams.get("rideId");
  if (!rideId) {
    return NextResponse.json(
      { error: "rideId query parameter is required." },
      { status: 400 }
    );
  }

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: { id: true, driverId: true, womenOnly: true },
  });

  if (!ride) {
    return NextResponse.json({ error: "Ride not found." }, { status: 404 });
  }

  const isDriver = ride.driverId === user.id;
  const isAdmin = user.role === "ADMIN";

  if (
    ride.womenOnly &&
    !isDriver &&
    !isAdmin &&
    !canAccessWomenOnlyRides(user.gender)
  ) {
    return NextResponse.json(
      { error: "This ride is restricted to female students." },
      { status: 403 }
    );
  }

  // Driver / Admin sees all threads for the ride; riders see messages where they are sender or receiver
  const messages = await prisma.message.findMany({
    where:
      isDriver || isAdmin
        ? { rideId }
        : {
            rideId,
            OR: [{ senderId: user.id }, { receiverId: user.id }],
          },
    include: {
      sender: { select: { id: true, fullName: true } },
      receiver: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 150,
  });

  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = sendMessageSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid message" },
        { status: 400 }
      );
    }

    const { rideId, body } = parsed.data;
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        id: true,
        driverId: true,
        womenOnly: true,
        destLabel: true,
        requests: {
          where: { status: { in: ["PENDING", "ACCEPTED"] } },
          select: { passengerId: true },
        },
      },
    });

    if (!ride) {
      return NextResponse.json({ error: "Ride not found." }, { status: 404 });
    }

    const isDriver = ride.driverId === user.id;
    const isAdmin = user.role === "ADMIN";

    if (
      ride.womenOnly &&
      !isDriver &&
      !isAdmin &&
      !canAccessWomenOnlyRides(user.gender)
    ) {
      return NextResponse.json(
        { error: "This ride is restricted to female students." },
        { status: 403 }
      );
    }

    // Resolve recipient:
    // - Non-driver messaging -> defaults directly to ride.driverId (enables pre-booking questions!)
    // - Driver replying -> uses explicit receiverId, or falls back to latest student who messaged or requested
    let targetReceiverId = parsed.data.receiverId;

    if (!isDriver) {
      targetReceiverId = ride.driverId;
    } else if (!targetReceiverId) {
      const latestInbound = await prisma.message.findFirst({
        where: { rideId, senderId: { not: ride.driverId } },
        orderBy: { createdAt: "desc" },
        select: { senderId: true },
      });
      targetReceiverId =
        latestInbound?.senderId ?? ride.requests[0]?.passengerId;
    }

    if (!targetReceiverId || targetReceiverId === user.id) {
      return NextResponse.json(
        { error: "Select a student to reply to." },
        { status: 400 }
      );
    }

    const receiverExists = await prisma.user.findUnique({
      where: { id: targetReceiverId },
      select: { id: true },
    });
    if (!receiverExists) {
      return NextResponse.json(
        { error: "Recipient not found." },
        { status: 404 }
      );
    }

    const message = await prisma.message.create({
      data: {
        rideId,
        senderId: user.id,
        receiverId: targetReceiverId,
        body,
      },
      include: {
        sender: { select: { id: true, fullName: true } },
        receiver: { select: { id: true, fullName: true } },
      },
    });

    await prisma.notification.create({
      data: {
        userId: targetReceiverId,
        type: "CHAT_MESSAGE",
        title: `New message from ${user.fullName}`,
        body: body.length > 90 ? `${body.slice(0, 87)}…` : body,
        linkUrl: `/rides/${rideId}`,
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/messages error:", error);
    return NextResponse.json(
      { error: "Failed to send message." },
      { status: 500 }
    );
  }
}
