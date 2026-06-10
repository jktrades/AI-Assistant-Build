import { NextRequest, NextResponse } from "next/server";
import { searchMemory } from "@/lib/memory";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/memory/search { query } — semantic search over memory_chunks.
export async function POST(req: NextRequest) {
  let query = "";
  try {
    ({ query } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!query.trim()) return NextResponse.json({ matches: [] });

  const matches = await searchMemory(query.trim(), 20);
  return NextResponse.json({ matches }, { headers: { "cache-control": "no-store" } });
}
