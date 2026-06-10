"use client";

import Link from "next/link";
import { Panel } from "./Panel";
import { useApi } from "./useApi";
import { useDemoMode } from "./demo";
import { demoTasks } from "@/lib/demoData";
import { Task } from "@/lib/types";

// Session (Part 5.1): today's top 3 key tasks, ranked by priority_score.
export function SessionCard() {
  const [demo] = useDemoMode();
  const { data, loading } = useApi<{ tasks: Task[] }>(demo ? null : "/api/tasks?status=open");

  const tasks = (demo ? demoTasks : data?.tasks || [])
    .filter((t) => t.urgency === "today" && t.key && !t.completed_at)
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 3);

  return (
    <Panel title="Session" subtitle="Today · top 3">
      {!demo && loading ? (
        <Skeleton />
      ) : tasks.length === 0 ? (
        <Empty>No key tasks for today.</Empty>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t, i) => (
            <li key={t.id}>
              <Link
                href="/crm"
                className="flex items-center justify-between gap-3 rounded-lg bg-ink-1/60 hover:bg-ink-2/60 px-3 py-2 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="mono text-accent text-xs">{i + 1}</span>
                  <span className="truncate text-sm">{t.title}</span>
                </span>
                {t.time_estimate_min != null && (
                  <span className="mono text-xs text-ink-3 shrink-0">
                    {t.time_estimate_min}m
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-9 rounded-lg bg-ink-1/60" />
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-3 text-sm py-4 text-center">{children}</p>;
}
