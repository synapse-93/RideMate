import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  generateOtpCode,
  SAFE_USER_SELECT,
  setAuthCookie,
  signAuthToken,
} from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid college email"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json();
    const parsed = loginSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid credentials" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const validPassword = await bcrypt.compare(
      parsed.data.password,
      user.passwordHash
    );
    if (!validPassword) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      const otpCode = generateOtpCode();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpCode,
          otpExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      return NextResponse.json(
        {
          error: "Please verify your college email with the 6-digit OTP first.",
          requiresVerification: true,
          email: user.email,
          demoOtp: otpCode,
        },
        { status: 403 }
      );
    }

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
  } catch (error: unknown) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed. Ensure database is running and seeded." },
      { status: 500 }
    );
  }
}
