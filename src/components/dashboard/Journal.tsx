"use client";

import { useState } from "react";
import { useApi } from "./useApi";

interface JournalDay {
  date: string;
  mood: string | null;
  entries: { t: number; text: string }[];
}

export function Journal() {
  const { data, loading, refetch } = useApi<{ days: JournalDay[] }>("/api/journal?days=30");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await fetch("/api/journal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setDraft("");
      await refetch();
    } catch (err) {
      console.error("[journal] add failed:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="panel p-3 mb-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="What happened today?"
          className="w-full resize-none bg-transparent outline-none text-sm placeholder:text-ink-3"
        />
        <div className="flex justify-end">
          <button
            onClick={add}
            disabled={busy || !draft.trim()}
            className="rounded-lg bg-accent/90 hover:bg-accent text-ink-0 text-sm font-medium px-4 py-1.5 disabled:opacity-40"
          >
            {busy ? "…" : "Add entry"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel h-24 animate-pulse" />
      ) : (data?.days || []).length === 0 ? (
        <p className="text-ink-3 text-sm text-center py-8">
          No entries yet. Write one above, or send a voice note to your bot.
        </p>
      ) : (
        <div className="space-y-4">
          {data!.days.map((d) => (
            <div key={d.date} className="panel p-4">
              <p className="text-xs uppercase tracking-widest text-ink-3 mb-2">
                {d.date}
                {d.mood ? ` · ${d.mood}` : ""}
              </p>
              <ul className="space-y-2">
                {d.entries.map((e, i) => (
                  <li key={i} className="text-sm leading-relaxed">
                    <span className="mono text-[10px] text-ink-3 mr-2">
                      {new Date(e.t).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {e.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
