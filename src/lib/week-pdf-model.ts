import { buildWeekSpectrum, feelingFill } from "./spectrum";
import { entriesForTheme, splitBacklog } from "./themes";
import type { Feeling, JournalEntry, SessionTheme, ThemeLink } from "./types";

const NIGHT_GROUND = rgbOf(6, 11, 9);
const NIGHT_INK = rgbOf(0xf2, 0xf7, 0xf4);
const NIGHT_STRONG = mix(NIGHT_GROUND, rgbOf(255, 255, 255), 0.14);

/** Night brandbook. Day and night do not mix, so the sheet is night throughout. */
export const PDF_NIGHT = {
  ground: NIGHT_GROUND,
  ink: NIGHT_INK,
  mint: rgbOf(0x8f, 0xf0, 0xbc),
  muted: rgbOf(0x90, 0x9c, 0x96),
  /** `glass` — white at 9% over the night ground. */
  card: mix(NIGHT_GROUND, rgbOf(255, 255, 255), 0.09),
  /** `glass-strong` — the spectrum tile. */
  strong: NIGHT_STRONG,
  /** Pattern nest sits a step lighter than the spectrum tile. */
  nest: mix(NIGHT_STRONG, NIGHT_INK, 0.05),
  line: rgbOf(255, 255, 255),
};

export type Rgb = { r: number; g: number; b: number };

export type WeekPdfNote = {
  when: string;
  feelings: { label: string; color: Rgb }[];
  body: string;
};

export type WeekPdfTheme = {
  title: string;
  meta: string;
  notes: WeekPdfNote[];
  empty: string | null;
};

export type WeekPdfDay = {
  weekday: string;
  day: string;
  today: boolean;
  future: boolean;
  slices: Rgb[][];
};

export type WeekPdfModel = {
  filename: string;
  range: string;
  spectrumLabel: string;
  spectrumTitle: string;
  spectrumLead: string;
  axis: string;
  shares: { label: string; count: number; color: Rgb }[];
  days: WeekPdfDay[];
  patternTitle: string;
  patternText: string;
  backlogTitle: string;
  backlogLead: string;
  emptyBacklog: string | null;
  themes: WeekPdfTheme[];
};

function rgbOf(r: number, g: number, b: number): Rgb {
  return { r: r / 255, g: g / 255, b: b / 255 };
}

function mix(base: Rgb, over: Rgb, alpha: number): Rgb {
  return {
    r: base.r * (1 - alpha) + over.r * alpha,
    g: base.g * (1 - alpha) + over.g * alpha,
    b: base.b * (1 - alpha) + over.b * alpha,
  };
}

/** `oklch(L C H)` from the feeling scale, as the PDF can paint it. */
export function oklchToRgb(l: number, c: number, h: number): Rgb {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  const linear = [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
  const gamma = (value: number) => {
    const clamped = Math.min(1, Math.max(0, value));
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  };
  return { r: gamma(linear[0]), g: gamma(linear[1]), b: gamma(linear[2]) };
}

export function feelingRgb(feeling: Feeling): Rgb {
  const match = /oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)/.exec(feelingFill(feeling));
  if (!match) return PDF_NIGHT.muted;
  return oklchToRgb(Number(match[1]), Number(match[2]), Number(match[3]));
}

function fileStamp(dayKeys: string[], todayKey: string): string {
  const start = dayKeys[0] ?? todayKey;
  const end = dayKeys[dayKeys.length - 1] ?? start;
  return start === end ? start : `${start}_${end}`;
}

export function buildWeekPdfModel(input: {
  todayKey: string;
  dayKeys: string[];
  entries: JournalEntry[];
  themes: SessionTheme[];
  links: ThemeLink[];
  now: Date;
  range: string;
  spectrumLabel: string;
  spectrumTitle: string;
  spectrumLead: string;
  axis: string;
  patternTitle: string;
  patternText: string;
  backlogTitle: string;
  backlogLead: string;
  emptyBacklog: string;
  noNotes: string;
  said: string;
  weekday: (dayKey: string) => string;
  dayNumber: (dayKey: string) => string;
  when: (dayKey: string) => string;
  feeling: (feeling: Feeling) => string;
  noteCount: (count: number) => string;
}): WeekPdfModel {
  const spectrum = buildWeekSpectrum(input.dayKeys, input.entries);
  const { live } = splitBacklog(input.themes, input.now);
  const themes = live.map((theme) => {
    const notes = entriesForTheme(theme, input.entries, input.links).map((entry) => ({
      when: input.when(entry.date),
      feelings: entry.feelings.map((item) => ({ label: input.feeling(item), color: feelingRgb(item) })),
      body: entry.body.replace(/\s+\n/g, "\n").trim(),
    }));
    const meta = [
      `×${input.noteCount(theme.count)}`,
      input.when(theme.lastSeen),
      theme.status === "discussed" ? input.said : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      title: theme.title.replace(/\s+/g, " ").trim(),
      meta,
      notes,
      empty: notes.length === 0 ? input.noNotes : null,
    };
  });
  return {
    filename: `between-${fileStamp(input.dayKeys, input.todayKey)}.pdf`,
    range: input.range,
    spectrumLabel: input.spectrumLabel,
    spectrumTitle: input.spectrumTitle,
    spectrumLead: input.spectrumLead,
    axis: spectrum.shares.length > 1 ? input.axis : "",
    shares: spectrum.shares.map((share) => ({
      label: input.feeling(share.feeling),
      count: share.count,
      color: feelingRgb(share.feeling),
    })),
    days: spectrum.days.map((day) => ({
      weekday: input.weekday(day.key),
      day: input.dayNumber(day.key),
      today: day.key === input.todayKey,
      future: day.key > input.todayKey,
      slices: day.slices.map((slice) => slice.feelings.map((item) => feelingRgb(item))),
    })),
    patternTitle: input.patternTitle,
    patternText: input.patternText,
    backlogTitle: input.backlogTitle,
    backlogLead: input.backlogLead,
    emptyBacklog: themes.length === 0 ? input.emptyBacklog : null,
    themes,
  };
}
