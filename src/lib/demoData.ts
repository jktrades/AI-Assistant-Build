// Fake-but-realistic data for demo mode (Part A17). When demo mode is on, cards
// read from here instead of hitting the real DB, so you can record a video or
// share a screenshot without exposing your real life.

import { Task, Meal, GoalItem, FinanceSnapshot } from "./types";

export const demoTasks: Task[] = [
  mk("Ship capture pipeline", "today", true, 120),
  mk("Reply to investor email", "today", true, 95),
  mk("Gym — push day", "today", false, 80),
  mk("Draft Q3 roadmap", "this_week", true, 70),
  mk("Renew domain", "this_week", false, 40),
  mk("Read 'Thinking in Systems'", "this_month", false, 20),
  mk("Plan Japan trip", "someday", false, 10),
];

function mk(
  title: string,
  urgency: Task["urgency"],
  key: boolean,
  score: number
): Task {
  const id = "demo-" + Math.random().toString(36).slice(2, 9);
  return {
    id,
    title,
    description: null,
    urgency,
    key,
    priority_score: score,
    time_estimate_min: [15, 30, 45, 60][Math.floor(Math.random() * 4)],
    tags: [],
    due_date: null,
    owner: "demo",
    entity_id: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export const demoHabits = {
  habits: ["Wake 6am", "Train", "Deep work 2h", "Read 20m", "No junk", "Lights out 11pm"],
  done: ["Wake 6am", "Train", "Deep work 2h", "No junk"],
};

export const demoMeals: Meal[] = [
  { id: "m1", t: Date.now() - 6 * 3.6e6, n: "Oats + whey", kcal: 420, p: 38, c: 52, f: 9, estimated: true },
  { id: "m2", t: Date.now() - 3 * 3.6e6, n: "Chicken rice bowl", kcal: 640, p: 52, c: 70, f: 14, estimated: true },
];

export const demoGoals: { week: GoalItem[]; month: GoalItem[] } = {
  week: [
    { id: "g1", text: "Launch the dashboard", done: false },
    { id: "g2", text: "3 gym sessions", done: true },
  ],
  month: [{ id: "g3", text: "Hit 100 daily-active captures", done: false }],
};

export const demoFinance: FinanceSnapshot = {
  net_worth: 184250,
  currency: "USD",
  as_of: new Date().toISOString().slice(0, 10),
  categories: [
    { name: "Cash", amount: 24000 },
    { name: "Investments", amount: 142000 },
    { name: "Crypto", amount: 31000 },
    { name: "Credit card", amount: -12750 },
  ],
  notes: "",
  generated_at: new Date().toISOString(),
};
