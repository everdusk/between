import { formatDayLabel, formatLongDate } from "@/lib/dates";
import { feelingValence, formatFeelings } from "@/lib/feelings";
import type { Feeling, JournalEntry, SessionNote } from "@/lib/types";

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

function afterSession(entries: JournalEntry[], sessionDate: string): JournalEntry[] {
  return entries
    .filter((entry) => entry.date > sessionDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

/** Notes with text written after the last session day. */
export function entriesAfterSession(
  entries: JournalEntry[],
  sessionDate: string,
): JournalEntry[] {
  return afterSession(entries, sessionDate).filter((entry) => entry.body.trim().length > 0);
}

export type ThemeCount = { tag: string; count: number };
export type FeelingTotal = { feeling: Feeling; count: number };

export type DayHighlight = {
  id: string;
  date: string;
  feelingsLabel: string;
  excerpt: string;
  tags: string[];
};

export type PeriodSummary = {
  lastSession: SessionNote;
  entries: JournalEntry[];
  entryCount: number;
  checkinCount: number;
  feelings: FeelingTotal[];
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
  const scored = entries.filter((entry) => feelingValence(entry.feelings) !== null);
  if (scored.length < 2) return null;
  const mid = Math.floor(scored.length / 2);
  const first = scored.slice(0, mid);
  const second = scored.slice(mid);
  if (first.length === 0 || second.length === 0) return null;
  const avg = (xs: JournalEntry[]) =>
    xs.reduce((sum, entry) => sum + (feelingValence(entry.feelings) ?? 0), 0) / xs.length;
  const delta = avg(second) - avg(first);
  if (delta >= 0.35) return "up";
  if (delta <= -0.35) return "down";
  return "flat";
}

function themeCounts(entries: JournalEntry[]): ThemeCount[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ru"))
    .slice(0, 8);
}

function feelingTotals(entries: JournalEntry[]): FeelingTotal[] {
  const counts = new Map<Feeling, number>();
  for (const entry of entries) {
    for (const feeling of entry.feelings) {
      counts.set(feeling, (counts.get(feeling) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([feeling, count]) => ({ feeling, count }))
    .sort((a, b) => b.count - a.count || a.feeling.localeCompare(b.feeling, "ru"))
    .slice(0, 6);
}

function pickHighlights(entries: JournalEntry[]): DayHighlight[] {
  const toHighlight = (entry: JournalEntry): DayHighlight => ({
    id: entry.id,
    date: entry.date,
    feelingsLabel: formatFeelings(entry.feelings),
    excerpt: truncateExcerpt(entry.body),
    tags: entry.tags,
  });

  if (entries.length === 0) return [];
  if (entries.length <= 5) return entries.map(toHighlight);

  const scored = entries.map((entry) => ({
    entry,
    valence: feelingValence(entry.feelings),
  }));
  const withValence = scored.filter((item) => item.valence !== null);
  const lowest = [...withValence].sort((a, b) => (a.valence ?? 0) - (b.valence ?? 0))[0]?.entry;
  const highest = [...withValence].sort((a, b) => (b.valence ?? 0) - (a.valence ?? 0))[0]?.entry;
  const mid = entries[Math.floor(entries.length / 2)];
  const latest = entries[entries.length - 1];
  const earliest = entries[0];

  const picked: JournalEntry[] = [];
  for (const entry of [earliest, lowest, mid, highest, latest]) {
    if (entry && !picked.some((item) => item.id === entry.id)) picked.push(entry);
  }
  return picked
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map(toHighlight);
}

function trendSentence(trend: PeriodSummary["moodTrend"]): string | null {
  if (trend === "up") {
    return "К концу периода самочувствие в среднем легче, чем в начале.";
  }
  if (trend === "down") {
    return "К концу периода самочувствие в среднем тяжелее, чем в начале.";
  }
  if (trend === "flat") {
    return "Самочувствие за период без явного сдвига.";
  }
  return null;
}

function buildPlainText(summary: Omit<PeriodSummary, "plainText">): string {
  const lines: string[] = [];
  lines.push(
    `После сеанса ${formatLongDate(summary.lastSession.date)} · ${pluralEntries(summary.entryCount)}`,
  );
  if (summary.feelings.length > 0) {
    lines.push(
      `Состояния: ${summary.feelings
        .map((item) => `${item.feeling} ×${item.count}`)
        .join(", ")}`,
    );
  }
  const trend = trendSentence(summary.moodTrend);
  if (trend) lines.push(trend);

  if (summary.themes.length > 0) {
    lines.push("");
    lines.push(
      `Темы: ${summary.themes.map((item) => (item.count > 1 ? `${item.tag} (×${item.count})` : item.tag)).join(", ")}`,
    );
  }

  if (summary.highlights.length > 0) {
    lines.push("");
    lines.push("Ключевые моменты:");
    for (const highlight of summary.highlights) {
      const feeling = highlight.feelingsLabel ? ` — ${highlight.feelingsLabel}` : "";
      lines.push(`• ${formatDayLabel(highlight.date)}${feeling}`);
      lines.push(`  ${highlight.excerpt}`);
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

  const periodEvents = afterSession(entries, lastSession.date);
  const periodEntries = periodEvents.filter((entry) => entry.body.trim().length > 0);
  const themes = themeCounts(periodEntries);
  const highlights = pickHighlights(periodEntries);
  const feelings = feelingTotals(periodEvents);
  const moodTrend = moodTrendOf(periodEvents);

  const base = {
    lastSession,
    entries: periodEntries,
    entryCount: periodEntries.length,
    checkinCount: periodEvents.filter((entry) => entry.source === "checkin").length,
    feelings,
    moodTrend,
    themes,
    highlights,
  };

  return { ...base, plainText: buildPlainText(base) };
}
