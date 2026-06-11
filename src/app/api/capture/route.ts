import { NextRequest, NextResponse } from "next/server";
import { runCapturePipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/capture { text } — web fallback capture box. Same pipeline as the
// Telegram webhook: classify → write → route → embed → audit.
export async function POST(req: NextRequest) {
  let text = "";
  try {
    ({ text } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

  try {
    const result = await runCapturePipeline(text.trim(), "web");
    return NextResponse.json({
      ok: true,
      kind: result.classification.kind,
      reply: result.reply,
      routed_to: result.routedTo,
    });
  } catch (err) {
    console.error("[capture] pipeline failed:", err);
    return NextResponse.json({ error: "pipeline failed" }, { status: 500 });
  }
}
