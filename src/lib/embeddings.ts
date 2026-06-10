import { openai } from "./llm";

const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

// Returns a 1536-dim embedding, or null if no provider is configured.
export async function embed(text: string): Promise<number[] | null> {
  const o = openai();
  if (!o) return null;
  const input = text.slice(0, 8000);
  try {
    const res = await o.embeddings.create({ model: EMBEDDING_MODEL, input });
    return res.data[0]?.embedding ?? null;
  } catch (err) {
    console.error("[embeddings] failed:", err);
    return null;
  }
}
