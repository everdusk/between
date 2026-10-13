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

export function pollText(slot: CheckinSlot, locale: LocaleId = "ru"): string {
  return translate(locale, POLL_KEY[slot]);
}

export function nudgeText(locale: LocaleId = "ru"): string {
  return translate(locale, "botNudge");
}
