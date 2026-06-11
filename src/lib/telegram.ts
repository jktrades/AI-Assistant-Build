// Thin Telegram Bot API helpers used by the capture webhook.

const API = (method: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export async function sendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: unknown
): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(API("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        // Plain text (no parse_mode): replies now carry arbitrary AI-generated
        // answers, and Markdown parsing would 400 on stray * or _ characters.
        text,
        reply_markup: replyMarkup,
      }),
    });
  } catch (err) {
    console.error("[telegram] sendMessage failed:", err);
  }
}

// Inline keyboard so the user can override the AI's urgency call with one tap.
export function urgencyKeyboard(captureId: string) {
  const btn = (label: string, value: string) => ({
    text: label,
    callback_data: `urgency:${captureId}:${value}`,
  });
  return {
    inline_keyboard: [
      [btn("Today", "today"), btn("This Week", "this_week")],
      [btn("This Month", "this_month"), btn("Someday", "someday")],
      [btn("⭐ Key", "key")],
    ],
  };
}

export async function answerCallbackQuery(id: string, text: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(API("answerCallbackQuery"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_query_id: id, text }),
    });
  } catch (err) {
    console.error("[telegram] answerCallbackQuery failed:", err);
  }
}

// Download a Telegram file (e.g. voice OGG) and return it as a Blob with the
// right MIME type so Whisper accepts it (Part 4, bug: wrong content-type).
export async function downloadFile(fileId: string): Promise<Blob | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const meta = await fetch(API("getFile"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    }).then((r) => r.json());
    const path = meta?.result?.file_path;
    if (!path) return null;
    const fileRes = await fetch(
      `https://api.telegram.org/file/bot${token}/${path}`
    );
    const buf = await fileRes.arrayBuffer();
    return new Blob([buf], { type: "audio/ogg" });
  } catch (err) {
    console.error("[telegram] downloadFile failed:", err);
    return null;
  }
}
