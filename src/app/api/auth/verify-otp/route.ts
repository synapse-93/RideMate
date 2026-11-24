import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  SAFE_USER_SELECT,
  setAuthCookie,
  signAuthToken,
} from "@/lib/auth";

const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().length(6, "OTP must be 6 digits"),
});

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json();
    const parsed = verifyOtpSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid OTP payload" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        { error: "No account found for this email." },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      const token = await signAuthToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        gender: user.gender,
      });
      await setAuthCookie(token);
      const safeUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: SAFE_USER_SELECT,
      });
      return NextResponse.json({ user: safeUser });
    }

    if (
      !user.otpCode ||
      user.otpCode !== parsed.data.otp ||
      !user.otpExpiresAt ||
      user.otpExpiresAt.getTime() < Date.now()
    ) {
      return NextResponse.json(
        { error: "Invalid or expired 6-digit OTP code." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        otpCode: null,
        otpExpiresAt: null,
      },
      select: SAFE_USER_SELECT,
    });

    const token = await signAuthToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      gender: updatedUser.gender,
    });
    await setAuthCookie(token);

    return NextResponse.json({ user: updatedUser });
  } catch (error: unknown) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Failed to verify OTP." },
      { status: 500 }
    );
  }
}
