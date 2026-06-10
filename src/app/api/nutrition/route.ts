import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, cacheBustLimit } from "@/lib/supabase";
import { USER_ID } from "@/lib/config";
import { parseNotes, upsertDailyNotes } from "@/lib/dailyLogs";
import { recentDateKeys } from "@/lib/dates";
import { Meal } from "@/lib/types";

export const dynamic = "force-dynamic";

interface DayNutrition {
  date: string;
  meals: Meal[];
  kcal: number;
  p: number;
  c: number;
  f: number;
}

function sumMeals(meals: Meal[]) {
  return meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.kcal || 0),
      p: acc.p + (m.p || 0),
      c: acc.c + (m.c || 0),
      f: acc.f + (m.f || 0),
    }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
}

// GET /api/nutrition?days=30 — daily aggregation for the Health tab.
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

  const out: DayNutrition[] = [];
  for (const row of data || []) {
    const notes = parseNotes(row.notes);
    const nutrition = (notes.nutrition as { meals?: Meal[] }) || {};
    const meals = Array.isArray(nutrition.meals) ? nutrition.meals : [];
    out.push({ date: row.log_date, meals, ...sumMeals(meals) });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json({ days: out }, { headers: { "cache-control": "no-store" } });
}

// POST /api/nutrition { date, meals } — persist a day's meals.
export async function POST(req: NextRequest) {
  let date = "";
  let meals: Meal[] = [];
  try {
    ({ date, meals = [] } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  await upsertDailyNotes(date, (n) => {
    n.nutrition = { meals };
    return n;
  });
  return NextResponse.json({ ok: true, ...sumMeals(meals) });
}
