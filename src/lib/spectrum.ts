import type { Feeling, JournalEntry } from "./types";

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

const FILL: Record<Feeling, string> = {
  радость: "oklch(0.8 0.12 95)",
  спокойно: "oklch(0.74 0.09 165)",
  усталость: "oklch(0.7 0.05 305)",
  пусто: "oklch(0.78 0.02 235)",
  грусть: "oklch(0.62 0.08 250)",
  тревожно: "oklch(0.76 0.12 55)",
  напряжение: "oklch(0.66 0.11 42)",
  стыд: "oklch(0.66 0.1 8)",
  злость: "oklch(0.6 0.14 28)",
  тяжело: "oklch(0.46 0.045 255)",
};

/** A note without a picked feeling still leaves a mark on the day. */
export const UNMARKED_FILL = "oklch(0.82 0.015 175)";

const ORDER = new Map(SPECTRUM_ORDER.map((feeling, index) => [feeling, index]));

export function feelingFill(feeling: Feeling): string {
  return FILL[feeling];
}

export type DaySlice = {
  id: string;
  feelings: Feeling[];
};

export type SpectrumDay = {
  key: string;
  slices: DaySlice[];
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
  const days: SpectrumDay[] = dayKeys.map((key) => {
    const slices = (byDay.get(key) ?? [])
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((entry) => {
        const feelings = uniqueFeelings(entry.feelings);
        for (const feeling of feelings) {
          counts.set(feeling, (counts.get(feeling) ?? 0) + 1);
        }
        return { id: entry.id, feelings };
      });
    return { key, slices };
  });

  const shares = SPECTRUM_ORDER.filter((feeling) => counts.has(feeling)).map(
    (feeling) => ({ feeling, count: counts.get(feeling) ?? 0 }),
  );
  const feelingTotal = shares.reduce((sum, share) => sum + share.count, 0);
  const max = shares.reduce((best, share) => Math.max(best, share.count), 0);
  const top = shares.filter((share) => share.count === max).map((share) => share.feeling);

  return { days, shares, top, feelingTotal };
}
