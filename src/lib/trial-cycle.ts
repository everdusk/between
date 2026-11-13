import { addDays } from "./dates";
import { sessionTimeOnDay } from "./session-brief";
import type { SessionPlan } from "./types";
import type { WeekAccessRecord, WeekAccessStatus } from "./week-access";
import { TRIAL_MS } from "./week-access";
import { zonedParts } from "./zoned";

/** The hourly job has no :30 tick. 09:00 is the session-morning send. */
export const SESSION_DIGEST_HOUR = 9;
export const SLICE_HOUR = 12;
export const EVENING_HOUR = 21;
export const RENEWAL_HOUR = 12;
export const LAST_DAY_HOUR = 9;
export const FULL_DIGEST_MIN_DAYS = 3;
export const QUIZ_REMINDER_MS = 24 * 60 * 60 * 1000;
export const NUDGE_DELAY_MS = 48 * 60 * 60 * 1000;
export const QUIET_FROM = 22;
export const QUIET_UNTIL = 9;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CycleKind =
  | "digest-full"
  | "digest-mini"
  | "slice"
  | "paywall"
  | "day5"
  | "nudge1"
  | "nudge2"
  | "renew-soon"
  | "renew-last"
  | "expired"
  | "session-ask"
  | "midpoint";

export type PaywallVariant = "ahead" | "had" | "none";

export type CycleItem = {
  kind: CycleKind;
  /** Claimed per day. One-time items are stamped on the access record instead. */
  slot?: string;
  time?: string;
  days?: number;
  when?: string;
  variant?: PaywallVariant;
};

export function quietHour(hour: number): boolean {
  return hour >= QUIET_FROM || hour < QUIET_UNTIL;
}

export function pingsReduced(
  openedAt: string | null,
  entries: { createdAt: string }[],
  now: Date,
): boolean {
  const start = openedAt ? Date.parse(openedAt) : NaN;
  if (!Number.isFinite(start) || now.getTime() - start < 3 * DAY_MS) return false;
  const cutoff = now.getTime() - 3 * DAY_MS;
  return !entries.some((entry) => {
    const ms = Date.parse(entry.createdAt);
    return Number.isFinite(ms) && ms >= cutoff;
  });
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / DAY_MS);
}

function clockHour(time: string): number | null {
  const hour = Number(time.slice(0, 2));
  return Number.isInteger(hour) ? hour : null;
}

export function nextSession(
  plan: SessionPlan | null | undefined,
  dateKey: string,
  hour: number,
): { date: string; time: string } | null {
  if (!plan) return null;
  for (let offset = 0; offset <= 21; offset += 1) {
    const date = addDays(dateKey, offset);
    const time = sessionTimeOnDay(plan, date);
    if (!time) continue;
    const sessionHour = clockHour(time);
    if (offset === 0 && sessionHour !== null && sessionHour <= hour) continue;
    return { date, time };
  }
  return null;
}

function previousGap(plan: SessionPlan | null | undefined, dateKey: string): number | null {
  if (!plan) return null;
  for (let offset = 1; offset <= 21; offset += 1) {
    if (sessionTimeOnDay(plan, addDays(dateKey, -offset))) return offset;
  }
  return null;
}

function hadSessionSince(plan: SessionPlan | null | undefined, startKey: string, dateKey: string, hour: number): boolean {
  if (!plan) return false;
  const span = daysBetween(startKey, dateKey);
  for (let offset = 0; offset <= span; offset += 1) {
    const date = addDays(startKey, offset);
    const time = sessionTimeOnDay(plan, date);
    if (!time) continue;
    if (date < dateKey) return true;
    const sessionHour = clockHour(time);
    if (date === dateKey && sessionHour !== null && sessionHour <= hour) return true;
  }
  return false;
}

function paywallVariant(
  plan: SessionPlan | null | undefined,
  startKey: string,
  dateKey: string,
  hour: number,
): PaywallVariant {
  const upcoming = nextSession(plan, dateKey, hour);
  if (upcoming) return "ahead";
  if (hadSessionSince(plan, startKey, dateKey, hour)) return "had";
  return "none";
}

