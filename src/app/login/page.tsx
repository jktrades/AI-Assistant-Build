"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const next = new URLSearchParams(window.location.search).get("next") || "/";
        window.location.href = next;
      } else {
        setError("Wrong password.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <form onSubmit={onSubmit} className="panel w-full max-w-sm p-8 space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">JK OS</h1>
          <p className="text-ink-3 text-sm mt-1">Enter your password to continue.</p>
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg bg-ink-1 border border-ink-2 px-3 py-2 outline-none focus:border-accent"
        />
        {error && <p className="text-danger text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full rounded-lg bg-accent/90 hover:bg-accent text-ink-0 font-medium py-2 disabled:opacity-50"
        >
          {loading ? "…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
