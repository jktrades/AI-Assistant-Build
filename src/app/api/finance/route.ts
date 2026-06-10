import { NextRequest, NextResponse } from "next/server";
import { getLatestSnapshot, runFinanceSnapshot } from "@/lib/finance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/finance          → latest snapshot (cheap, no AI)
// GET /api/finance?refresh=1 → manual refresh, triggers the AI pipeline
//
// Critical UX rule (Part 5.8): page loads NEVER trigger AI. Only the explicit
// refresh flag (or the cron) runs the extraction, so page views don't burn the
// API budget.
export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  try {
    if (refresh) {
      const snapshot = await runFinanceSnapshot();
      return NextResponse.json({ snapshot, refreshed: true }, { headers: { "cache-control": "no-store" } });
    }
    const snapshot = await getLatestSnapshot();
    return NextResponse.json({ snapshot }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("[finance] failed:", err);
    return NextResponse.json({ snapshot: null, error: "finance unavailable" }, { status: 500 });
  }
}
