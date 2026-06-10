import { NextRequest, NextResponse } from "next/server";
import { completeJSON, parseJsonLoose } from "@/lib/llm";

export const dynamic = "force-dynamic";

// POST /api/nutrition/estimate { text } → { kcal, p, c, f }
export async function POST(req: NextRequest) {
  let text = "";
  try {
    ({ text } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

  const system = `You are a nutrition estimator. Given a meal description, estimate macros.
Return ONLY JSON: { "kcal": number, "p": number, "c": number, "f": number } (grams for p/c/f, integers).
Be realistic; assume a typical single serving unless quantities are given.`;

  const res = await completeJSON(system, `Meal: "${text}"`, 256);
  const parsed = res ? parseJsonLoose<{ kcal: number; p: number; c: number; f: number }>(res.text) : null;
  if (!parsed) {
    return NextResponse.json({ kcal: 0, p: 0, c: 0, f: 0, estimated: false });
  }
  const round = (n: unknown) => Math.max(0, Math.round(Number(n) || 0));
  return NextResponse.json({
    kcal: round(parsed.kcal),
    p: round(parsed.p),
    c: round(parsed.c),
    f: round(parsed.f),
    estimated: true,
  });
}
