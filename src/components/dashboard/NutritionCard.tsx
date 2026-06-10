"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "./Panel";
import { useDemoMode } from "./demo";
import { demoMeals } from "@/lib/demoData";
import { Meal } from "@/lib/types";
import { localDateKey } from "@/lib/dates";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
const kcalFromMacros = (p: number, c: number, f: number) => 4 * p + 4 * c + 9 * f;

// Nutrition (Part 5.5): type a meal → AI macros. Bidirectional coupling: edit a
// macro and kcal recomputes; edit kcal (debounced) and macros redistribute.
// Date-scoped storage key auto-clears at local midnight.
export function NutritionCard() {
  const [demo] = useDemoMode();
  const date = localDateKey();
  const storageKey = `personal-os-nutrition-${date}`;
  const [meals, setMeals] = useState<Meal[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const kcalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (demo) {
      setMeals(demoMeals);
      return;
    }
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) setMeals(JSON.parse(cached));
    } catch {}
    fetch(`/api/nutrition?days=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (dirtyRef.current) return;
        const today = (d.days || []).find((x: { date: string }) => x.date === date);
        if (today?.meals) setMeals(today.meals);
      })
      .catch((err) => console.error("[nutrition] load failed:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, date]);

  function persist(next: Meal[]) {
    setMeals(next);
    if (demo) return;
    dirtyRef.current = true;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
    fetch("/api/nutrition", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, meals: next }),
    }).catch((err) => console.error("[nutrition] save failed:", err));
  }

  async function addMeal() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    let macros = { kcal: 0, p: 0, c: 0, f: 0, estimated: false };
    if (!demo) {
      try {
        macros = await fetch("/api/nutrition/estimate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        }).then((r) => r.json());
      } catch (err) {
        console.error("[nutrition] estimate failed:", err);
      }
    }
    const meal: Meal = {
      id: uid(),
      t: Date.now(),
      n: text,
      kcal: macros.kcal,
      p: macros.p,
      c: macros.c,
      f: macros.f,
      estimated: macros.estimated,
    };
    persist([...meals, meal]);
    setDraft("");
    setBusy(false);
  }

  function editMacro(id: string, field: "p" | "c" | "f", val: number) {
    persist(
      meals.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, [field]: val };
        updated.kcal = kcalFromMacros(updated.p, updated.c, updated.f);
        return updated;
      })
    );
  }

  function editKcal(id: string, kcal: number) {
    // optimistic kcal update, then debounce a /redistribute call
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, kcal } : m)));
    if (demo) return;
    if (kcalTimer.current) clearTimeout(kcalTimer.current);
    const meal = meals.find((m) => m.id === id);
    if (!meal) return;
    kcalTimer.current = setTimeout(async () => {
      try {
        const macros = await fetch("/api/nutrition/redistribute", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: meal.n, kcal }),
        }).then((r) => r.json());
        persist(
          meals.map((m) => (m.id === id ? { ...m, kcal, p: macros.p, c: macros.c, f: macros.f } : m))
        );
      } catch (err) {
        console.error("[nutrition] redistribute failed:", err);
      }
    }, 600);
  }

  const total = meals.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  );

  return (
    <Panel
      title="Nutrition"
      action={<span className="mono text-xs text-ink-3">{total.kcal} kcal</span>}
    >
      <div className="flex flex-col h-full">
        <ul className="space-y-1.5 flex-1 overflow-auto">
          {meals.map((m) => (
            <li key={m.id} className="rounded-lg bg-ink-1/60 px-2.5 py-1.5">
              <button
                onClick={() => setEditing(editing === m.id ? null : m.id)}
                className="w-full flex items-center justify-between gap-2 text-left"
              >
                <span className="truncate text-sm">{m.n}</span>
                <span className="mono text-xs text-ink-3 shrink-0">{m.kcal}</span>
              </button>
              {editing === m.id && (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  <MacroInput label="kcal" value={m.kcal} onChange={(v) => editKcal(m.id, v)} />
                  <MacroInput label="P" value={m.p} onChange={(v) => editMacro(m.id, "p", v)} />
                  <MacroInput label="C" value={m.c} onChange={(v) => editMacro(m.id, "c", v)} />
                  <MacroInput label="F" value={m.f} onChange={(v) => editMacro(m.id, "f", v)} />
                </div>
              )}
            </li>
          ))}
          {meals.length === 0 && (
            <p className="text-ink-3 text-sm py-3 text-center">No meals logged today.</p>
          )}
        </ul>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addMeal()}
          placeholder={busy ? "estimating…" : "+ log a meal"}
          disabled={busy}
          className="mt-2 w-full bg-transparent text-sm outline-none placeholder:text-ink-3 border-b border-ink-2/60 focus:border-accent py-1.5"
        />
      </div>
    </Panel>
  );
}

function MacroInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col">
      <span className="text-[9px] uppercase text-ink-3">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="mono w-full bg-ink-0/50 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-accent"
      />
    </label>
  );
}
