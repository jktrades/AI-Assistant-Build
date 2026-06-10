import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE_NAME = "personal_os_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

// HMAC-signed cookie value: `${expiry}.${hmac(expiry)}`. Stateless — no session
// store needed for a single-user dashboard.
export function signSession(): string {
  const expiry = Date.now() + MAX_AGE * 1000;
  const payload = String(expiry);
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySessionValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("hex");
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const expiry = Number(payload);
  return Number.isFinite(expiry) && expiry > Date.now();
}

export function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE,
};

// For use inside Server Components / route handlers (not middleware).
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionValue(store.get(COOKIE_NAME)?.value);
}

// Programmatic access for CLI / cron / capture: an x-api-secret header.
export function hasValidApiSecret(req: NextRequest | Request): boolean {
  const provided =
    (req.headers.get("x-api-secret") || "").trim() ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.API_SECRET;
  if (!expected || !provided) return false;
  return constantTimeEquals(provided, expected);
}

// Guard used by API routes: either a valid session cookie or the API secret.
export async function authorizeRequest(req: NextRequest | Request): Promise<boolean> {
  if (hasValidApiSecret(req)) return true;
  const store = await cookies();
  return verifySessionValue(store.get(COOKIE_NAME)?.value);
}
