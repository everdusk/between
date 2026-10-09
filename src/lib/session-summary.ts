import { formatDayLabel, formatLongDate } from "@/lib/dates";
import {
  MOOD_LABELS,
  type JournalEntry,
  type MoodLevel,
  type SessionNote,
} from "@/lib/types";

const EXCERPT_MAX = 180;

/** Latest session by calendar date (then updatedAt). */
export function getLastSession(
  sessions: SessionNote[],
): SessionNote | null {
  if (sessions.length === 0) return null;
  return [...sessions].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.updatedAt.localeCompare(a.updatedAt);
  })[0];
}

/**
 * Journal entries written after the last session day.
 * Session-day notes are excluded (итог сеанса / день встречи ≠ «после»).
 */
export function entriesAfterSession(
  entries: JournalEntry[],
  sessionDate: string,
): JournalEntry[] {
  return entries
    .filter((e) => e.date > sessionDate && e.body.trim().length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type ThemeCount = { tag: string; count: number };

export type DayHighlight = {
  date: string;
  mood: MoodLevel;
  moodLabel: string;
  excerpt: string;
  tags: string[];
};

export type PeriodSummary = {
  lastSession: SessionNote;
  entries: JournalEntry[];
  entryCount: number;
  avgMood: number | null;
  moodTrend: "up" | "down" | "flat" | null;
  themes: ThemeCount[];
  highlights: DayHighlight[];
  plainText: string;
};

function truncateExcerpt(body: string, max = EXCERPT_MAX): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const slice = cleaned.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut}…`;
}

function pluralEntries(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} запись`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} записи`;
  }
  return `${n} записей`;
}

function moodTrendOf(entries: JournalEntry[]): PeriodSummary["moodTrend"] {
  if (entries.length < 2) return null;
  const mid = Math.floor(entries.length / 2);
  const first = entries.slice(0, mid);
  const second = entries.slice(mid);
  if (first.length === 0 || second.length === 0) return null;
  const avg = (xs: JournalEntry[]) =>
    xs.reduce((s, e) => s + e.mood, 0) / xs.length;
  const a = avg(first);
  const b = avg(second);
  const delta = b - a;
  if (delta >= 0.4) return "up";
  if (delta <= -0.4) return "down";
  return "flat";
}

function themeCounts(entries: JournalEntry[]): ThemeCount[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const tag of e.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ru"))
    .slice(0, 8);
}

function pickHighlights(entries: JournalEntry[]): DayHighlight[] {
  if (entries.length === 0) return [];
  if (entries.length <= 5) {
    return entries.map((e) => ({
      date: e.date,
      mood: e.mood,
      moodLabel: MOOD_LABELS[e.mood],
      excerpt: truncateExcerpt(e.body),
      tags: e.tags,
    }));
  }

  // Prefer extremes + middle + latest for longer periods
  const byMoodAsc = [...entries].sort((a, b) => a.mood - b.mood);
  const lowest = byMoodAsc[0];
  const highest = byMoodAsc[byMoodAsc.length - 1];
  const mid = entries[Math.floor(entries.length / 2)];
  const latest = entries[entries.length - 1];
  const earliest = entries[0];

  const picked: JournalEntry[] = [];
  for (const e of [earliest, lowest, mid, highest, latest]) {
    if (!picked.some((p) => p.id === e.id)) picked.push(e);
  }
  return picked
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({
      date: e.date,
      mood: e.mood,
      moodLabel: MOOD_LABELS[e.mood],
      excerpt: truncateExcerpt(e.body),
      tags: e.tags,
    }));
}

function trendSentence(trend: PeriodSummary["moodTrend"]): string | null {
  if (trend === "up") {
    return "Настроение к концу периода в среднем выше, чем в начале.";
  }
  if (trend === "down") {
    return "Настроение к концу периода в среднем ниже, чем в начале.";
  }
  if (trend === "flat") {
    return "Настроение за период без явного сдвига вверх или вниз.";
  }
  return null;
}

function buildPlainText(summary: Omit<PeriodSummary, "plainText">): string {
  const lines: string[] = [];
  lines.push(
    `После сеанса ${formatLongDate(summary.lastSession.date)} · ${pluralEntries(summary.entryCount)}`,
  );
  if (summary.avgMood !== null) {
    lines.push(`Среднее настроение: ${summary.avgMood.toFixed(1)}`);
  }
  const trend = trendSentence(summary.moodTrend);
  if (trend) lines.push(trend);

  if (summary.themes.length > 0) {
    lines.push("");
    lines.push(
      `Темы: ${summary.themes.map((t) => (t.count > 1 ? `${t.tag} (×${t.count})` : t.tag)).join(", ")}`,
    );
  }

  if (summary.highlights.length > 0) {
    lines.push("");
    lines.push("Ключевые моменты:");
    for (const h of summary.highlights) {
      lines.push(`• ${formatDayLabel(h.date)} — ${h.moodLabel}`);
      lines.push(`  ${h.excerpt}`);
    }
  }

  return lines.join("\n");
}

export function buildPeriodSummary(
  entries: JournalEntry[],
  sessions: SessionNote[],
): PeriodSummary | null {
  const lastSession = getLastSession(sessions);
  if (!lastSession) return null;

  const periodEntries = entriesAfterSession(entries, lastSession.date);
  const avgMood =
    periodEntries.length > 0
      ? periodEntries.reduce((s, e) => s + e.mood, 0) / periodEntries.length
      : null;
  const themes = themeCounts(periodEntries);
  const highlights = pickHighlights(periodEntries);
  const moodTrend = moodTrendOf(periodEntries);

  const base = {
    lastSession,
    entries: periodEntries,
    entryCount: periodEntries.length,
    avgMood,
    moodTrend,
    themes,
    highlights,
  };

  return { ...base, plainText: buildPlainText(base) };
}
