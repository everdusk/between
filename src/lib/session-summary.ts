import { addDays, dateKeysBetween, formatDayLabel, formatLongDate, parseDateKey, toDateKey } from "@/lib/dates";
import { feelingValence, formatFeelings } from "@/lib/feelings";
import {
  clockLabel,
  nextWeeklyOccurrence,
  previousWeeklyOccurrence,
  weeklySlots,
} from "@/lib/session-plan";
import type { Feeling, JournalEntry, SessionNote, SessionPlan } from "@/lib/types";

const EXCERPT_MAX = 180;

/** Latest session on or before `todayKey`, by date then updatedAt. */
export function getLastSession(
  sessions: SessionNote[],
  todayKey?: string,
): SessionNote | null {
  const pool = todayKey ? sessions.filter((session) => session.date <= todayKey) : sessions;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.updatedAt.localeCompare(a.updatedAt);
  })[0];
}

export function therapyWeekKey(session: SessionNote | null): string {
  return session ? `since:${session.date}` : "open";
}

export type TherapyWindow = {
  last: SessionNote | null;
  days: string[];
  previousDays: string[];
  /** Notes at this instant still belong to the previous interval. */
  startsAfter: Date | null;
  /** Notes after this instant belong to the next interval. */
  endsAt: Date | null;
  weekKey: string;
};

export function entryInstant(entry: Pick<JournalEntry, "createdAt" | "date">): Date {
  const parsed = new Date(entry.createdAt);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return parseDateKey(entry.date);
}

export function entryInWindow(
  entry: Pick<JournalEntry, "createdAt" | "date">,
  period: Pick<TherapyWindow, "days" | "startsAfter" | "endsAt">,
): boolean {
  if (!period.days.includes(entry.date)) return false;
  const at = entryInstant(entry).getTime();
  if (period.startsAfter && at <= period.startsAfter.getTime()) return false;
  if (period.endsAt && at > period.endsAt.getTime()) return false;
  return true;
}

function weekdayOf(date: Date): number {
  return date.getDay() === 0 ? 6 : date.getDay() - 1;
}

function loggedBoundary(session: SessionNote, slots: { weekday: number; time: string }[]): Date {
  const day = parseDateKey(session.date);
  const slot = slots.find((item) => item.weekday === weekdayOf(day));
  if (!slot) return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 0, 0);
  const [hour, minute] = slot.time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

/** The spectrum stays through the session and turns over an hour after it starts. */
const WEEK_HOLDS_AFTER_START_MS = 60 * 60 * 1000;

function weekTurnsAt(sessionStart: Date): Date {
  return new Date(sessionStart.getTime() + WEEK_HOLDS_AFTER_START_MS);
}

function dateOnlyWindow(
  sessions: SessionNote[],
  entries: JournalEntry[],
  todayKey: string,
): TherapyWindow {
  const held = [...sessions]
    .filter((session) => session.date <= todayKey)
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  const last = held[0] ?? null;
  const previous = held[1] ?? null;
  const days = last
    ? dateKeysBetween(addDays(last.date, 1), todayKey)
    : dateKeysBetween(
        entries
          .map((entry) => entry.date)
          .filter((date) => date <= todayKey)
          .sort()[0] ?? todayKey,
        todayKey,
      );
  const previousDays =
    last && previous ? dateKeysBetween(addDays(previous.date, 1), last.date) : [];
  return {
    last,
    days,
    previousDays,
    startsAfter: null,
    endsAt: null,
    weekKey: therapyWeekKey(last),
  };
}

/**
 * The therapy week runs from the day after the last session through today.
 * A weekly schedule keeps that week open for an hour after the session starts,
 * so the spectrum is still there while the session is going on. Thursday 17:00
 * turns the week over at 18:00.
 * Without a schedule it runs from the first note through today, not from Monday.
 */
export function therapyWindow(
  sessions: SessionNote[],
  entries: JournalEntry[],
  todayKey: string,
  now = new Date(),
  plan: SessionPlan | null = null,
): TherapyWindow {
  const base = dateOnlyWindow(sessions, entries, todayKey);
  const slots = weeklySlots(plan);
  if (!plan || slots.length === 0) return base;

  let sessionStart = previousWeeklyOccurrence(plan, now);
  if (sessionStart && weekTurnsAt(sessionStart).getTime() > now.getTime()) {
    sessionStart = previousWeeklyOccurrence(plan, new Date(sessionStart.getTime() - 60_000));
  }
  for (const session of sessions) {
    if (session.date > todayKey) continue;
    const logged = loggedBoundary(session, slots);
    const onSchedule = slots.some((slot) => slot.weekday === weekdayOf(parseDateKey(session.date)));
    if (onSchedule && weekTurnsAt(logged).getTime() > now.getTime()) continue;
    if (!sessionStart || logged.getTime() > sessionStart.getTime()) sessionStart = logged;
  }
  if (!sessionStart) return base;

  const startsAfter = weekTurnsAt(sessionStart);
  const nextStart = nextWeeklyOccurrence(plan, new Date(sessionStart.getTime() + 60_000));
  const endsAt = nextStart ? weekTurnsAt(nextStart) : null;
  const onASlot = slots.some(
    (slot) => slot.weekday === weekdayOf(sessionStart) && slot.time === clockLabel(sessionStart),
  );
  const startKey = onASlot ? toDateKey(sessionStart) : addDays(toDateKey(sessionStart), 1);
  return {
    last: base.last,
    days: dateKeysBetween(startKey, todayKey),
    previousDays: base.previousDays,
    startsAfter,
    endsAt,
    weekKey: `since:${toDateKey(sessionStart)}T${clockLabel(sessionStart)}`,
  };
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

  if (summary.entries.length > 0) {
    lines.push("");
    lines.push("Записи:");
    for (const entry of summary.entries) {
      const feeling = entry.feelings.length ? ` — ${formatFeelings(entry.feelings)}` : "";
      lines.push(`• ${formatDayLabel(entry.date)}${feeling}`);
      for (const line of entry.body.trim().split("\n")) lines.push(`  ${line}`);
    }
  }

  return lines.join("\n");
}

export function buildPeriodSummary(
  entries: JournalEntry[],
  sessions: SessionNote[],
): PeriodSummary | null {
  const lastSession = getLastSession(sessions, toDateKey());
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
