import { NextResponse } from "next/server";
import { signSession, sessionCookie, constantTimeEquals } from "@/lib/auth";

export async function POST(req: Request) {
  let password = "";
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }
  if (!password || !constantTimeEquals(password, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, await signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionCookie.maxAge,
  });
  return res;
}
