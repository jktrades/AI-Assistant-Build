import { NextRequest, NextResponse } from "next/server";
import { USER_ID, GOALS_SENTINEL_DATE } from "@/lib/config";
import { getDailyLog, upsertDailyNotes } from "@/lib/dailyLogs";
import { GoalItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// Goals live on a SENTINEL date so they never auto-clear at week/month
// boundaries (Part 5.7). Two lists on one row: week + month.

export async function GET() {
  const log = await getDailyLog(GOALS_SENTINEL_DATE);
  const notes = log?.notes || {};
  return NextResponse.json(
    {
      week: (notes.goals_week_items as GoalItem[]) || [],
      month: (notes.goals_month_items as GoalItem[]) || [],
    },
    { headers: { "cache-control": "no-store" } }
  );
}

// POST /api/goals { scope: 'week'|'month', items: GoalItem[] }
export async function POST(req: NextRequest) {
  let scope: "week" | "month" = "week";
  let items: GoalItem[] = [];
  try {
    ({ scope, items = [] } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (scope !== "week" && scope !== "month") {
    return NextResponse.json({ error: "bad scope" }, { status: 400 });
  }
  const key = scope === "week" ? "goals_week_items" : "goals_month_items";
  await upsertDailyNotes(GOALS_SENTINEL_DATE, (n) => {
    n[key] = items;
    return n;
  });
  return NextResponse.json({ ok: true });
}
