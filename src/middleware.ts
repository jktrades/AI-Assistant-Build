import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue, sessionCookie, constantTimeEquals } from "@/lib/auth";

// Routes that bypass the auth gate.
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/telegram", "/api/finance/snapshot"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // Programmatic clients can pass x-api-secret instead of the session cookie.
  const apiSecret = req.headers.get("x-api-secret");
  if (apiSecret && process.env.API_SECRET && constantTimeEquals(apiSecret, process.env.API_SECRET)) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(sessionCookie.name)?.value;
  if (await verifySessionValue(cookie)) return NextResponse.next();

  // API routes get a 401; page routes redirect to /login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals, static assets, and the Telegram
  // webhook. The webhook authenticates itself via the secret_token header, so
  // the auth-gate middleware must never run on it (it would otherwise reject
  // Telegram's cookieless request).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/telegram|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
