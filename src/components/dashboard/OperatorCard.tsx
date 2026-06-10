"use client";

import { OPERATOR } from "@/lib/config";
import { Panel } from "./Panel";

// Operator (Part 5.1): pure UI, rendered from config. No backend.
export function OperatorCard() {
  return (
    <Panel title="Operator">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-accent/70 to-ink-2 grid place-items-center text-lg font-semibold">
          {OPERATOR.name.slice(0, 1)}
        </div>
        <div>
          <p className="font-semibold leading-tight">{OPERATOR.name}</p>
          <p className="text-ink-3 text-xs">
            {OPERATOR.role} · {OPERATOR.location}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-ink-2/60">
        <p className="text-xs uppercase tracking-widest text-ink-3">Current focus</p>
        <p className="text-sm mt-1">{OPERATOR.focus}</p>
      </div>
    </Panel>
  );
}
