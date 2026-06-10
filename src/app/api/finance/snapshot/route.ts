import { NextRequest, NextResponse } from "next/server";
import { runFinanceSnapshot } from "@/lib/finance";
import { constantTimeEquals } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel cron target (vercel.json, daily 5am UTC). Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` automatically. Also reachable manually
// with the same header.
function authorized(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && auth && constantTimeEquals(auth, secret));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const snapshot = await runFinanceSnapshot();
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    console.error("[finance/snapshot] failed:", err);
    return NextResponse.json({ error: "snapshot failed" }, { status: 500 });
  }
}
