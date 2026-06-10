import { USER_TIMEZONE } from "./config";

// Part 8, bug #2: "what day is it?" must use the USER's clock, not the server's
// (Vercel runs in UTC). Use this everywhere you anchor a daily_logs row or build
// a date-scoped storage key.
//
// - On the CLIENT, call localDateKey() with no tz → the browser's local zone.
// - On the SERVER, pass an explicit tz (USER_TIMEZONE) since the runtime is UTC.
export function localDateKey(date: Date = new Date(), tz?: string): string {
  // en-CA formats as YYYY-MM-DD. timeZone undefined => runtime local zone.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Server-side "today" — always anchored to the configured user timezone.
export function todayKey(tz = USER_TIMEZONE): string {
  return localDateKey(new Date(), tz);
}

// Returns the last `days` date keys ending today, most recent first.
export function recentDateKeys(days: number, tz = USER_TIMEZONE): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    out.push(localDateKey(d, tz));
  }
  return out;
}
