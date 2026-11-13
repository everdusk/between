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

export const MOOD_SLOTS = ["morning", "day", "evening"] as const;

/** Same gate the hourly run uses after it opens a trial that has not started. */
export function moodPollsOpen(input: {
  onboardingOpen: boolean;
  paused: boolean;
  status: string;
}): boolean {
  return !input.onboardingOpen && !input.paused && input.status !== "locked" && input.status !== "new";
}

export type PollSlotState = {
  slot: CheckinSlot;
  sent: boolean;
  answered: boolean;
};

/** One messenger chat, judged in that person's local hour. Slots are morning, then day, then evening. */
export type PollPerson = {
  blocked: boolean;
  moodPolls: boolean;
  pollsOpen: boolean;
  reduced: boolean;
  hour: number;
  slots: PollSlotState[];
};

/**
 * Polls this person should already have today.
 * A missed earlier question is not still owed: the run sends the latest unanswered one.
 * A question that already went out stays owed, so the answer is still counted.
 */
export function pollsOwed(person: PollPerson): PollSlotState[] {
  if (person.blocked || !person.moodPolls || !person.pollsOpen || person.reduced) return [];
  const passed = person.slots.filter((slot) => person.hour >= POLL_HOURS[slot.slot]);
  const sent = passed.filter((slot) => slot.sent);
  const unanswered = passed.filter((slot) => !slot.answered);
  const latest = unanswered[unanswered.length - 1];
  if (latest && !sent.some((slot) => slot.slot === latest.slot)) return [...sent, latest];
  return sent;
}

export type PollDayCounts = {
  expected: number;
  received: number;
  replied: number;
};

/** People, not messages. Someone counts once even when morning and day are both due. */
export function tallyPollDay(people: PollPerson[]): PollDayCounts {
  const counts: PollDayCounts = { expected: 0, received: 0, replied: 0 };
  for (const person of people) {
    const owed = pollsOwed(person);
    if (owed.length === 0) continue;
    counts.expected += 1;
    if (!owed.every((slot) => slot.sent)) continue;
    counts.received += 1;
    if (owed.every((slot) => slot.answered)) counts.replied += 1;
  }
  return counts;
}

export function pollText(slot: CheckinSlot, locale: LocaleId = "ru"): string {
  return translate(locale, POLL_KEY[slot]);
}

export function nudgeText(locale: LocaleId = "ru"): string {
  return translate(locale, "botNudge");
}

/** What the last hourly run did. Stored so `/stats` can show whether polls go out at all. */
export type DigestRun = {
  at: string;
  users: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: number;
  ms: number;
};

/** A round of users sent in parallel. Keeps the hourly run inside the function limit. */
export const DIGEST_BATCH = 8;

/** The run is stale when the hourly schedule has clearly missed a tick. */
export const DIGEST_STALE_MS = 2 * 60 * 60 * 1000 + 15 * 60 * 1000;

export function parseDigestRun(value: unknown): DigestRun | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.at !== "string" || Number.isNaN(Date.parse(row.at))) return null;
  const count = (key: string) => {
    const number = typeof row[key] === "number" ? (row[key] as number) : Number(row[key]);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
  };
  return {
    at: row.at,
    users: count("users"),
    sent: count("sent"),
    skipped: count("skipped"),
    failed: count("failed"),
    errors: count("errors"),
    ms: count("ms"),
  };
}

/**
 * Today's polls for `/stats`. Each person is counted in their own timezone.
 * Telegram and MAX do not tell a bot that a private message was opened, so there is no "saw it" count.
 */
export function formatPollDay(counts: PollDayCounts, run: DigestRun | null, now = new Date()): string {
  const lines = ["Опросы сегодня, по их времени"];
  if (!run) {
    lines.push("Расписание ещё не запускалось. Проверьте QStash.");
  } else if (now.getTime() - Date.parse(run.at) > DIGEST_STALE_MS) {
    const hours = Math.floor((now.getTime() - Date.parse(run.at)) / 3_600_000);
    lines.push(`Расписание молчит ${hours} ч. Проверьте QStash.`);
  }
  lines.push(
    `Должны были получить ${counts.expected} человек`,
    `Получили все положенные ${counts.received}`,
    `Ответили на все ${counts.replied}`,
  );
  return lines.join("\n");
}
