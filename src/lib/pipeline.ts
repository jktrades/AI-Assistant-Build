import { supabaseAdmin } from "./supabase";
import { USER_ID } from "./config";
import { classifyCapture, Classification } from "./router/classifyCapture";
import { remember } from "./memory";
import { todayKey } from "./dates";
import { getDailyLog, mergeDailyNotes } from "./dailyLogs";

export interface PipelineResult {
  captureId: string;
  classification: Classification;
  routedTo: string;
  routedId: string | null;
}

// classify → write raw_capture → route to downstream table → embed → audit.
// Used by BOTH the Telegram webhook and the web /api/capture form so the two
// capture surfaces behave identically.
export async function runCapturePipeline(
  rawText: string,
  source: "telegram" | "web" | "shortcut" = "web",
  audioUrl: string | null = null
): Promise<PipelineResult> {
  const db = supabaseAdmin();
  const classification = await classifyCapture(rawText);

  // 1. raw_captures
  const { data: cap, error: capErr } = await db
    .from("raw_captures")
    .insert({
      user_id: USER_ID,
      source,
      raw_text: rawText,
      audio_url: audioUrl,
      classification,
      llm_source: classification.llm_source,
    })
    .select("id")
    .single();
  if (capErr || !cap) throw new Error(`raw_capture insert failed: ${capErr?.message}`);
  const captureId = cap.id as string;

  // 2. route downstream
  let routedTo = "raw_captures";
  let routedId: string | null = captureId;

  if (classification.kind === "task" || classification.kind === "decision") {
    const { data: task, error: taskErr } = await db
      .from("tasks")
      .insert({
        user_id: USER_ID,
        title: classification.summary || rawText.slice(0, 120),
        description: rawText,
        urgency: classification.urgency,
        key: classification.key,
        priority_score: classification.key ? 100 : 50,
        tags: classification.tags,
        entity_id: classification.entity_id,
        owner: USER_ID,
      })
      .select("id")
      .single();
    if (taskErr) {
      console.error("[pipeline] task insert failed:", taskErr);
    } else if (task) {
      routedTo = "tasks";
      routedId = task.id as string;
    }
  } else if (classification.kind === "journal") {
    // Journal entries append into today's daily_logs.notes JSON.
    const date = todayKey();
    const existing = await getDailyLog(date);
    const notes = mergeDailyNotes(existing?.notes, (n) => {
      const journal = Array.isArray(n.journal) ? n.journal : [];
      journal.push({ t: Date.now(), text: rawText });
      n.journal = journal;
      return n;
    });
    await db
      .from("daily_logs")
      .upsert(
        { user_id: USER_ID, log_date: date, notes },
        { onConflict: "user_id,log_date" }
      );
    routedTo = "daily_logs";
    routedId = null;
  }

  // 3. update the raw_capture with routing info
  await db
    .from("raw_captures")
    .update({ routed_to: routedTo, routed_id: routedId })
    .eq("id", captureId);

  // 4. memory chunk
  await remember(
    classification.kind === "journal" ? "journal" : classification.kind,
    routedId,
    rawText
  );

  // 5. audit log
  await db.from("audit_log").insert({
    user_id: USER_ID,
    action: "capture",
    resource_type: routedTo,
    resource_id: routedId,
    metadata: { source, kind: classification.kind, llm_source: classification.llm_source },
  });

  return { captureId, classification, routedTo, routedId };
}
