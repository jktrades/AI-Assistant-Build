import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, cacheBustLimit } from "@/lib/supabase";
import { USER_ID } from "@/lib/config";
import { parseNotes, upsertDailyNotes } from "@/lib/dailyLogs";
import { recentDateKeys, todayKey } from "@/lib/dates";
import { remember } from "@/lib/memory";

export const dynamic = "force-dynamic";

interface JournalEntry {
  t: number;
  text: string;
}

// GET /api/journal?days=30 — journal entries grouped by day.
export async function GET(req: NextRequest) {
  const days = Math.min(Number(req.nextUrl.searchParams.get("days") || 30), 365);
  const keys = recentDateKeys(days);
  const oldest = keys[keys.length - 1];

  const { data, error } = await supabaseAdmin()
    .from("daily_logs")
    .select("log_date,notes,mood")
    .eq("user_id", USER_ID)
    .gte("log_date", oldest)
    .limit(cacheBustLimit());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out = (data || [])
    .map((row) => {
      const notes = parseNotes(row.notes);
      const entries = Array.isArray(notes.journal) ? (notes.journal as JournalEntry[]) : [];
      return { date: row.log_date, mood: row.mood, entries };
    })
    .filter((d) => d.entries.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ days: out }, { headers: { "cache-control": "no-store" } });
}

// POST /api/journal { text, mood? } — append a journal entry to today.
export async function POST(req: NextRequest) {
  let text = "";
  let mood: string | undefined;
  try {
    ({ text, mood } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

  const date = todayKey();
  await upsertDailyNotes(date, (n) => {
    const journal = Array.isArray(n.journal) ? (n.journal as JournalEntry[]) : [];
    journal.push({ t: Date.now(), text: text.trim() });
    n.journal = journal;
    if (mood) n.mood = mood;
    return n;
  });
  await remember("journal", null, text.trim());
  return NextResponse.json({ ok: true });
}
