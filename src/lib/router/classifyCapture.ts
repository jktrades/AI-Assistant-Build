import { completeJSON, parseJsonLoose } from "../llm";
import { supabaseAdmin } from "../supabase";
import { USER_ID, URGENCY_TIERS, Urgency } from "../config";

export type CaptureKind =
  | "task"
  | "decision"
  | "note"
  | "journal"
  | "question"
  | "meal";

const KINDS: CaptureKind[] = [
  "task",
  "decision",
  "note",
  "journal",
  "question",
  "meal",
];

export interface Classification {
  kind: CaptureKind;
  urgency: Urgency;
  key: boolean;
  entity_id: string | null;
  tags: string[];
  summary: string;
  meal_text: string | null; // cleaned food description when kind === "meal"
  llm_source: "anthropic" | "openai" | "regex";
}

const SYSTEM = `You route a single inbound message sent to the user's personal assistant into ONE intent, based on what the user actually MEANS. Return ONLY a JSON object:
{
  "kind": "task" | "meal" | "question" | "decision" | "journal" | "note",
  "urgency": "today" | "this_week" | "this_month" | "someday",
  "key": boolean,
  "entity_id": string|null,
  "tags": string[],
  "summary": string,
  "meal_text": string|null
}

How to choose "kind":
- "question": the message is conversational or a question directed at the assistant — e.g. "do you know my name", "what's my schedule tomorrow", "how many calories have I had today". These get ANSWERED, never stored.
- "meal": the message describes food the user ate or wants logged — e.g. "dinner: grilled chicken and rice", "I had a burger for lunch", "log the dinner I had: pasta bolognese". Set "meal_text" to ONLY the actual food, stripped of framing ("log the dinner I had: pasta" -> "pasta"). Never turn a meal into a task.
- "task": an actionable to-do — "remind me to...", "I need to...", "call the dentist", "buy milk".
- "decision": a choice the user has made.
- "journal": reflective or diary-style writing about their day or feelings.
- "note": a fact, idea, or thought to remember that is none of the above.

Use "note" ONLY as a fallback when the intent is genuinely unclear.

"summary": <= 12 words. Imperative title for tasks; the food for meals; a restatement for questions.
"meal_text": the cleaned food description if kind is "meal", otherwise null.
Never invent an entity_id — only use one from the provided list.`;

function regexFallback(text: string): Classification {
  const lower = text.toLowerCase().trim();

  const isQuestion =
    /\?\s*$/.test(lower) ||
    /^(do|does|did|are|is|am|can|could|would|will|should|what|whats|what's|who|whom|when|where|why|how|tell me|do you|did i|have i|how many|how much)\b/.test(
      lower
    );
  const isTask =
    /\b(todo|to-do|need to|have to|remind me|remember to|call|email|buy|finish|send|book|fix|ship|schedule|pay|renew)\b/.test(
      lower
    );
  const isMeal =
    /\b(breakfast|lunch|dinner|brunch|snack)\b/.test(lower) ||
    /\b(i (ate|had|munched|grabbed)|log (the |my )?(meal|breakfast|lunch|dinner|brunch|snack)|calories|kcal)\b/.test(
      lower
    );

  let kind: CaptureKind = "note";
  if (isQuestion) kind = "question";
  else if (isTask) kind = "task";
  else if (isMeal) kind = "meal";

  let urgency: Urgency = "this_week";
  if (/\b(today|tonight|now|asap|urgent)\b/.test(lower)) urgency = "today";
  else if (/\b(this week)\b/.test(lower)) urgency = "this_week";
  else if (/\b(this month)\b/.test(lower)) urgency = "this_month";
  else if (/\b(someday|eventually|one day)\b/.test(lower)) urgency = "someday";

  return {
    kind,
    urgency,
    key: /\b(important|key|critical)\b/.test(lower),
    entity_id: null,
    tags: [],
    summary: text.slice(0, 120),
    meal_text: kind === "meal" ? text : null,
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

  const userPrompt = `Message:\n"""${text}"""\n\nKnown entities (id :: name):\n${
    entityList || "(none)"
  }`;

  const res = await completeJSON(SYSTEM, userPrompt, 512);
  if (!res) return regexFallback(text);

  const parsed = parseJsonLoose<Partial<Classification>>(res.text);
  if (!parsed) return regexFallback(text);

  const kind: CaptureKind = KINDS.includes(parsed.kind as CaptureKind)
    ? (parsed.kind as CaptureKind)
    : "note";

  const urgency: Urgency = URGENCY_TIERS.includes(parsed.urgency as Urgency)
    ? (parsed.urgency as Urgency)
    : "this_week";

  // Part 4, bug #3: validate the entity_id actually exists, else null.
  const entity_id =
    parsed.entity_id && validIds.has(parsed.entity_id) ? parsed.entity_id : null;

  const meal_text =
    kind === "meal"
      ? (parsed.meal_text || parsed.summary || text).toString().slice(0, 300)
      : null;

  return {
    kind,
    urgency,
    key: Boolean(parsed.key),
    entity_id,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4).map(String) : [],
    summary: (parsed.summary || text).slice(0, 200),
    meal_text,
    llm_source: res.source,
  };
}
