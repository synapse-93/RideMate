import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const sendMessageSchema = z.object({
  rideId: z.string().min(1),
  receiverId: z.string().min(1),
  body: z.string().trim().min(1, "Message cannot be empty").max(1000),
});

async function isRideChatParticipant(
  rideId: string,
  userId: string
): Promise<boolean> {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: {
      driverId: true,
      requests: {
        where: {
          passengerId: userId,
          status: { in: ["PENDING", "ACCEPTED"] },
        },
        select: { id: true },
      },
    },
  });
  if (!ride) return false;
  return ride.driverId === userId || ride.requests.length > 0;
}

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

  const allowed =
    user.role === "ADMIN" || (await isRideChatParticipant(rideId, user.id));
  if (!allowed) {
    return NextResponse.json(
      { error: "Only ride participants can access chat messages." },
      { status: 403 }
    );
  }

  const messages = await prisma.message.findMany({
    where: { rideId },
    include: {
      sender: { select: { id: true, fullName: true } },
      receiver: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
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

    const { rideId, receiverId, body } = parsed.data;
    const senderAllowed = await isRideChatParticipant(rideId, user.id);
    if (!senderAllowed) {
      return NextResponse.json(
        { error: "You must be the driver or an active rider to send messages." },
        { status: 403 }
      );
    }

    const receiverAllowed = await isRideChatParticipant(rideId, receiverId);
    if (!receiverAllowed) {
      return NextResponse.json(
        { error: "Recipient is not an active participant on this ride." },
        { status: 400 }
      );
    }

    const message = await prisma.message.create({
      data: {
        rideId,
        senderId: user.id,
        receiverId,
        body,
      },
      include: {
        sender: { select: { id: true, fullName: true } },
        receiver: { select: { id: true, fullName: true } },
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
