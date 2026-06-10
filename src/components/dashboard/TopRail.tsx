"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useDemoMode } from "./demo";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/crm", label: "CRM" },
  { href: "/brain", label: "Brain" },
  { href: "/finance", label: "Finance" },
  { href: "/journal", label: "Journal" },
  { href: "/health", label: "Health" },
];

export function TopRail() {
  const pathname = usePathname();
  const [demo, setDemo] = useDemoMode();
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleString(undefined, {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="panel sticky top-3 z-20 mx-auto mb-4 flex items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <span className="font-semibold tracking-tight">Personal OS</span>
      </div>

      <nav className="hidden md:flex items-center gap-1">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                active ? "bg-ink-2 text-ink-4" : "text-ink-3 hover:text-ink-4"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setDemo(!demo)}
          className={`text-xs px-2 py-1 rounded-md border transition-colors ${
            demo
              ? "border-warn text-warn"
              : "border-ink-2 text-ink-3 hover:text-ink-4"
          }`}
          title="Swap every card to fake-but-realistic data"
        >
          {demo ? "Demo ●" : "Demo ○"}
        </button>
        <span className="mono text-xs text-ink-3 hidden sm:inline">{now}</span>
        <button
          onClick={logout}
          className="h-7 w-7 grid place-items-center rounded-full bg-ink-2 text-xs hover:bg-ink-3/40"
          title="Log out"
        >
          ⏻
        </button>
      </div>
    </header>
  );
}
