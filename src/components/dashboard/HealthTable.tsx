"use client";

import { Fragment, useState } from "react";
import { useApi } from "./useApi";
import { useDemoMode } from "./demo";
import { demoMeals } from "@/lib/demoData";
import { Meal } from "@/lib/types";

interface DayNutrition {
  date: string;
  meals: Meal[];
  kcal: number;
  p: number;
  c: number;
  f: number;
}

// Health tab (Part 5.6): 30-day calorie log. Read-only aggregation; click a row
// to expand its meals. Averages computed over logged days only.
export function HealthTable() {
  const [demo] = useDemoMode();
  const { data, loading } = useApi<{ days: DayNutrition[] }>(
    demo ? null : "/api/nutrition?days=30"
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  const days: DayNutrition[] = demo
    ? [
        {
          date: new Date().toISOString().slice(0, 10),
          meals: demoMeals,
          kcal: demoMeals.reduce((a, m) => a + m.kcal, 0),
          p: demoMeals.reduce((a, m) => a + m.p, 0),
          c: demoMeals.reduce((a, m) => a + m.c, 0),
          f: demoMeals.reduce((a, m) => a + m.f, 0),
        },
      ]
    : data?.days || [];

  const logged = days.filter((d) => d.meals.length > 0);
  const avg = (sel: (d: DayNutrition) => number) =>
    logged.length ? Math.round(logged.reduce((a, d) => a + sel(d), 0) / logged.length) : 0;

  if (!demo && loading) {
    return <div className="panel h-40 animate-pulse" />;
  }

  return (
    <div className="panel p-4">
      <div className="grid grid-cols-4 gap-3 mb-4 text-center">
        {[
          ["Avg kcal", avg((d) => d.kcal)],
          ["Avg P", avg((d) => d.p)],
          ["Avg C", avg((d) => d.c)],
          ["Avg F", avg((d) => d.f)],
        ].map(([label, val]) => (
          <div key={label as string} className="rounded-lg bg-ink-1/60 py-2">
            <p className="mono text-lg">{val as number}</p>
            <p className="text-[10px] uppercase tracking-widest text-ink-3">{label as string}</p>
          </div>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-3 text-xs uppercase tracking-widest text-left">
            <th className="py-2 font-medium">Date</th>
            <th className="py-2 font-medium mono text-right">kcal</th>
            <th className="py-2 font-medium mono text-right">P</th>
            <th className="py-2 font-medium mono text-right">C</th>
            <th className="py-2 font-medium mono text-right">F</th>
            <th className="py-2 font-medium mono text-right">Meals</th>
          </tr>
        </thead>
        <tbody>
          {days.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-ink-3">
                No nutrition logged yet.
              </td>
            </tr>
          )}
          {days.map((d) => (
            <Fragment key={d.date}>
              <tr
                onClick={() => setExpanded(expanded === d.date ? null : d.date)}
                className="border-t border-ink-2/40 cursor-pointer hover:bg-ink-1/40"
              >
                <td className="py-2">{d.date}</td>
                <td className="py-2 mono text-right">{d.kcal}</td>
                <td className="py-2 mono text-right">{d.p}</td>
                <td className="py-2 mono text-right">{d.c}</td>
                <td className="py-2 mono text-right">{d.f}</td>
                <td className="py-2 mono text-right">{d.meals.length}</td>
              </tr>
              {expanded === d.date &&
                d.meals.map((m) => (
                  <tr key={m.id} className="text-ink-3 text-xs">
                    <td className="py-1 pl-4">↳ {m.n}</td>
                    <td className="py-1 mono text-right">{m.kcal}</td>
                    <td className="py-1 mono text-right">{m.p}</td>
                    <td className="py-1 mono text-right">{m.c}</td>
                    <td className="py-1 mono text-right">{m.f}</td>
                    <td />
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
