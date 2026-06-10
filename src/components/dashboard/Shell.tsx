import { ReactNode } from "react";
import { TopRail } from "./TopRail";
import { CaptureBox } from "./CaptureBox";

// Page layout: sticky top rail, content, floating capture box.
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-5 pb-28 pt-3">
      <TopRail />
      <main>{children}</main>
      <CaptureBox />
    </div>
  );
}
