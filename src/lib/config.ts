// Static, non-secret configuration. Edit these to personalise your OS.

export const USER_ID = process.env.USER_ID || "me";
export const USER_TIMEZONE = process.env.USER_TIMEZONE || "UTC";

// Operator card (Part 5.1) — pure UI, no backend.
export const OPERATOR = {
  name: "Operator",
  location: "Earth",
  role: "Builder",
  focus: "Shipping JK OS",
};

// Habit Tracker (Part 5.3) — six configurable daily habits.
export const HABITS: string[] = [
  "Wake 6am",
  "Train",
  "Deep work 2h",
  "Read 20m",
  "No junk",
  "Lights out 11pm",
];

// Sentinel date for goals so they never auto-clear at week/month boundaries.
export const GOALS_SENTINEL_DATE = "2000-01-01";

// Urgency tiers used across the CRM + Session card.
export const URGENCY_TIERS = [
  "today",
  "this_week",
  "this_month",
  "someday",
] as const;
export type Urgency = (typeof URGENCY_TIERS)[number];

export const URGENCY_LABELS: Record<Urgency, string> = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
  someday: "Someday",
};
