"use client";

import { Panel } from "./Panel";
import { useApi } from "./useApi";
import { useDemoMode } from "./demo";
import { demoTasks } from "@/lib/demoData";
import { Empty, Skeleton } from "./SessionCard";
import { Task } from "@/lib/types";

// Key Blockers: every task flagged "key" that isn't done yet, across all tiers.
export function KeyBlockersCard() {
  const [demo] = useDemoMode();
  const { data, loading } = useApi<{ tasks: Task[] }>(demo ? null : "/api/tasks?status=open");

  const tasks = (demo ? demoTasks : data?.tasks || [])
    .filter((t) => t.key && !t.completed_at)
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 5);

  return (
    <Panel title="Key Blockers">
      {!demo && loading ? (
        <Skeleton />
      ) : tasks.length === 0 ? (
        <Empty>Nothing blocking. Clear runway.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-warn shrink-0" />
              <span className="truncate">{t.title}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
