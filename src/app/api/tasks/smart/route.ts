import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { USER_ID } from "@/lib/config";
import { completeJSON, parseJsonLoose } from "@/lib/llm";

export const dynamic = "force-dynamic";

// POST /api/tasks/smart { query } — natural-language search over open tasks.
// "what should I do this morning" → returns matching task IDs ranked.
export async function POST(req: NextRequest) {
  let query = "";
  try {
    ({ query } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!query.trim()) return NextResponse.json({ ids: [] });

  const db = supabaseAdmin();
  const { data: tasks } = await db
    .from("tasks")
    .select("id,title,description,urgency,key,tags,due_date")
    .eq("user_id", USER_ID)
    .is("completed_at", null)
    .limit(200);

  if (!tasks?.length) return NextResponse.json({ ids: [] });

  const list = tasks
    .map(
      (t) =>
        `${t.id} :: [${t.urgency}${t.key ? ",key" : ""}] ${t.title}${
          t.tags?.length ? " #" + t.tags.join(" #") : ""
        }`
    )
    .join("\n");

  const system = `You are a task triage assistant. Given the user's request and a list of their open tasks (id :: [urgency] title), return the matching task ids most relevant to the request, best first.
Return ONLY JSON: { "ids": string[] }. Use only ids from the list. Empty array if nothing matches.`;

  const res = await completeJSON(system, `Request: "${query}"\n\nTasks:\n${list}`, 512);
  if (!res) {
    // Fallback: naive keyword filter.
    const ql = query.toLowerCase();
    const ids = tasks
      .filter((t) => (t.title + " " + (t.tags || []).join(" ")).toLowerCase().includes(ql))
      .map((t) => t.id);
    return NextResponse.json({ ids });
  }

  const parsed = parseJsonLoose<{ ids: string[] }>(res.text);
  const valid = new Set(tasks.map((t) => t.id));
  const ids = (parsed?.ids || []).filter((id) => valid.has(id));
  return NextResponse.json({ ids });
}
