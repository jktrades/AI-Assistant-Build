import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, cacheBustLimit } from "@/lib/supabase";
import { USER_ID, URGENCY_TIERS, Urgency } from "@/lib/config";

export const dynamic = "force-dynamic";

// GET /api/tasks?status=open|done
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") || "open";
  const db = supabaseAdmin();
  let q = db
    .from("tasks")
    .select("*")
    .eq("user_id", USER_ID)
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(cacheBustLimit()); // bust PostgREST edge cache (Part 8, bug #5)

  if (status === "open") q = q.is("completed_at", null);
  else if (status === "done") q = q.not("completed_at", "is", null);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data || [] }, { headers: { "cache-control": "no-store" } });
}

// POST /api/tasks  — create. New tasks insert at top of their tier (high score).
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const urgency: Urgency = URGENCY_TIERS.includes(body.urgency as Urgency)
    ? (body.urgency as Urgency)
    : "this_week";

  const db = supabaseAdmin();
  // Place new task above the current top of its tier.
  const { data: top } = await db
    .from("tasks")
    .select("priority_score")
    .eq("user_id", USER_ID)
    .eq("urgency", urgency)
    .order("priority_score", { ascending: false })
    .limit(1)
    .maybeSingle();
  const priority_score = (top?.priority_score ?? 0) + 10;

  const { data, error } = await db
    .from("tasks")
    .insert({
      user_id: USER_ID,
      title,
      description: body.description ?? null,
      urgency,
      key: Boolean(body.key),
      priority_score,
      time_estimate_min: body.time_estimate_min ?? null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      due_date: body.due_date ?? null,
      entity_id: body.entity_id ?? null,
      owner: USER_ID,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("audit_log").insert({
    user_id: USER_ID,
    action: "task.create",
    resource_type: "tasks",
    resource_id: data.id,
    metadata: { urgency },
  });
  return NextResponse.json({ task: data });
}
