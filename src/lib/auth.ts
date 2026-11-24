import { cookies } from "next/headers";
import type {
  Gender,
  IdVerificationStatus,
  Role,
  VehicleType,
} from "@prisma/client";
import { prisma } from "./prisma";
import {
  AUTH_COOKIE_NAME,
  TOKEN_TTL_SECONDS,
  signAuthToken,
  verifyAuthToken,
  type AuthTokenPayload,
} from "./jwt";

export { AUTH_COOKIE_NAME, signAuthToken, verifyAuthToken };
export type { AuthTokenPayload };

export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  collegeIdNumber: string | null;
  gender: Gender;
  role: Role;
  emailVerified: boolean;
  idCardUrl: string | null;
  idVerificationStatus: IdVerificationStatus;
  vehicleType: VehicleType;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  showPhonePrivacy: boolean;
  phone: string | null;
  avgRating: number;
  totalRatings: number;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  createdAt: Date;
}

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  collegeIdNumber: true,
  gender: true,
  role: true,
  emailVerified: true,
  idCardUrl: true,
  idVerificationStatus: true,
  vehicleType: true,
  vehicleModel: true,
  vehiclePlate: true,
  showPhonePrivacy: true,
  phone: true,
  avgRating: true,
  totalRatings: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  createdAt: true,
} as const;

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const verified = await verifyAuthToken(token);
  if (!verified) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: SAFE_USER_SELECT,
  });

  return user;
}

export function getAllowedCollegeDomains(): string[] {
  const raw = process.env.ALLOWED_COLLEGE_DOMAINS ?? "rvce.edu.in,college.edu.in";
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);
}

export function isAllowedCollegeEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const parts = normalized.split("@");
  if (parts.length !== 2 || parts[0].length === 0) {
    return false;
  }
  const domain = parts[1];
  const allowed = getAllowedCollegeDomains();
  return allowed.includes(domain);
}

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
