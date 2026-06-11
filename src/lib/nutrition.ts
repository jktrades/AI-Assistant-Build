import { completeJSON, parseJsonLoose } from "./llm";

export interface MealEstimate {
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

const SYSTEM = `You are a nutrition estimator. Given a description of food the user ate, estimate the macros for the whole meal.
Return ONLY JSON: { "name": string, "kcal": number, "p": number, "c": number, "f": number }.
- "name": a short clean label for what was eaten, e.g. "Grilled chicken and rice". Do NOT include framing words like "log" or "I had".
- p/c/f are grams (integers). Assume a realistic single serving unless quantities are given.`;

// Shared meal-macro estimator used by the capture pipeline when a message is
// classified as a meal.
export async function estimateMeal(text: string): Promise<MealEstimate> {
  const res = await completeJSON(SYSTEM, `Food: "${text}"`, 256);
  const parsed = res ? parseJsonLoose<MealEstimate>(res.text) : null;
  const round = (n: unknown) => Math.max(0, Math.round(Number(n) || 0));
  return {
    name: (parsed?.name || text).toString().slice(0, 120),
    kcal: round(parsed?.kcal),
    p: round(parsed?.p),
    c: round(parsed?.c),
    f: round(parsed?.f),
  };
}
