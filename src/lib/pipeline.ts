import { supabaseAdmin } from "./supabase";
import { USER_ID } from "./config";
import { classifyCapture, Classification } from "./router/classifyCapture";
import { remember } from "./memory";
import { todayKey } from "./dates";
import { upsertDailyNotes } from "./dailyLogs";
import { answerQuestion } from "./ask";
import { estimateMeal } from "./nutrition";
import { Meal } from "./types";

export interface PipelineResult {
  captureId: string;
  classification: Classification;
  routedTo: string; // tasks | nutrition | journal | answered | note
  routedId: string | null;
  reply: string; // user-facing confirmation, or the answer for a question
}

// classify → write raw_capture → route by intent → embed → audit. Used by BOTH
// the Telegram webhook and the web /api/capture box so the two capture surfaces
// behave identically.
export async function runCapturePipeline(
  rawText: string,
  source: "telegram" | "web" | "shortcut" = "web",
  audioUrl: string | null = null
): Promise<PipelineResult> {
  const db = supabaseAdmin();
  const classification = await classifyCapture(rawText);
  const { kind } = classification;

  // 1. raw_captures — the inbox log of everything that came in.
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

  // 2. route by intent.
  let routedTo = "note";
  let routedId: string | null = captureId;
  let reply = "";

  if (kind === "question") {
    // Conversational / question → answer via RAG. Do NOT store as a note, and
    // don't pollute memory with the question itself.
    reply = await answerQuestion(rawText);
    routedTo = "answered";
    routedId = null;
  } else if (kind === "meal") {
    // Food → a Nutrition entry on today's daily_logs, never a task or note.
    const date = todayKey();
    const est = await estimateMeal(classification.meal_text || rawText);
    const meal: Meal = {
      id: crypto.randomUUID(),
      t: Date.now(),
      n: est.name,
      kcal: est.kcal,
      p: est.p,
      c: est.c,
      f: est.f,
      estimated: true,
    };
    await upsertDailyNotes(date, (n) => {
      const nutrition = (n.nutrition as { meals?: Meal[] }) || {};
      const meals = Array.isArray(nutrition.meals) ? nutrition.meals : [];
      meals.push(meal);
      n.nutrition = { meals };
      return n;
    });
    routedTo = "nutrition";
    routedId = null;
    reply = `Logged ${est.name} — ${est.kcal} kcal (P ${est.p} · C ${est.c} · F ${est.f})`;
    await remember("meal", null, est.name);
  } else if (kind === "task" || kind === "decision") {
    const title = classification.summary || rawText.slice(0, 120);
    const { data: task, error: taskErr } = await db
      .from("tasks")
      .insert({
        user_id: USER_ID,
        title,
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
      routedTo = "note";
      reply = `Noted: ${title}`;
    } else if (task) {
      routedTo = "tasks";
      routedId = task.id as string;
      reply = `Added task: ${title}`;
    }
    await remember(kind, routedId, rawText);
  } else if (kind === "journal") {
    const date = todayKey();
    await upsertDailyNotes(date, (n) => {
      const journal = Array.isArray(n.journal) ? (n.journal as unknown[]) : [];
      journal.push({ t: Date.now(), text: rawText });
      n.journal = journal;
      return n;
    });
    routedTo = "journal";
    routedId = null;
    reply = "Journaled.";
    await remember("journal", null, rawText);
  } else {
    // note — the genuine fallback.
    routedTo = "note";
    routedId = captureId;
    reply = `Noted: ${classification.summary || rawText.slice(0, 80)}`;
    await remember("note", captureId, rawText);
  }

  // 3. update the raw_capture with routing info.
  await db
    .from("raw_captures")
    .update({ routed_to: routedTo, routed_id: routedId })
    .eq("id", captureId);

  // 4. audit log.
  await db.from("audit_log").insert({
    user_id: USER_ID,
    action: "capture",
    resource_type: routedTo,
    resource_id: routedId,
    metadata: { source, kind, llm_source: classification.llm_source },
  });

  return { captureId, classification, routedTo, routedId, reply };
}
