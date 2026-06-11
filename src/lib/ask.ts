import { searchMemory } from "./memory";
import { anthropic, ANTHROPIC_MODEL, openai, OPENAI_CLASSIFIER_MODEL } from "./llm";

// Conversational assistant prompt for the capture/Telegram path. Unlike the
// Brain page's /ask route (which cites capture IDs in brackets), this answers
// naturally so a Telegram reply reads like a chat.
const CONVERSATIONAL_SYSTEM = `You are JK OS, the user's personal assistant. Answer the user's question conversationally and concisely, using the context from their own captured notes, tasks, meals, and logs when it is relevant. If the context doesn't contain the answer, say so briefly and honestly rather than guessing. Do not mention the words "context" or "captures"; just answer as their assistant.`;

// Non-streaming RAG answer used by the capture pipeline (Telegram + web box).
export async function answerQuestion(question: string): Promise<string> {
  const matches = await searchMemory(question, 20);
  const context = matches
    .map((m) => `(${m.source_type}) ${m.text.slice(0, 600)}`)
    .join("\n");
  const userPrompt = `What I know about the user:\n${
    context || "(nothing relevant on record)"
  }\n\nUser asks: ${question}`;

  const a = anthropic();
  if (a) {
    try {
      const res = await a.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        system: CONVERSATIONAL_SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      });
      const text = res.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("");
      if (text.trim()) return text.trim();
    } catch (err) {
      console.error("[ask] anthropic failed, falling back:", err);
    }
  }

  const o = openai();
  if (o) {
    try {
      const res = await o.chat.completions.create({
        model: OPENAI_CLASSIFIER_MODEL,
        max_tokens: 600,
        messages: [
          { role: "system", content: CONVERSATIONAL_SYSTEM },
          { role: "user", content: userPrompt },
        ],
      });
      const text = res.choices[0]?.message?.content || "";
      if (text.trim()) return text.trim();
    } catch (err) {
      console.error("[ask] openai fallback failed:", err);
    }
  }

  return "I can't answer that right now — no AI provider is configured.";
}
