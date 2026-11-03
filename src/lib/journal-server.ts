import { createId } from "./dates";
import { suggestTags } from "./tags";
import {
  getUserTimezone,
  loadUserStore,
  saveUserStore,
} from "./redis";
import { resolveJournalId } from "./web-account-store";
import type { CheckinSlot, Feeling, JournalEntry, TherapyStore } from "./types";
import { emptyStore } from "./types";
import { todayInTimeZone } from "./zoned";

export { timeLabelInZone, todayInTimeZone } from "./zoned";

export async function appendBotMessageToToday(
  userId: number,
  text: string,
): Promise<{ date: string; store: TherapyStore }> {
  const owner = await resolveJournalId(userId);
  const tz = await getUserTimezone(owner);
  const date = todayInTimeZone(tz);
  const body = text.trim();
  const now = new Date().toISOString();

  let store = await loadUserStore(owner);
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
  await saveUserStore(owner, next);
  return { date, store: next };
}

export async function addCheckin(
  userId: number,
  slot: CheckinSlot,
  feeling: Feeling,
): Promise<TherapyStore> {
  const owner = await resolveJournalId(userId);
  const tz = await getUserTimezone(owner);
  const date = todayInTimeZone(tz);
  const now = new Date().toISOString();
  const store = await loadUserStore(owner);
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
  await saveUserStore(owner, next);
  return next;
}
