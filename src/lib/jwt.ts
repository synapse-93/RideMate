import { SignJWT, jwtVerify } from "jose";

export const AUTH_COOKIE_NAME = "ridemate_token";
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type JwtRole = "STUDENT" | "ADMIN";
export type JwtGender = "MALE" | "FEMALE" | "OTHER";

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: JwtRole;
  gender: JwtGender;
}

function getJwtSecretBytes(): Uint8Array {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (!envSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET environment variable is required in production."
      );
    }
    return new TextEncoder().encode(
      "ridemate-dev-super-secret-jwt-key-change-in-prod-32chars"
    );
  }
  return new TextEncoder().encode(envSecret);
}

export async function signAuthToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    gender: payload.gender,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecretBytes());
}

export async function verifyAuthToken(
  token: string
): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes());
    const userId = payload.sub;
    const email = payload.email;
    const role = payload.role;
    const gender = payload.gender;

    if (
      typeof userId !== "string" ||
      typeof email !== "string" ||
      (role !== "STUDENT" && role !== "ADMIN") ||
      (gender !== "MALE" && gender !== "FEMALE" && gender !== "OTHER")
    ) {
      return null;
    }

    return { userId, email, role, gender };
  } catch {
    return null;
  }
}
