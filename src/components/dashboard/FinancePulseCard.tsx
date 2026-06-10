"use client";

import { useState } from "react";
import { Panel } from "./Panel";
import { useApi } from "./useApi";
import { useDemoMode } from "./demo";
import { demoFinance } from "@/lib/demoData";
import { FinanceSnapshot } from "@/lib/types";

function fmt(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }
}

// Finance Pulse (Part 5.8): reads the latest snapshot on load (NO AI). The
// refresh button is the ONLY way a page view triggers the AI extraction.
export function FinancePulseCard() {
  const [demo] = useDemoMode();
  const { data, loading, refetch } = useApi<{ snapshot: FinanceSnapshot | null }>(
    demo ? null : "/api/finance"
  );
  const [refreshing, setRefreshing] = useState(false);

  const snap = demo ? demoFinance : data?.snapshot || null;

  async function refresh() {
    if (demo || refreshing) return;
    setRefreshing(true);
    try {
      await fetch("/api/finance?refresh=1", { cache: "no-store" });
      await refetch();
    } catch (err) {
      console.error("[finance] refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Panel
      title="Finance Pulse"
      action={
        <button
          onClick={refresh}
          disabled={demo || refreshing}
          className="text-xs text-ink-3 hover:text-accent disabled:opacity-40"
          title="Re-run the AI extraction (uses API budget)"
        >
          {refreshing ? "…" : "↻"}
        </button>
      }
    >
      {!demo && loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-ink-1/60" />
      ) : !snap ? (
        <div className="py-4 text-center">
          <p className="text-ink-3 text-sm">No snapshot yet.</p>
          <button onClick={refresh} className="mt-2 text-xs text-accent hover:underline">
            Run first extraction →
          </button>
        </div>
      ) : (
        <div>
          <p className="mono text-2xl font-semibold tracking-tight">
            {fmt(snap.net_worth, snap.currency)}
          </p>
          <p className="text-ink-3 text-xs mt-0.5">net worth · as of {snap.as_of}</p>
          <ul className="mt-3 space-y-1">
            {snap.categories.slice(0, 4).map((c) => (
              <li key={c.name} className="flex items-center justify-between text-sm">
                <span className="text-ink-3 truncate">{c.name}</span>
                <span className={`mono ${c.amount < 0 ? "text-danger" : ""}`}>
                  {fmt(c.amount, snap.currency)}
                </span>
              </li>
            ))}
          </ul>
          {snap.notes && (
            <p className="mt-2 text-[11px] text-warn">⚠ {snap.notes}</p>
          )}
        </div>
      )}
    </Panel>
  );
}
