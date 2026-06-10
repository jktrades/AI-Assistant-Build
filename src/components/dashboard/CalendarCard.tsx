"use client";

import { useMemo, useState } from "react";
import { Panel } from "./Panel";
import { useApi } from "./useApi";

interface CalEvent {
  uid: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Calendar (Part 5.2): 7-day strip from the secret iCal feed; click a day to
// see its events.
export function CalendarCard() {
  const { data, loading } = useApi<{ events: CalEvent[] }>("/api/calendar");
  const [selected, setSelected] = useState<string>(dayKey(new Date()));

  const days = useMemo(() => {
    const out: Date[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) out.push(new Date(now.getTime() + i * 864e5));
    return out;
  }, []);

  const byDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of data?.events || []) {
      const k = e.start.slice(0, 10);
      (map[k] ||= []).push(e);
    }
    return map;
  }, [data]);

  const selectedEvents = byDay[selected] || [];

  return (
    <Panel title="Calendar">
      {loading ? (
        <div className="h-12 animate-pulse rounded-lg bg-ink-1/60" />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const k = dayKey(d);
              const isSel = k === selected;
              const isToday = k === dayKey(new Date());
              const count = (byDay[k] || []).length;
              return (
                <button
                  key={k}
                  onClick={() => setSelected(k)}
                  className={`flex flex-col items-center rounded-lg py-1.5 text-xs transition-colors ${
                    isSel ? "bg-accent/20 text-ink-4" : "hover:bg-ink-2/60 text-ink-3"
                  }`}
                >
                  <span className="text-[10px]">
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <span className={`mono ${isToday ? "text-accent font-semibold" : ""}`}>
                    {d.getDate()}
                  </span>
                  <span className="h-1 mt-0.5">
                    {count > 0 && <span className="block h-1 w-1 rounded-full bg-accent" />}
                  </span>
                </button>
              );
            })}
          </div>
          <ul className="mt-3 space-y-1.5 max-h-40 overflow-auto">
            {selectedEvents.length === 0 ? (
              <li className="text-ink-3 text-sm py-2 text-center">No events.</li>
            ) : (
              selectedEvents.map((e) => (
                <li key={e.uid} className="flex items-baseline gap-2 text-sm">
                  <span className="mono text-xs text-accent shrink-0">
                    {e.allDay
                      ? "all-day"
                      : new Date(e.start).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                  </span>
                  <span className="truncate">{e.title}</span>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </Panel>
  );
}
