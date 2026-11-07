import type { LocaleId } from "./i18n";
import { translate } from "./messages";
import type { CheckinSlot, TherapyStore } from "./types";

export const POLL_HOURS = {
  morning: 9,
  day: 14,
  evening: 18,
  nudge: 21,
} as const;

export type DigestSlot = CheckinSlot | "nudge";

export type DigestAction =
  | { type: "skip"; reason: string }
  | { type: "poll"; slot: CheckinSlot }
  | { type: "nudge" };

/** Telegram users are stored by numeric id. MAX users are `max:<id>`, so the two never share a journal by accident. */
export function digestChannel(userId: string): "telegram" | "max" | null {
  if (/^\d+$/.test(userId)) return "telegram";
  if (/^max:\d+$/.test(userId)) return "max";
  return null;
}

export function maxUserIdFromDigest(userId: string): number | null {
  const match = /^max:(\d+)$/.exec(userId);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function slotForHour(hour: number): DigestSlot | null {
  if (hour === POLL_HOURS.morning) return "morning";
  if (hour === POLL_HOURS.day) return "day";
  if (hour === POLL_HOURS.evening) return "evening";
  if (hour === POLL_HOURS.nudge) return "nudge";
  return null;
}

export function hasCheckin(
  store: TherapyStore,
  dateKey: string,
  slot: CheckinSlot,
): boolean {
  return store.entries.some(
    (entry) => entry.date === dateKey && entry.slot === slot,
  );
}

export function hasNote(store: TherapyStore, dateKey: string): boolean {
  return store.entries.some(
    (entry) => entry.date === dateKey && entry.body.trim().length > 0,
  );
}

export function digestAction(input: {
  localHour: number;
  dateKey: string;
  store: TherapyStore;
  alreadySent: boolean;
}): DigestAction {
  if (input.alreadySent) return { type: "skip", reason: "already_sent" };
  const slot = slotForHour(input.localHour);
  if (!slot) return { type: "skip", reason: "not_due" };

  if (slot === "nudge") {
    if (!input.store.notify.eveningNudge) {
      return { type: "skip", reason: "nudge_off" };
    }
    if (hasNote(input.store, input.dateKey)) {
      return { type: "skip", reason: "has_note" };
    }
    return { type: "nudge" };
  }

  if (!input.store.notify.moodPolls) {
    return { type: "skip", reason: "polls_off" };
  }
  if (hasCheckin(input.store, input.dateKey, slot)) {
    return { type: "skip", reason: "has_checkin" };
  }
  return { type: "poll", slot };
}

const POLL_KEY = {
  morning: "botPollMorning",
  day: "botPollDay",
  evening: "botPollEvening",
} as const;

/** The latest mood question whose hour has passed today and is still unanswered. */
export function duePoll(input: {
  store: TherapyStore;
  dateKey: string;
  hour: number;
}): CheckinSlot | null {
  if (!input.store.notify.moodPolls) return null;
  let due: CheckinSlot | null = null;
  for (const slot of ["morning", "day", "evening"] as const) {
    if (input.hour < POLL_HOURS[slot]) break;
    if (!hasCheckin(input.store, input.dateKey, slot)) due = slot;
  }
  return due;
}

export function pollText(slot: CheckinSlot, locale: LocaleId = "ru"): string {
  return translate(locale, POLL_KEY[slot]);
}

export function nudgeText(locale: LocaleId = "ru"): string {
  return translate(locale, "botNudge");
}
