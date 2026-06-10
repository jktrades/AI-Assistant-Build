import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;

export function anthropic(): Anthropic | null {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

export function openai(): OpenAI | null {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
export const OPENAI_CLASSIFIER_MODEL =
  process.env.OPENAI_CLASSIFIER_MODEL || "gpt-4o-mini";

// Extract the first JSON object from a possibly-fenced LLM string.
export function parseJsonLoose<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < 0 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

// Claude primary, OpenAI fallback. Returns the text content (best-effort JSON).
export async function completeJSON(
  system: string,
  user: string,
  maxTokens = 1024
): Promise<{ text: string; source: "anthropic" | "openai" } | null> {
  const a = anthropic();
  if (a) {
    try {
      const res = await a.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (text.trim()) return { text, source: "anthropic" };
    } catch (err) {
      console.error("[llm] anthropic failed, falling back:", err);
    }
  }
  const o = openai();
  if (o) {
    try {
      const res = await o.chat.completions.create({
        model: OPENAI_CLASSIFIER_MODEL,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      });
      const text = res.choices[0]?.message?.content || "";
      if (text.trim()) return { text, source: "openai" };
    } catch (err) {
      console.error("[llm] openai fallback failed:", err);
    }
  }
  return null;
}
