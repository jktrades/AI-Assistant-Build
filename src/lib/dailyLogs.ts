import { supabaseAdmin } from "./supabase";
import { USER_ID } from "./config";

// daily_logs.notes is a JSON string holding habits / nutrition / goals / journal.
// These helpers parse + merge it safely so partial writes never clobber the rest.

export type DailyNotes = Record<string, unknown>;

export interface DailyLogRow {
  id: string;
  log_date: string;
  notes: DailyNotes;
  mood: string | null;
}

export function parseNotes(raw: string | null | undefined): DailyNotes {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as DailyNotes) : {};
  } catch {
    return {};
  }
}

export async function getDailyLog(date: string): Promise<DailyLogRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("daily_logs")
    .select("id,log_date,notes,mood")
    .eq("user_id", USER_ID)
    .eq("log_date", date)
    .maybeSingle();
  if (error) {
    console.error("[dailyLogs] get failed:", error);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    log_date: data.log_date,
    notes: parseNotes(data.notes),
    mood: data.mood,
  };
}

// Apply a mutator to the parsed notes and return a JSON string to persist.
export function mergeDailyNotes(
  existing: DailyNotes | string | null | undefined,
  mutate: (notes: DailyNotes) => DailyNotes
): string {
  const base =
    typeof existing === "string" ? parseNotes(existing) : { ...(existing || {}) };
  return JSON.stringify(mutate(base));
}

// Upsert helper that merges into existing notes for a given date.
export async function upsertDailyNotes(
  date: string,
  mutate: (notes: DailyNotes) => DailyNotes
): Promise<DailyNotes> {
  const existing = await getDailyLog(date);
  const merged = mergeDailyNotes(existing?.notes, mutate);
  const { error } = await supabaseAdmin()
    .from("daily_logs")
    .upsert(
      { user_id: USER_ID, log_date: date, notes: merged, updated_at: new Date().toISOString() },
      { onConflict: "user_id,log_date" }
    );
  if (error) console.error("[dailyLogs] upsert failed:", error);
  return parseNotes(merged);
}
