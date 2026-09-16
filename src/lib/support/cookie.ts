import { SignJWT, jwtVerify } from "jose";

export const SUPPORT_COOKIE = "atlasnow_support";
const DAYS = 14;

function secretKey() {
  const secret = process.env.AUTH_SECRET || "atlasnow-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function signSupportThreadId(threadId: string): Promise<string> {
  return new SignJWT({ threadId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DAYS}d`)
    .sign(secretKey());
}

export async function readSupportThreadId(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.threadId === "string" ? payload.threadId : null;
  } catch {
    return null;
  }
}

export function supportCookieSet(token: string) {
  return {
    name: SUPPORT_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAYS * 24 * 60 * 60,
  };
}
