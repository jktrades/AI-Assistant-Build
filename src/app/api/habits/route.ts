import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, cacheBustLimit } from "@/lib/supabase";
import { USER_ID, HABITS } from "@/lib/config";
import { parseNotes } from "@/lib/dailyLogs";
import { recentDateKeys } from "@/lib/dates";

export const dynamic = "force-dynamic";

// GET /api/habits?days=30 — habit completion per day for the last N days.
export async function GET(req: NextRequest) {
  const days = Math.min(Number(req.nextUrl.searchParams.get("days") || 30), 365);
  const keys = recentDateKeys(days);
  const oldest = keys[keys.length - 1];

  const { data, error } = await supabaseAdmin()
    .from("daily_logs")
    .select("log_date,notes")
    .eq("user_id", USER_ID)
    .gte("log_date", oldest)
    .limit(cacheBustLimit());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byDate: Record<string, { done: string[]; total: number }> = {};
  for (const row of data || []) {
    const notes = parseNotes(row.notes);
    const habits = (notes.habits as { done?: string[] }) || {};
    byDate[row.log_date] = {
      done: Array.isArray(habits.done) ? habits.done : [],
      total: HABITS.length,
    };
  }

  return NextResponse.json(
    { habits: HABITS, days: byDate },
    { headers: { "cache-control": "no-store" } }
  );
}
