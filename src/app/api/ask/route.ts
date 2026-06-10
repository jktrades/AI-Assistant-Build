import { NextRequest, NextResponse } from "next/server";
import { searchMemory } from "@/lib/memory";
import { anthropic, ANTHROPIC_MODEL, openai, OPENAI_CLASSIFIER_MODEL } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You are the user's personal assistant. Answer the question using ONLY the context provided. Cite sources by referring to capture IDs in [brackets]. If you don't have enough context, say so.`;

// POST /api/ask { question } — RAG over memory_chunks, streamed answer.
export async function POST(req: NextRequest) {
  let question = "";
  try {
    ({ question } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!question.trim()) return NextResponse.json({ error: "question required" }, { status: 400 });

  const matches = await searchMemory(question.trim(), 20);
  const context = matches
    .map((m) => `[${m.id.slice(0, 8)}] (${m.source_type}) ${m.text.slice(0, 800)}`)
    .join("\n\n");

  const userPrompt = `Context:\n${context || "(no memories found)"}\n\nQuestion: ${question}`;

  const a = anthropic();
  if (a) {
    const stream = await a.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      stream: true,
    });
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (err) {
          console.error("[ask] stream failed:", err);
        } finally {
          controller.close();
        }
      },
    });
    return new Response(body, {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  // OpenAI fallback (non-streaming for simplicity).
  const o = openai();
  if (o) {
    const res = await o.chat.completions.create({
      model: OPENAI_CLASSIFIER_MODEL,
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
    });
    return new Response(res.choices[0]?.message?.content || "", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json({ error: "no LLM provider configured" }, { status: 503 });
}
