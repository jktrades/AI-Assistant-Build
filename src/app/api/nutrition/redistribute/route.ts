import { NextRequest, NextResponse } from "next/server";
import { completeJSON, parseJsonLoose } from "@/lib/llm";

export const dynamic = "force-dynamic";

// POST /api/nutrition/redistribute { name, kcal } → { p, c, f }
// When the user edits the calorie target, ask the model for a realistic macro
// split for that food at that calorie count.
export async function POST(req: NextRequest) {
  let name = "";
  let kcal = 0;
  try {
    ({ name, kcal } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  kcal = Math.max(0, Math.round(Number(kcal) || 0));

  const system = `Given a food name and a target calorie count, return a realistic macro split.
Return ONLY JSON: { "p": number, "c": number, "f": number } in grams (integers).
Macros should roughly satisfy kcal ≈ 4*p + 4*c + 9*f for that food's typical composition.`;

  const res = await completeJSON(system, `Food: "${name}", target kcal: ${kcal}`, 200);
  const parsed = res ? parseJsonLoose<{ p: number; c: number; f: number }>(res.text) : null;
  if (!parsed) {
    // Fallback: 30/40/30 calorie split.
    const p = Math.round((kcal * 0.3) / 4);
    const c = Math.round((kcal * 0.4) / 4);
    const f = Math.round((kcal * 0.3) / 9);
    return NextResponse.json({ p, c, f });
  }
  const round = (n: unknown) => Math.max(0, Math.round(Number(n) || 0));
  return NextResponse.json({ p: round(parsed.p), c: round(parsed.c), f: round(parsed.f) });
}
