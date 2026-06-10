"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "./Panel";
import { useDemoMode } from "./demo";
import { demoHabits } from "@/lib/demoData";
import { HABITS } from "@/lib/config";
import { localDateKey } from "@/lib/dates";

// Habit Tracker (Part 5.3): localStorage for instant feedback, Supabase sync on
// every click. Daily reset at local midnight via localDateKey() — the user's
// clock, not the server's (Part 8, bug #2).
export function HabitTrackerCard() {
  const [demo] = useDemoMode();
  const today = localDateKey();
  const storageKey = `personal-os-habits-${today}`;
  const [done, setDone] = useState<string[]>([]);
  const dirtyRef = useRef(false); // ignore the mount GET once the user edits

  useEffect(() => {
    if (demo) {
      setDone(demoHabits.done);
      return;
    }
    // 1. instant: hydrate from localStorage
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) setDone(JSON.parse(cached));
    } catch {}
    // 2. reconcile with server (skip if user already edited — race fix, bug #4)
    fetch(`/api/habits?days=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (dirtyRef.current) return;
        const server = d?.days?.[today]?.done;
        if (Array.isArray(server)) setDone(server);
      })
      .catch((err) => console.error("[habits] load failed:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, today]);

  function toggle(habit: string) {
    if (demo) {
      setDone((d) => (d.includes(habit) ? d.filter((h) => h !== habit) : [...d, habit]));
      return;
    }
    dirtyRef.current = true;
    const next = done.includes(habit)
      ? done.filter((h) => h !== habit)
      : [...done, habit];
    setDone(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
    fetch(`/api/habits/${today}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ done: next }),
    }).catch((err) => console.error("[habits] sync failed:", err));
  }

  const total = HABITS.length;
  return (
    <Panel
      title="Habit Tracker"
      action={
        <span className="mono text-xs text-ink-3">
          {done.length}/{total}
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {HABITS.map((h) => {
          const on = done.includes(h);
          return (
            <button
              key={h}
              onClick={() => toggle(h)}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                on ? "bg-ok/15 text-ink-4" : "bg-ink-1/60 text-ink-3 hover:bg-ink-2/60"
              }`}
            >
              <span
                className={`h-3.5 w-3.5 rounded-full border shrink-0 ${
                  on ? "bg-ok border-ok" : "border-ink-2"
                }`}
              />
              <span className="truncate">{h}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
