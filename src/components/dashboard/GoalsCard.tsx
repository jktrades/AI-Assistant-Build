"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "./Panel";
import { useDemoMode } from "./demo";
import { demoGoals } from "@/lib/demoData";
import { GoalItem } from "@/lib/types";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function GoalSection({
  label,
  scope,
  demo,
}: {
  label: string;
  scope: "week" | "month";
  demo: boolean;
}) {
  const [items, setItems] = useState<GoalItem[]>([]);
  const [draft, setDraft] = useState("");
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (demo) {
      setItems(scope === "week" ? demoGoals.week : demoGoals.month);
      return;
    }
    fetch("/api/goals", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (dirtyRef.current) return;
        setItems((scope === "week" ? d.week : d.month) || []);
      })
      .catch((err) => console.error("[goals] load failed:", err));
  }, [demo, scope]);

  function persist(next: GoalItem[]) {
    setItems(next);
    if (demo) return;
    dirtyRef.current = true;
    fetch("/api/goals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope, items: next }),
    }).catch((err) => console.error("[goals] save failed:", err));
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-ink-3 mb-1.5">{label}</p>
      <ul className="space-y-1">
        {items.map((g) => (
          <li key={g.id} className="flex items-center gap-2 text-sm group">
            <button
              onClick={() => persist(items.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)))}
              className={`h-3.5 w-3.5 rounded border shrink-0 ${
                g.done ? "bg-ok border-ok" : "border-ink-2"
              }`}
            />
            <span className={`flex-1 truncate ${g.done ? "line-through text-ink-3" : ""}`}>
              {g.text}
            </span>
            <button
              onClick={() => persist(items.filter((x) => x.id !== g.id))}
              className="text-ink-3 opacity-0 group-hover:opacity-100 hover:text-danger"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            persist([...items, { id: uid(), text: draft.trim(), done: false }]);
            setDraft("");
          }
        }}
        placeholder="+ add a goal"
        className="mt-1.5 w-full bg-transparent text-sm outline-none placeholder:text-ink-3 border-b border-transparent focus:border-ink-2 py-1"
      />
    </div>
  );
}

// Goals (Part 5.7): week + month lists, persistent on a sentinel date.
export function GoalsCard() {
  const [demo] = useDemoMode();
  return (
    <Panel title="Goals">
      <div className="space-y-4">
        <GoalSection label="This Week" scope="week" demo={demo} />
        <GoalSection label="This Month" scope="month" demo={demo} />
      </div>
    </Panel>
  );
}
