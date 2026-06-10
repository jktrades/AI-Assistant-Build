import { NextRequest, NextResponse } from "next/server";
import { runCapturePipeline } from "@/lib/pipeline";
import { openai } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabase";
import { USER_ID } from "@/lib/config";
import {
  sendMessage,
  urgencyKeyboard,
  answerCallbackQuery,
  downloadFile,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  return Boolean(
    process.env.TELEGRAM_WEBHOOK_SECRET &&
      secret === process.env.TELEGRAM_WEBHOOK_SECRET
  );
}

function isMe(fromId: number | undefined): boolean {
  const allowed = process.env.TELEGRAM_USER_ID;
  if (!allowed) return false;
  return String(fromId) === String(allowed);
}

async function transcribe(blob: Blob): Promise<string> {
  const o = openai();
  if (!o) return "";
  try {
    // Telegram voice notes are OGG/Opus; pass the right filename + MIME so
    // Whisper accepts them (Part 4, common bug: wrong content-type).
    const file = new File([blob], "voice.ogg", { type: "audio/ogg" });
    const res = await o.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    return res.text || "";
  } catch (err) {
    console.error("[telegram] whisper failed:", err);
    return "";
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // ack so Telegram stops retrying
  }

  // ── Inline keyboard callback: override urgency / mark key ────────────────
  if (update.callback_query) {
    const cq = update.callback_query;
    if (!isMe(cq.from?.id)) return NextResponse.json({ ok: true });
    const [, captureId, value] = String(cq.data || "").split(":");
    if (captureId && value) {
      const db = supabaseAdmin();
      const { data: cap } = await db
        .from("raw_captures")
        .select("routed_to,routed_id")
        .eq("id", captureId)
        .maybeSingle();
      if (cap?.routed_to === "tasks" && cap.routed_id) {
        const patch =
          value === "key" ? { key: true } : { urgency: value };
        await db.from("tasks").update(patch).eq("id", cap.routed_id).eq("user_id", USER_ID);
      }
      await answerCallbackQuery(cq.id, value === "key" ? "Marked key ⭐" : `Set to ${value}`);
    }
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  if (!msg) return NextResponse.json({ ok: true });
  if (!isMe(msg.from?.id)) return NextResponse.json({ ok: true });

  // ── Resolve the inbound text (voice → Whisper, or plain text) ────────────
  let text = "";
  let audioUrl: string | null = null;
  if (msg.voice?.file_id || msg.audio?.file_id) {
    const fileId = msg.voice?.file_id || msg.audio?.file_id;
    audioUrl = `telegram:${fileId}`;
    const blob = await downloadFile(fileId);
    if (blob) text = await transcribe(blob);
  } else if (msg.text) {
    text = msg.text;
  }

  if (!text.trim()) {
    await sendMessage(msg.chat.id, "Couldn't read that — try again?");
    return NextResponse.json({ ok: true });
  }

  try {
    const result = await runCapturePipeline(text.trim(), "telegram", audioUrl);
    const c = result.classification;
    await sendMessage(
      msg.chat.id,
      `✅ *${c.kind}* · _${c.urgency.replace("_", " ")}_\n${c.summary}`,
      result.routedTo === "tasks" ? urgencyKeyboard(result.captureId) : undefined
    );
  } catch (err) {
    console.error("[telegram] pipeline failed:", err);
    await sendMessage(msg.chat.id, "⚠️ Something broke saving that.");
  }

  return NextResponse.json({ ok: true });
}
