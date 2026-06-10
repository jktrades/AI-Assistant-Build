import { embed } from "./embeddings";
import { supabaseAdmin } from "./supabase";
import { USER_ID } from "./config";

// Write a memory chunk for any text artifact (Part 6). Best-effort: if no
// embedding provider is configured we skip silently rather than failing writes.
export async function remember(
  sourceType: string,
  sourceId: string | null,
  text: string
): Promise<void> {
  const clean = text?.trim();
  if (!clean) return;
  try {
    const embedding = await embed(clean);
    await supabaseAdmin().from("memory_chunks").insert({
      user_id: USER_ID,
      source_type: sourceType,
      source_id: sourceId,
      text: clean,
      embedding,
    });
  } catch (err) {
    console.error("[memory] remember failed:", err);
  }
}

export interface MemoryMatch {
  id: string;
  source_type: string;
  source_id: string | null;
  text: string;
  similarity: number;
  created_at: string;
}

export async function searchMemory(
  query: string,
  count = 20
): Promise<MemoryMatch[]> {
  const embedding = await embed(query);
  if (!embedding) return [];
  const { data, error } = await supabaseAdmin().rpc("match_memory_chunks", {
    query_embedding: embedding,
    match_user_id: USER_ID,
    match_count: count,
  });
  if (error) {
    console.error("[memory] search failed:", error);
    return [];
  }
  return (data || []) as MemoryMatch[];
}
