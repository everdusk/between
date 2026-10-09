import { createId } from "./dates";
import { suggestTags } from "./tags";
import {
  getUserTimezone,
  loadUserStore,
  saveUserStore,
} from "./redis";
import type { CheckinSlot, Feeling, JournalEntry, TherapyStore } from "./types";
import { emptyStore } from "./types";
import { todayInTimeZone } from "./zoned";

export { timeLabelInZone, todayInTimeZone } from "./zoned";

export async function appendBotMessageToToday(
  userId: number,
  text: string,
): Promise<{ date: string; store: TherapyStore }> {
  const tz = await getUserTimezone(userId);
  const date = todayInTimeZone(tz);
  const body = text.trim();
  const now = new Date().toISOString();

  let store = await loadUserStore(userId);
  if (!store.entries) store = emptyStore();

  const entry: JournalEntry = {
    id: createId(),
    date,
    createdAt: now,
    updatedAt: now,
    body,
    feelings: [],
    tags: suggestTags(body),
    source: "bot",
  };

  const next: TherapyStore = {
    ...store,
    entries: [entry, ...store.entries],
  };
  await saveUserStore(userId, next);
  return { date, store: next };
}

export async function addCheckin(
  userId: number,
  slot: CheckinSlot,
  feeling: Feeling,
): Promise<TherapyStore> {
  const tz = await getUserTimezone(userId);
  const date = todayInTimeZone(tz);
  const now = new Date().toISOString();
  const store = await loadUserStore(userId);
  const existing = store.entries.find(
    (entry) => entry.date === date && entry.slot === slot && entry.source === "checkin",
  );

  const entries = existing
    ? store.entries.map((entry) =>
        entry.id === existing.id
          ? { ...entry, feelings: [feeling], updatedAt: now }
          : entry,
      )
    : [
        {
          id: createId(),
          date,
          createdAt: now,
          updatedAt: now,
          body: "",
          feelings: [feeling],
          tags: [],
          source: "checkin" as const,
          slot,
        },
        ...store.entries,
      ];

  const next: TherapyStore = { ...store, entries };
  await saveUserStore(userId, next);
  return next;
}
