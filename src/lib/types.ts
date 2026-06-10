import { Urgency } from "./config";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  urgency: Urgency;
  key: boolean;
  priority_score: number;
  time_estimate_min: number | null;
  tags: string[];
  due_date: string | null;
  owner: string | null;
  entity_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Meal {
  id: string;
  t: number; // timestamp
  n: string; // name
  kcal: number;
  p: number;
  c: number;
  f: number;
  estimated: boolean;
}

export interface HabitState {
  done: string[];
  total: number;
}

export interface FinanceSnapshot {
  net_worth: number;
  currency: string;
  as_of: string;
  categories: { name: string; amount: number }[];
  notes?: string;
  generated_at: string;
}
