import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  generateOtpCode,
  getAllowedCollegeDomains,
  isAllowedCollegeEmail,
  SAFE_USER_SELECT,
} from "@/lib/auth";

const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
  fullName: z.string().trim().min(2, "Full name is required").max(80),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  collegeIdNumber: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(24).optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json();
    const parsed = registerSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    if (!isAllowedCollegeEmail(email)) {
      const allowed = getAllowedCollegeDomains().join(", ");
      return NextResponse.json(
        {
          error: `Please use an approved college email domain (${allowed}).`,
        },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this college email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const otpCode = generateOtpCode();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: parsed.data.fullName,
        gender: parsed.data.gender,
        collegeIdNumber: parsed.data.collegeIdNumber || null,
        phone: parsed.data.phone || null,
        emailVerified: false,
        otpCode,
        otpExpiresAt,
      },
      select: SAFE_USER_SELECT,
    });

    return NextResponse.json(
      {
        user,
        demoOtp: otpCode,
        message:
          "Account created! Enter the 6-digit demo OTP shown below to verify your college email.",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Unable to complete registration. Check database connectivity." },
      { status: 500 }
    );
  }
}
