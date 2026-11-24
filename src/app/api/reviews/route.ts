import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const createReviewSchema = z.object({
  rideId: z.string().min(1),
  targetId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(400).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = createReviewSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid review input" },
        { status: 400 }
      );
    }

    const { rideId, targetId, rating, comment } = parsed.data;
    if (targetId === user.id) {
      return NextResponse.json(
        { error: "You cannot review yourself." },
        { status: 400 }
      );
    }

    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        requests: {
          where: { status: "ACCEPTED" },
          select: { passengerId: true },
        },
      },
    });

    if (!ride) {
      return NextResponse.json({ error: "Ride not found." }, { status: 404 });
    }

    if (ride.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Reviews can be submitted once the ride is completed." },
        { status: 400 }
      );
    }

    const participants = new Set<string>([
      ride.driverId,
      ...ride.requests.map((r) => r.passengerId),
    ]);

    if (!participants.has(user.id) || !participants.has(targetId)) {
      return NextResponse.json(
        { error: "Only confirmed participants of this ride can review each other." },
        { status: 403 }
      );
    }

    // Atomically upsert review and recalculate target user's avgRating & totalRatings
    const review = await prisma.$transaction(async (tx) => {
      const saved = await tx.review.upsert({
        where: {
          rideId_authorId_targetId: {
            rideId,
            authorId: user.id,
            targetId,
          },
        },
        update: {
          rating,
          comment: comment || null,
        },
        create: {
          rideId,
          authorId: user.id,
          targetId,
          rating,
          comment: comment || null,
        },
        include: {
          author: { select: { id: true, fullName: true } },
          target: { select: { id: true, fullName: true } },
        },
      });

      const stats = await tx.review.aggregate({
        where: { targetId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const avg = stats._avg.rating ?? 0;
      const count = stats._count.rating;

      await tx.user.update({
        where: { id: targetId },
        data: {
          avgRating: Math.round(avg * 10) / 10,
          totalRatings: count,
        },
      });

      return saved;
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/reviews error:", error);
    return NextResponse.json(
      { error: "Failed to submit review." },
      { status: 500 }
    );
  }
}
