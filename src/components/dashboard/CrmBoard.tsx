"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDemoMode } from "./demo";
import { demoTasks } from "@/lib/demoData";
import { URGENCY_TIERS, URGENCY_LABELS, Urgency } from "@/lib/config";
import { Task } from "@/lib/types";

type View = "kanban" | "smart" | "category";

export function CrmBoard() {
  const [demo] = useDemoMode();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<View>("kanban");
  const [selected, setSelected] = useState<Task | null>(null);
  const [smartIds, setSmartIds] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");
  const dirtyRef = useRef(false);

  // Persist view selection (Part 5.4) so refreshes don't reset it.
  useEffect(() => {
    const v = localStorage.getItem("personal-os-crm-view") as View | null;
    if (v) setView(v);
  }, []);
  useEffect(() => {
    localStorage.setItem("personal-os-crm-view", view);
  }, [view]);

  async function load() {
    if (demo) {
      setTasks(demoTasks);
      return;
    }
    try {
      const d = await fetch("/api/tasks?status=open", { cache: "no-store" }).then((r) => r.json());
      if (!dirtyRef.current || true) setTasks(d.tasks || []);
    } catch (err) {
      console.error("[crm] load failed:", err);
    }
  }
  useEffect(() => {
    load();
    const onCapture = () => load();
    window.addEventListener("personal-os-capture", onCapture);
    return () => window.removeEventListener("personal-os-capture", onCapture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  async function patch(id: string, body: Partial<Task>) {
    dirtyRef.current = true;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...body } as Task : t)));
    if (demo) return;
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error("[crm] patch failed:", err);
    }
  }

  async function remove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelected(null);
    if (demo) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }

  async function addTask(urgency: Urgency, title: string) {
    if (!title.trim()) return;
    if (demo) {
      setTasks((prev) => [
        {
          ...demoTasks[0],
          id: "demo-" + Math.random().toString(36).slice(2, 8),
          title,
          urgency,
          priority_score: 999,
        },
        ...prev,
      ]);
      return;
    }
    const t = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, urgency }),
    }).then((r) => r.json());
    if (t.task) setTasks((prev) => [t.task, ...prev]);
  }

  async function runSmart() {
    if (!query.trim()) {
      setSmartIds(null);
      return;
    }
    if (demo) {
      setSmartIds(demoTasks.filter((t) => t.title.toLowerCase().includes(query.toLowerCase())).map((t) => t.id));
      return;
    }
    const d = await fetch("/api/tasks/smart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    }).then((r) => r.json());
    setSmartIds(d.ids || []);
  }

  const open = tasks.filter((t) => !t.completed_at);

  return (
    <div>
      <div className="flex items-center gap-1 mb-4">
        {(["kanban", "smart", "category"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              view === v ? "bg-ink-2 text-ink-4" : "text-ink-3 hover:text-ink-4"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {URGENCY_TIERS.map((tier) => (
            <KanbanColumn
              key={tier}
              tier={tier}
              tasks={open.filter((t) => t.urgency === tier).sort((a, b) => b.priority_score - a.priority_score)}
              onSelect={setSelected}
              onAdd={(title) => addTask(tier, title)}
              onDropTask={(id) => patch(id, { urgency: tier })}
            />
          ))}
        </div>
      )}

      {view === "smart" && (
        <div>
          <div className="flex gap-2 mb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSmart()}
              placeholder='Ask: "what should I do this morning"'
              className="flex-1 rounded-lg bg-ink-1 border border-ink-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button onClick={runSmart} className="rounded-lg bg-accent/90 hover:bg-accent text-ink-0 px-4 text-sm font-medium">
              Search
            </button>
          </div>
          <div className="space-y-1.5">
            {(smartIds ? open.filter((t) => smartIds.includes(t.id)).sort((a, b) => smartIds.indexOf(a.id) - smartIds.indexOf(b.id)) : open)
              .map((t) => (
                <TaskRow key={t.id} task={t} onSelect={setSelected} />
              ))}
            {smartIds?.length === 0 && <p className="text-ink-3 text-sm">No matches.</p>}
          </div>
        </div>
      )}

      {view === "category" && <CategoryView tasks={open} onSelect={setSelected} />}

      {selected && (
        <TaskDrawer task={selected} onClose={() => setSelected(null)} onPatch={patch} onDelete={remove} />
      )}
    </div>
  );
}

function KanbanColumn({
  tier,
  tasks,
  onSelect,
  onAdd,
  onDropTask,
}: {
  tier: Urgency;
  tasks: Task[];
  onSelect: (t: Task) => void;
  onAdd: (title: string) => void;
  onDropTask: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = e.dataTransfer.getData("text/task-id");
        if (id) onDropTask(id);
      }}
      className={`panel p-3 ${over ? "ring-1 ring-accent" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-widest text-ink-3">{URGENCY_LABELS[tier]}</h3>
        <span className="mono text-xs text-ink-3">{tasks.length}</span>
      </div>
      <div className="space-y-1.5 min-h-[40px]">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} onSelect={onSelect} draggable />
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            onAdd(draft.trim());
            setDraft("");
          }
        }}
        placeholder="+ add"
        className="mt-2 w-full bg-transparent text-sm outline-none placeholder:text-ink-3 border-b border-transparent focus:border-ink-2 py-1"
      />
    </div>
  );
}

function TaskRow({
  task,
  onSelect,
  draggable,
}: {
  task: Task;
  onSelect: (t: Task) => void;
  draggable?: boolean;
}) {
  return (
    <button
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/task-id", task.id)}
      onClick={() => onSelect(task)}
      className="w-full text-left rounded-lg bg-ink-1/60 hover:bg-ink-2/60 px-2.5 py-2 transition-colors"
    >
      <div className="flex items-center gap-1.5">
        {task.key && <span className="text-warn text-xs">⭐</span>}
        <span className="text-sm truncate">{task.title}</span>
      </div>
      {task.tags?.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span key={tag} className="text-[10px] text-ink-3 bg-ink-0/50 rounded px-1.5 py-0.5">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function CategoryView({ tasks, onSelect }: { tasks: Task[]; onSelect: (t: Task) => void }) {
  const groups = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      const k = t.entity_id || "Unassigned";
      (map[k] ||= []).push(t);
    }
    return map;
  }, [tasks]);
  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([k, list]) => (
        <div key={k}>
          <h3 className="text-xs uppercase tracking-widest text-ink-3 mb-2">
            {k === "Unassigned" ? "Unassigned" : `Entity ${k.slice(0, 8)}`}
          </h3>
          <div className="space-y-1.5">
            {list.map((t) => (
              <TaskRow key={t.id} task={t} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskDrawer({
  task,
  onClose,
  onPatch,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onPatch: (id: string, body: Partial<Task>) => void;
  onDelete: (id: string) => void;
}) {
  const [local, setLocal] = useState(task);
  useEffect(() => setLocal(task), [task]);

  function save() {
    onPatch(task.id, {
      title: local.title,
      description: local.description,
      urgency: local.urgency,
      key: local.key,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md panel rounded-none h-full p-5 overflow-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase tracking-widest text-ink-3">Edit task</h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink-4">×</button>
        </div>
        <label className="block text-xs text-ink-3 mb-1">Title</label>
        <input
          value={local.title}
          onChange={(e) => setLocal({ ...local, title: e.target.value })}
          className="w-full rounded-lg bg-ink-1 border border-ink-2 px-3 py-2 text-sm mb-3 outline-none focus:border-accent"
        />
        <label className="block text-xs text-ink-3 mb-1">Description</label>
        <textarea
          value={local.description || ""}
          onChange={(e) => setLocal({ ...local, description: e.target.value })}
          rows={4}
          className="w-full rounded-lg bg-ink-1 border border-ink-2 px-3 py-2 text-sm mb-3 outline-none focus:border-accent"
        />
        <label className="block text-xs text-ink-3 mb-1">Urgency</label>
        <select
          value={local.urgency}
          onChange={(e) => setLocal({ ...local, urgency: e.target.value as Urgency })}
          className="w-full rounded-lg bg-ink-1 border border-ink-2 px-3 py-2 text-sm mb-3 outline-none focus:border-accent"
        >
          {URGENCY_TIERS.map((u) => (
            <option key={u} value={u}>
              {URGENCY_LABELS[u]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm mb-5">
          <input
            type="checkbox"
            checked={local.key}
            onChange={(e) => setLocal({ ...local, key: e.target.checked })}
          />
          Key task ⭐
        </label>
        <div className="flex gap-2">
          <button onClick={save} className="flex-1 rounded-lg bg-accent/90 hover:bg-accent text-ink-0 py-2 text-sm font-medium">
            Save
          </button>
          <button
            onClick={() => {
              onPatch(task.id, { completed_at: new Date().toISOString() });
              onClose();
            }}
            className="rounded-lg bg-ok/20 text-ok px-3 py-2 text-sm"
          >
            Done
          </button>
          <button onClick={() => onDelete(task.id)} className="rounded-lg bg-danger/20 text-danger px-3 py-2 text-sm">
            Delete
          </button>
        </div>
      </aside>
    </div>
  );
}
