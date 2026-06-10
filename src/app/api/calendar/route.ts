import { NextResponse } from "next/server";
// ical.js is Mozilla's pure-JS parser — NOT node-ical, which breaks on Vercel
// with "o.BigInt is not a function" (Part 8, bug #1).
import ICAL from "ical.js";

export const dynamic = "force-dynamic";

export interface CalEvent {
  uid: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
}

// Module-memory cache of the parsed feed for 5 minutes.
let cache: { at: number; events: CalEvent[] } | null = null;
const TTL = 5 * 60 * 1000;

async function loadEvents(): Promise<CalEvent[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.events;

  const url = process.env.GOOGLE_CALENDAR_ICAL_URL;
  if (!url) return [];

  const ics = await fetch(url, { cache: "no-store" }).then((r) => r.text());
  const jcal = ICAL.parse(ics);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent");

  const now = new Date();
  const windowStart = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const wsTime = ICAL.Time.fromJSDate(windowStart, false);
  const weTime = ICAL.Time.fromJSDate(windowEnd, false);

  const out: CalEvent[] = [];

  for (const ve of vevents) {
    const event = new ICAL.Event(ve);

    const push = (startTime: ICAL.Time, endTime: ICAL.Time) => {
      out.push({
        uid: event.uid + ":" + startTime.toUnixTime(),
        title: event.summary || "(untitled)",
        start: startTime.toJSDate().toISOString(),
        end: endTime.toJSDate().toISOString(),
        allDay: startTime.isDate,
        location: event.location || undefined,
      });
    };

    if (event.isRecurring()) {
      // Expand recurring events across the 14-day window.
      const iter = event.iterator();
      let next: ICAL.Time | null;
      let guard = 0;
      while ((next = iter.next()) && guard++ < 500) {
        if (next.compare(weTime) > 0) break;
        if (next.compare(wsTime) < 0) continue;
        const duration = event.duration;
        const endT = next.clone();
        endT.addDuration(duration);
        push(next, endT);
      }
    } else {
      const s = event.startDate;
      const e = event.endDate;
      if (s.compare(weTime) <= 0 && e.compare(wsTime) >= 0) push(s, e);
    }
  }

  out.sort((a, b) => a.start.localeCompare(b.start));
  cache = { at: Date.now(), events: out };
  return out;
}

export async function GET() {
  try {
    const events = await loadEvents();
    return NextResponse.json(
      { events },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("[calendar] failed:", err);
    return NextResponse.json(
      { events: [], error: "calendar feed failed" },
      { headers: { "cache-control": "no-store" } }
    );
  }
}
