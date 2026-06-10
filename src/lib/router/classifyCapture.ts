import { completeJSON, parseJsonLoose } from "../llm";
import { supabaseAdmin } from "../supabase";
import { USER_ID, URGENCY_TIERS, Urgency } from "../config";

export type CaptureKind = "task" | "decision" | "note" | "journal";

export interface Classification {
  kind: CaptureKind;
  urgency: Urgency;
  key: boolean;
  entity_id: string | null;
  tags: string[];
  summary: string;
  llm_source: "anthropic" | "openai" | "regex";
}

const SYSTEM = `You classify a single personal capture (a thought, todo, or note) into structured JSON.
Return ONLY a JSON object with this exact shape:
{
  "kind": "task" | "decision" | "note" | "journal",
  "urgency": "today" | "this_week" | "this_month" | "someday",
  "key": boolean,            // true if this is a high-leverage / important item
  "entity_id": string|null,  // ONLY use an id from the provided entities list, else null
  "tags": string[],          // 0-4 short lowercase tags
  "summary": string          // <= 12 words, imperative for tasks
}
Rules: pick "task" for anything actionable. "journal" for reflective/diary-style text.
"decision" for a choice made. "note" otherwise. Never invent an entity_id.`;

function regexFallback(text: string): Classification {
  const lower = text.toLowerCase();
  const isTask = /\b(todo|need to|remind|call|email|buy|finish|send|book|fix|ship)\b/.test(
    lower
  );
  let urgency: Urgency = "this_week";
  if (/\b(today|tonight|now|asap|urgent)\b/.test(lower)) urgency = "today";
  else if (/\b(this week)\b/.test(lower)) urgency = "this_week";
  else if (/\b(this month)\b/.test(lower)) urgency = "this_month";
  else if (/\b(someday|eventually|one day)\b/.test(lower)) urgency = "someday";
  return {
    kind: isTask ? "task" : "note",
    urgency,
    key: /\b(important|key|critical)\b/.test(lower),
    entity_id: null,
    tags: [],
    summary: text.slice(0, 80),
    llm_source: "regex",
  };
}

export async function classifyCapture(text: string): Promise<Classification> {
  // Pull a small set of known entities so the model can attach to a real id.
  let entityList = "";
  let validIds = new Set<string>();
  try {
    const { data } = await supabaseAdmin()
      .from("entities")
      .select("id,name,kind")
      .eq("user_id", USER_ID)
      .limit(50);
    if (data?.length) {
      validIds = new Set(data.map((e) => e.id as string));
      entityList = data
        .map((e) => `- ${e.id} :: ${e.name} (${e.kind})`)
        .join("\n");
    }
  } catch (err) {
    console.error("[classify] entity lookup failed:", err);
  }

  const userPrompt = `Capture:\n"""${text}"""\n\nKnown entities (id :: name):\n${
    entityList || "(none)"
  }`;

  const res = await completeJSON(SYSTEM, userPrompt, 512);
  if (!res) return regexFallback(text);

  const parsed = parseJsonLoose<Partial<Classification>>(res.text);
  if (!parsed) return regexFallback(text);

  const kind: CaptureKind = (
    ["task", "decision", "note", "journal"] as const
  ).includes(parsed.kind as CaptureKind)
    ? (parsed.kind as CaptureKind)
    : "note";

  const urgency: Urgency = URGENCY_TIERS.includes(parsed.urgency as Urgency)
    ? (parsed.urgency as Urgency)
    : "this_week";

  // Part 4, bug #3: validate the entity_id actually exists, else null.
  const entity_id =
    parsed.entity_id && validIds.has(parsed.entity_id) ? parsed.entity_id : null;

  return {
    kind,
    urgency,
    key: Boolean(parsed.key),
    entity_id,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4).map(String) : [],
    summary: (parsed.summary || text).slice(0, 200),
    llm_source: res.source,
  };
}
