import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, SAFE_USER_SELECT } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_ID_DATA_URL_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_ID_CARD_BYTES = 500 * 1024; // 500 KB

function isWithinMaxBase64Bytes(dataUrl: string, maxBytes: number): boolean {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return false;
  const base64Body = dataUrl.slice(commaIdx + 1);
  const padding = base64Body.endsWith("==") ? 2 : base64Body.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((base64Body.length * 3) / 4) - padding;
  return decodedBytes > 0 && decodedBytes <= maxBytes;
}

const profilePatchSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  collegeIdNumber: z.string().trim().max(40).nullable().optional(),
  phone: z.string().trim().max(24).nullable().optional(),
  showPhonePrivacy: z.boolean().optional(),
  vehicleType: z.enum(["TWO_WHEELER", "CAR", "NONE"]).optional(),
  vehicleModel: z.string().trim().max(80).nullable().optional(),
  vehiclePlate: z.string().trim().max(24).nullable().optional(),
  emergencyContactName: z.string().trim().max(80).nullable().optional(),
  emergencyContactPhone: z.string().trim().max(24).nullable().optional(),
  idCardUrl: z
    .string()
    .max(700_000, "ID image must be smaller than 500 KB")
    .refine(
      (val) => ALLOWED_ID_DATA_URL_REGEX.test(val),
      "College ID must be a valid PNG, JPEG, or WebP base64 image"
    )
    .refine(
      (val) => isWithinMaxBase64Bytes(val, MAX_ID_CARD_BYTES),
      "ID image exceeds the 500 KB size limit"
    )
    .optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = profilePatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid profile data" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updated = await prisma.user.update({
      where: { id: current.id },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.collegeIdNumber !== undefined
          ? { collegeIdNumber: data.collegeIdNumber }
          : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.showPhonePrivacy !== undefined
          ? { showPhonePrivacy: data.showPhonePrivacy }
          : {}),
        ...(data.vehicleType !== undefined
          ? { vehicleType: data.vehicleType }
          : {}),
        ...(data.vehicleModel !== undefined
          ? { vehicleModel: data.vehicleModel }
          : {}),
        ...(data.vehiclePlate !== undefined
          ? { vehiclePlate: data.vehiclePlate }
          : {}),
        ...(data.emergencyContactName !== undefined
          ? { emergencyContactName: data.emergencyContactName }
          : {}),
        ...(data.emergencyContactPhone !== undefined
          ? { emergencyContactPhone: data.emergencyContactPhone }
          : {}),
        ...(data.idCardUrl !== undefined
          ? {
              idCardUrl: data.idCardUrl,
              idVerificationStatus: "PENDING",
            }
          : {}),
      },
      select: SAFE_USER_SELECT,
    });

    return NextResponse.json({ user: updated });
  } catch (error: unknown) {
    console.error("Profile patch error:", error);
    return NextResponse.json(
      { error: "Failed to update profile." },
      { status: 500 }
    );
  }
}
