import { createId } from "./dates";
import {
  getUserTimezone,
  loadUserStore,
  saveUserStore,
} from "./redis";
import type { JournalEntry, MoodLevel, TherapyStore } from "./types";
import { emptyStore } from "./types";

/** Today's YYYY-MM-DD in the given IANA timezone (falls back to UTC). */
export function todayInTimeZone(timeZone?: string | null): string {
  const tz = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fall through
  }
  return new Date().toISOString().slice(0, 10);
}

export function timeLabelInZone(timeZone?: string | null): string {
  const tz = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    const d = new Date();
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  }
}

function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function appendBotMessageToToday(
  userId: number,
  text: string,
): Promise<{ date: string; store: TherapyStore }> {
  const tz = await getUserTimezone(userId);
  const date = todayInTimeZone(tz);
  const stamp = timeLabelInZone(tz);
  const line = `[${stamp}] ${text.trim()}`;

  let store = await loadUserStore(userId);
  if (!store) store = emptyStore();

  const now = new Date().toISOString();
  const existing = store.entries.find((e) => e.date === date);

  let entries: JournalEntry[];
  if (existing) {
    const body = existing.body.trim()
      ? `${existing.body.trim()}\n\n${line}`
      : line;
    entries = store.entries.map((e) =>
      e.id === existing.id
        ? { ...e, body, updatedAt: now }
        : e,
    );
  } else {
    const mood: MoodLevel = 3;
    entries = [
      {
        id: createId(),
        date,
        mood,
        body: line,
        tags: ["бот"],
        updatedAt: now,
      },
      ...store.entries,
    ];
  }

  const next: TherapyStore = { ...store, entries };
  await saveUserStore(userId, next);
  return { date, store: next };
}
