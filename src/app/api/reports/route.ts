import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const createReportSchema = z.object({
  reportedUserId: z.string().min(1),
  rideId: z.string().min(1).optional(),
  reason: z.string().trim().min(3, "Select or enter a reason").max(120),
  details: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = createReportSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid report input" },
        { status: 400 }
      );
    }

    const { reportedUserId, rideId, reason, details } = parsed.data;
    if (reportedUserId === user.id) {
      return NextResponse.json(
        { error: "You cannot report yourself." },
        { status: 400 }
      );
    }

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        reportedUserId,
        rideId: rideId ?? null,
        reason,
        details: details || null,
        status: "OPEN",
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/reports error:", error);
    return NextResponse.json(
      { error: "Failed to submit report." },
      { status: 500 }
    );
  }
}
