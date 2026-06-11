import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE_NAME = "personal_os_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

const encoder = new TextEncoder();

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// HMAC-SHA256 via the Web Crypto API so this runs on the Edge runtime
// (Next.js middleware) as well as Node — Node's `crypto` module is unavailable
// on Edge.
async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bufToHex(sig);
}

// Constant-time string comparison (no Node `crypto.timingSafeEqual` on Edge).
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// HMAC-signed cookie value: `${expiry}.${hmac(expiry)}`. Stateless — no session
// store needed for a single-user dashboard.
export async function signSession(): Promise<string> {
  const expiry = Date.now() + MAX_AGE * 1000;
  const payload = String(expiry);
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionValue(
  value: string | undefined | null
): Promise<boolean> {
  if (!value) return false;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = await hmac(payload);
  if (!constantTimeEquals(sig, expected)) return false;
  const expiry = Number(payload);
  return Number.isFinite(expiry) && expiry > Date.now();
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
