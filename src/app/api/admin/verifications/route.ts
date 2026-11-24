import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, SAFE_USER_SELECT } from "@/lib/auth";

export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  userId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const [pending, reviewed] = await Promise.all([
    prisma.user.findMany({
      where: { idVerificationStatus: "PENDING" },
      select: SAFE_USER_SELECT,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        idVerificationStatus: { in: ["APPROVED", "REJECTED"] },
      },
      select: SAFE_USER_SELECT,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ pending, reviewed });
}

export async function PATCH(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = decisionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { idVerificationStatus: parsed.data.decision },
      select: SAFE_USER_SELECT,
    });

    await prisma.notification.create({
      data: {
        userId: updatedUser.id,
        type: "ID_VERIFICATION",
        title:
          parsed.data.decision === "APPROVED"
            ? "College ID Verified!"
            : "College ID Rejected",
        body:
          parsed.data.decision === "APPROVED"
            ? "Your student ID card was approved. Your Verified badge is now active."
            : "Your student ID upload was rejected. Please re-upload a clearer photo in your Profile.",
        linkUrl: "/profile",
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error: unknown) {
    console.error("Admin verification error:", error);
    return NextResponse.json(
      { error: "Failed to update verification status." },
      { status: 500 }
    );
  }
}
