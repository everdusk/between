import {
  FEELINGS,
  type CheckinSlot,
  type Feeling,
} from "./types";

const FEELING_SET = new Set<string>(FEELINGS);

export function isFeeling(value: unknown): value is Feeling {
  return typeof value === "string" && FEELING_SET.has(value);
}

/** Map the old 1–5 scale onto words. 4–5 become «радость», 3 — «спокойно». */
export function feelingsFromLegacyMood(mood: unknown): Feeling[] {
  if (mood === 1 || mood === 2) return ["тяжело"];
  if (mood === 3) return ["спокойно"];
  if (mood === 4 || mood === 5) return ["радость"];
  return [];
}

export function normalizeFeelings(
  feelings: unknown,
  mood: unknown,
): Feeling[] {
  if (Array.isArray(feelings) && feelings.length > 0) {
    const picked: Feeling[] = [];
    for (const item of feelings) {
      if (isFeeling(item) && !picked.includes(item)) picked.push(item);
    }
    return picked.slice(0, 6);
  }
  return feelingsFromLegacyMood(mood);
}

export function formatFeelings(feelings: Feeling[]): string {
  return feelings.join(", ");
}

export const SLOT_LABELS: Record<CheckinSlot, string> = {
  morning: "утро",
  day: "день",
  evening: "вечер",
};

const HEAVY = new Set<Feeling>([
  "тревожно",
  "злость",
  "грусть",
  "усталость",
  "стыд",
  "пусто",
  "напряжение",
  "тяжело",
]);

const LIGHT = new Set<Feeling>(["спокойно", "радость"]);

/** −1 heavy, +1 light, null when the entry has no known feelings. */
export function feelingValence(feelings: Feeling[]): number | null {
  let score = 0;
  let n = 0;
  for (const feeling of feelings) {
    if (HEAVY.has(feeling)) {
      score -= 1;
      n += 1;
    } else if (LIGHT.has(feeling)) {
      score += 1;
      n += 1;
    }
  }
  if (n === 0) return null;
  return score / n;
}
