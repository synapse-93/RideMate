import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const reportUpdateSchema = z.object({
  reportId: z.string().min(1),
  status: z.enum(["REVIEWED", "DISMISSED"]),
});

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const reports = await prisma.report.findMany({
    include: {
      reporter: {
        select: { id: true, fullName: true, email: true },
      },
      reportedUser: {
        select: { id: true, fullName: true, email: true, avgRating: true },
      },
      ride: {
        select: { id: true, originLabel: true, destLabel: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ reports });
}

export async function PATCH(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = reportUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid report update" },
        { status: 400 }
      );
    }

    const updated = await prisma.report.update({
      where: { id: parsed.data.reportId },
      data: { status: parsed.data.status },
    });

    return NextResponse.json({ report: updated });
  } catch (error: unknown) {
    console.error("Admin report update error:", error);
    return NextResponse.json(
      { error: "Failed to update report." },
      { status: 500 }
    );
  }
}
