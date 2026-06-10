"use client";

import { Panel } from "./Panel";
import { useApi } from "./useApi";
import { useDemoMode } from "./demo";
import { demoTasks } from "@/lib/demoData";
import { Empty, Skeleton } from "./SessionCard";
import { URGENCY_LABELS } from "@/lib/config";
import { Task } from "@/lib/types";

// Priorities: the highest-scoring open tasks regardless of tier.
export function PrioritiesCard() {
  const [demo] = useDemoMode();
  const { data, loading, refetch } = useApi<{ tasks: Task[] }>(
    demo ? null : "/api/tasks?status=open"
  );

  const tasks = (demo ? demoTasks : data?.tasks || [])
    .filter((t) => !t.completed_at)
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 6);

  async function complete(id: string) {
    if (demo) return;
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    });
    refetch();
  }

  return (
    <Panel title="Priorities">
      {!demo && loading ? (
        <Skeleton />
      ) : tasks.length === 0 ? (
        <Empty>No open tasks. Capture something.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 group">
              <button
                onClick={() => complete(t.id)}
                className="h-4 w-4 rounded border border-ink-2 hover:border-ok shrink-0"
                title="Complete"
              />
              <span className="truncate text-sm flex-1">{t.title}</span>
              <span className="mono text-[10px] text-ink-3 shrink-0">
                {URGENCY_LABELS[t.urgency]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
