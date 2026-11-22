import type { Feeling, JournalEntry } from "./types";
import { feelingValence } from "./feelings";
import type { MessageKey } from "./messages";

export type TimePattern = { key: MessageKey; matches: number; days: number };

/** Compare scheduled answers within the same day, once per slot, never raw counts across slots. */
export function timePattern(entries: JournalEntry[]): TimePattern {
  const byDay = new Map<string, Map<string, JournalEntry>>();
  for (const entry of entries) {
    if (entry.source !== "checkin" || !entry.slot || feelingValence(entry.feelings) === null) continue;
    const slots = byDay.get(entry.date) ?? new Map<string, JournalEntry>();
    const previous = slots.get(entry.slot);
    if (!previous || entry.updatedAt > previous.updatedAt) slots.set(entry.slot, entry);
    byDay.set(entry.date, slots);
  }
  const candidates: TimePattern[] = [];
  let mostPairs = 0;
  for (const [early, late] of [["morning", "evening"], ["day", "evening"], ["morning", "day"]] as const) {
    let days = 0;
    let heavier = 0;
    let lighter = 0;
    for (const slots of byDay.values()) {
      const a = slots.get(early);
      const b = slots.get(late);
      if (!a || !b) continue;
      const change = feelingValence(b.feelings)! - feelingValence(a.feelings)!;
      days += 1;
      if (change < -0.25) heavier += 1;
      if (change > 0.25) lighter += 1;
    }
    mostPairs = Math.max(mostPairs, days);
    for (const [direction, matches] of [["Heavy", heavier], ["Light", lighter]] as const) {
      if (matches < 3 || matches / days < 0.75) continue;
      const key = `spectrumTime${late === "evening" ? "Evening" : "Day"}${direction}` as MessageKey;
      candidates.push({ key, matches, days });
    }
  }
  candidates.sort((a, b) => b.matches - a.matches || b.matches / b.days - a.matches / a.days);
  return candidates[0] ?? { key: mostPairs >= 3 ? "spectrumTimeUnclear" : "spectrumTimeFew", matches: 0, days: mostPairs };
}

export function spectrumTimeSummary(entries: JournalEntry[], t: (key: MessageKey) => string): string {
  const pattern = timePattern(entries);
  return pattern.matches > 0 ? t(pattern.key) : "";
}

/** Lighter, more open states sit on the left. Heavier ones sit on the right. */
export const SPECTRUM_ORDER: readonly Feeling[] = [
  "радость",
  "спокойно",
  "усталость",
  "пусто",
  "грусть",
  "тревожно",
  "напряжение",
  "стыд",
  "злость",
  "тяжело",
];

// The first stop also identifies the feeling in small markers and the PDF.
const FILL: Record<Feeling, readonly [start: string, end: string]> = {
  радость: ["oklch(0.84 0.15 91)", "oklch(0.83 0.12 57)"],
  спокойно: ["oklch(0.73 0.116 177)", "oklch(0.72 0.108 218)"],
  усталость: ["oklch(0.74 0.087 278)", "oklch(0.73 0.10 317)"],
  пусто: ["oklch(0.76 0.047 215)", "oklch(0.75 0.032 275)"],
  грусть: ["oklch(0.65 0.15 253)", "oklch(0.64 0.17 281)"],
  тревожно: ["oklch(0.77 0.14 49)", "oklch(0.76 0.15 20)"],
  напряжение: ["oklch(0.62 0.17 306)", "oklch(0.64 0.19 340)"],
  стыд: ["oklch(0.70 0.14 350)", "oklch(0.69 0.095 315)"],
  злость: ["oklch(0.63 0.207 27)", "oklch(0.63 0.19 358)"],
  тяжело: ["oklch(0.54 0.105 273)", "oklch(0.53 0.105 313)"],
};

const ORDER = new Map(SPECTRUM_ORDER.map((feeling, index) => [feeling, index]));

export function feelingFill(feeling: Feeling): string {
  return FILL[feeling][0];
}

export function feelingGradient(feeling: Feeling) {
  const [color, end] = FILL[feeling];
  return { color, "--feeling-gradient-end": end };
}

export type DaySlice = {
  id: string;
  feelings: Feeling[];
};

export type SpectrumDay = {
  key: string;
  /** Notes that have a feeling. A note without one does not become a cell. */
  slices: DaySlice[];
  noteCount: number;
};

export type FeelingShare = {
  feeling: Feeling;
  count: number;
};

export type WeekSpectrum = {
  days: SpectrumDay[];
  shares: FeelingShare[];
  top: Feeling[];
  feelingTotal: number;
  /** Notes in the window, including ones with no feeling. */
  noteCount: number;
};

function uniqueFeelings(feelings: Feeling[]): Feeling[] {
  const seen = new Set<Feeling>();
  const out: Feeling[] = [];
  for (const feeling of feelings) {
    if (!ORDER.has(feeling) || seen.has(feeling)) continue;
    seen.add(feeling);
    out.push(feeling);
  }
  return out;
}

export function spectrumHeadline(spectrum: WeekSpectrum, noteCount: number): string {
  if (spectrum.feelingTotal === 0 && noteCount === 0) {
    return "Неделя ещё пустая. Отметка самочувствия станет здесь цветной полосой.";
  }
  if (spectrum.feelingTotal === 0) {
    return "Записи есть, самочувствие пока не отмечено.";
  }
  if (spectrum.top.length === 1) return `Чаще всего — ${spectrum.top[0]}.`;
  if (spectrum.top.length === 2) {
    return `Одинаково часто — ${spectrum.top[0]} и ${spectrum.top[1]}.`;
  }
  return "Несколько состояний повторяются одинаково часто.";
}

export function buildWeekSpectrum(
  dayKeys: string[],
  entries: JournalEntry[],
): WeekSpectrum {
  const byDay = new Map<string, JournalEntry[]>();
  for (const key of dayKeys) byDay.set(key, []);
  for (const entry of entries) {
    const list = byDay.get(entry.date);
    if (list) list.push(entry);
  }

  const counts = new Map<Feeling, number>();
  let noteCount = 0;
  const days: SpectrumDay[] = dayKeys.map((key) => {
    const entriesForDay = (byDay.get(key) ?? [])
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    noteCount += entriesForDay.length;
    const slices: DaySlice[] = [];
    for (const entry of entriesForDay) {
      const feelings = uniqueFeelings(entry.feelings);
      if (feelings.length === 0) continue;
      for (const feeling of feelings) {
        counts.set(feeling, (counts.get(feeling) ?? 0) + 1);
      }
      slices.push({ id: entry.id, feelings });
    }
    return { key, slices, noteCount: entriesForDay.length };
  });

  const shares = SPECTRUM_ORDER.filter((feeling) => counts.has(feeling)).map(
    (feeling) => ({ feeling, count: counts.get(feeling) ?? 0 }),
  );
  const feelingTotal = shares.reduce((sum, share) => sum + share.count, 0);
  const max = shares.reduce((best, share) => Math.max(best, share.count), 0);
  const top = shares.filter((share) => share.count === max).map((share) => share.feeling);

  return { days, shares, top, feelingTotal, noteCount };
}
