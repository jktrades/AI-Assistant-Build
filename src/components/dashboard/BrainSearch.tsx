"use client";

import { useState } from "react";

interface Match {
  id: string;
  source_type: string;
  source_id: string | null;
  text: string;
  similarity: number;
  created_at: string;
}

// Brain tab (Part 6): semantic search over memory_chunks + an "ask my OS" RAG
// answer streamed from Claude.
export function BrainSearch() {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setMatches(null);
    setAnswer("");
    try {
      const d = await fetch("/api/memory/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      }).then((r) => r.json());
      setMatches(d.matches || []);
    } catch (err) {
      console.error("[brain] search failed:", err);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  async function ask() {
    if (!query.trim()) return;
    setAsking(true);
    setAnswer("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setAnswer((a) => a + decoder.decode(value, { stream: true }));
        }
      } else {
        setAnswer(await res.text());
      }
    } catch (err) {
      console.error("[brain] ask failed:", err);
      setAnswer("Something went wrong.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex gap-2 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Ask your OS anything — “that idea I had at the gym in March”"
          className="flex-1 rounded-lg bg-ink-1 border border-ink-2 px-4 py-2.5 outline-none focus:border-accent"
        />
        <button onClick={search} disabled={loading} className="rounded-lg bg-ink-2 hover:bg-ink-3/40 px-4 text-sm">
          {loading ? "…" : "Search"}
        </button>
        <button onClick={ask} disabled={asking} className="rounded-lg bg-accent/90 hover:bg-accent text-ink-0 px-4 text-sm font-medium">
          {asking ? "…" : "Ask"}
        </button>
      </div>

      {answer && (
        <div className="panel p-4 mb-4">
          <p className="text-xs uppercase tracking-widest text-ink-3 mb-2">Answer</p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer}</p>
        </div>
      )}

      {matches && (
        <div className="space-y-2">
          {matches.length === 0 ? (
            <p className="text-ink-3 text-sm text-center py-8">
              No memories found. Capture more and they&apos;ll surface here.
            </p>
          ) : (
            matches.map((m) => (
              <div key={m.id} className="panel p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-widest text-accent">
                    {m.source_type}
                  </span>
                  <span className="mono text-[10px] text-ink-3">
                    {(m.similarity * 100).toFixed(0)}% · {new Date(m.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm">{m.text}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
