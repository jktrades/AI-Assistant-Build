"use client";

import { useEffect, useState } from "react";

const KEY = "personal-os-demo";

// Tiny global-ish demo-mode flag backed by localStorage + a window event so
// every card re-renders when the TopRail toggle flips.
export function useDemoMode(): [boolean, (v: boolean) => void] {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDemo(localStorage.getItem(KEY) === "1");
    const onChange = () => setDemo(localStorage.getItem(KEY) === "1");
    window.addEventListener("personal-os-demo-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("personal-os-demo-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const set = (v: boolean) => {
    localStorage.setItem(KEY, v ? "1" : "0");
    setDemo(v);
    window.dispatchEvent(new Event("personal-os-demo-change"));
  };

  return [demo, set];
}
