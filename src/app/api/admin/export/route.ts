import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { USER_ID } from "@/lib/config";

export const dynamic = "force-dynamic";

const TABLES = [
  "entities",
  "raw_captures",
  "tasks",
  "daily_logs",
  "memory_chunks",
  "audit_log",
];

// GET /api/admin/export — full JSON snapshot of every table (Part 7, backup).
// Gated by the middleware auth gate / x-api-secret.
export async function GET() {
  const db = supabaseAdmin();
  const dump: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    // Skip embeddings in the export to keep it small.
    const cols = t === "memory_chunks" ? "id,source_type,source_id,text,created_at" : "*";
    const { data } = await db.from(t).select(cols).eq("user_id", USER_ID);
    dump[t] = data || [];
  }
  return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), tables: dump }, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="personal-os-backup-${Date.now()}.json"`,
      "cache-control": "no-store",
    },
  });
}
