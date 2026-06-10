"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Small GET helper with a refetch trigger. Re-fetches when a capture happens.
export function useApi<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  const refetch = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as T;
      if (aliveRef.current) setData(json);
    } catch (err) {
      console.error(`[useApi] ${url} failed:`, err);
      if (aliveRef.current) setError(String(err));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    aliveRef.current = true;
    refetch();
    const onCapture = () => refetch();
    window.addEventListener("personal-os-capture", onCapture);
    return () => {
      aliveRef.current = false;
      window.removeEventListener("personal-os-capture", onCapture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, ...deps]);

  return { data, loading, error, refetch, setData };
}
