import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      status: "ok",
      db: "connected",
      timestamp,
    });
  } catch (error: unknown) {
    console.error("Health check DB error:", error);
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        db: "error",
        error: "Database unreachable",
        timestamp,
      },
      { status: 503 }
    );
  }
}
