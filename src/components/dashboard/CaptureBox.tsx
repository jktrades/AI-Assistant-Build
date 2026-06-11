"use client";

import { useState } from "react";

// Floating capture box (Part 4, Step 4). Expands on focus; submitting POSTs to
// /api/capture which runs the full classify → write → embed → audit pipeline.
export function CaptureBox() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string, ms: number) {
    setToast(message);
    setTimeout(() => setToast(null), ms);
  }

  async function submit() {
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setValue("");
      // For a question the reply is the assistant's answer — keep it up longer.
      const isAnswer = data.kind === "question";
      showToast(data.reply || "Done.", isAnswer ? 9000 : 3500);
      window.dispatchEvent(new Event("personal-os-capture"));
    } catch (err) {
      console.error("[capture] failed:", err);
      showToast("Capture failed — check the console.", 3500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-30 px-3 pointer-events-none">
      <div className="mx-auto max-w-2xl pointer-events-auto">
        {toast && (
          <div className="panel mb-2 px-3 py-2 text-sm text-ink-4 text-center">
            {toast}
          </div>
        )}
        <div
          className={`panel flex items-end gap-2 p-2 transition-all ${
            focused ? "shadow-2xl" : ""
          }`}
        >
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            rows={focused || value ? 2 : 1}
            placeholder="Capture a thought, task, or note…  (⌘/Ctrl+Enter)"
            className="flex-1 resize-none bg-transparent outline-none px-2 py-1.5 text-sm placeholder:text-ink-3"
          />
          <button
            onClick={submit}
            disabled={busy || !value.trim()}
            className="rounded-lg bg-accent/90 hover:bg-accent text-ink-0 text-sm font-medium px-3 py-1.5 disabled:opacity-40"
          >
            {busy ? "…" : "Capture"}
          </button>
        </div>
      </div>
    </div>
  );
}
