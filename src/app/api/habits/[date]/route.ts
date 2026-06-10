import { NextRequest, NextResponse } from "next/server";
import { USER_ID, HABITS } from "@/lib/config";
import { upsertDailyNotes } from "@/lib/dailyLogs";
import { remember } from "@/lib/memory";

export const dynamic = "force-dynamic";

// POST /api/habits/[date] { done: string[] } — sync a day's habit state.
// [date] is the USER's local date key (Part 8, bug #2) computed client-side.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  let done: string[] = [];
  try {
    ({ done = [] } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const valid = done.filter((h) => HABITS.includes(h));

  const notes = await upsertDailyNotes(date, (n) => {
    n.habits = { done: valid, total: HABITS.length };
    return n;
  });

  if (valid.length === HABITS.length) {
    await remember("habit", null, `Completed all habits on ${date}`);
  }

  return NextResponse.json(
    { ok: true, date, habits: notes.habits },
    { headers: { "cache-control": "no-store" } }
  );
}