export function dueCycle(input: {
  record: WeekAccessRecord;
  status: WeekAccessStatus;
  plan: SessionPlan | null | undefined;
  dateKey: string;
  hour: number;
  now: Date;
  timeZone: string;
  onboardingOpen: boolean;
}): CycleItem[] {
  if (input.record.pausedAt || quietHour(input.hour)) return [];
  const items: CycleItem[] = [];
  const trial = input.status === "trial";
  const paid = input.status === "paid";
  const locked = input.status === "locked";
  const live = trial || paid;
  const openedMs = input.record.openedAt ? Date.parse(input.record.openedAt) : NaN;
  const startKey = Number.isFinite(openedMs)
    ? zonedParts(new Date(openedMs), input.timeZone).dateKey
    : null;
  const trialDay = startKey ? daysBetween(startKey, input.dateKey) : null;

  if (live && !input.onboardingOpen) {
    const time = sessionTimeOnDay(input.plan, input.dateKey);
    if (time && input.hour === SESSION_DIGEST_HOUR) {
      const gap = previousGap(input.plan, input.dateKey);
      const full = gap === null || gap >= FULL_DIGEST_MIN_DAYS;
      items.push({ kind: full ? "digest-full" : "digest-mini", slot: full ? "digest-full" : "digest-mini", time });
    }
    const upcoming = nextSession(input.plan, input.dateKey, input.hour);
    if (upcoming && input.hour === EVENING_HOUR) {
      const days = daysBetween(input.dateKey, upcoming.date);
      if (days === 2 || days === 3) items.push({ kind: "session-ask", slot: "session-ask", days });
    }
    const gap = previousGap(input.plan, input.dateKey);
    if (gap !== null && gap >= 7 && input.hour === SLICE_HOUR) {
      const previous = addDays(input.dateKey, -gap);
      const mid = addDays(previous, Math.round(gap / 2));
      if (mid === input.dateKey) items.push({ kind: "midpoint", slot: "midpoint" });
    }
  }

  if (trial && trialDay === 5 && input.hour === EVENING_HOUR && !input.record.day5At && startKey) {
    items.push({ kind: "day5", when: addDays(startKey, 7) });
  }

  const trialEnd = Number.isFinite(openedMs) ? openedMs + TRIAL_MS : NaN;
  const sliceWindow =
    Number.isFinite(trialEnd) && input.now.getTime() < trialEnd + DAY_MS && (trial || locked);
  if (sliceWindow && trialDay === 7 && input.hour === SLICE_HOUR && startKey) {
    if (!input.record.sliceAt) items.push({ kind: "slice" });
    if (!input.record.paywallAt && !input.record.paidUntil) {
      items.push({
        kind: "paywall",
        variant: paywallVariant(input.plan, startKey, input.dateKey, input.hour),
        when: nextSession(input.plan, input.dateKey, input.hour)?.date,
      });
    }
  }

  const paywallMs = input.record.paywallAt ? Date.parse(input.record.paywallAt) : NaN;
  if (locked && !input.record.paidUntil && Number.isFinite(paywallMs)) {
    if (!input.record.nudge1At && input.now.getTime() >= paywallMs + NUDGE_DELAY_MS && input.hour >= QUIET_UNTIL && input.hour < QUIET_FROM) {
      items.push({
        kind: "nudge1",
        when: nextSession(input.plan, input.dateKey, input.hour)?.date,
      });
    }
    const upcoming = nextSession(input.plan, input.dateKey, input.hour);
    if (
      !input.record.nudge2At &&
      upcoming &&
      daysBetween(input.dateKey, upcoming.date) === 1 &&
      input.hour === EVENING_HOUR
    ) {
      items.push({ kind: "nudge2", when: upcoming.date });
    }
  }

  const paidMs = input.record.paidUntil ? Date.parse(input.record.paidUntil) : NaN;
  if (Number.isFinite(paidMs)) {
    const endKey = zonedParts(new Date(paidMs), input.timeZone).dateKey;
    if (paid && input.dateKey === addDays(endKey, -3) && input.hour === RENEWAL_HOUR && !input.record.renewSoonAt) {
      items.push({ kind: "renew-soon", when: endKey });
    }
    if (paid && input.dateKey === endKey && input.hour === LAST_DAY_HOUR && !input.record.renewLastAt) {
      items.push({ kind: "renew-last", when: endKey });
    }
    if (locked && paidMs <= input.now.getTime() && !input.record.expiredNoticeAt && input.hour >= QUIET_UNTIL && input.hour < QUIET_FROM) {
      items.push({ kind: "expired", when: endKey });
    }
  }

  return items;
}
