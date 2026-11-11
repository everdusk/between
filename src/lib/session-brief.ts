import { parseDateKey } from "./dates";
import type { LocaleId } from "./i18n";
import { translate } from "./messages";
import { isSessionTime, weeklySlots } from "./session-plan";
import type { SessionPlan } from "./types";
import type { WeekAccessStatus } from "./week-access";

/** The hourly job sends once inside this window, on the session day. */
export const SESSION_BRIEF_LEAD_HOURS = 2;

export const SESSION_BRIEF_SLOT = "session-brief";

function weekdayIndex(dateKey: string): number {
  const day = parseDateKey(dateKey).getDay();
  return day === 0 ? 6 : day - 1;
}

function clockHour(time: string): number | null {
  if (!isSessionTime(time)) return null;
  return Number(time.slice(0, 2));
}

/** The session clock on this calendar day, when the plan has one. */
export function sessionTimeOnDay(plan: SessionPlan | null | undefined, dateKey: string): string | null {
  if (!plan) return null;
  if (plan.mode === "once") {
    return plan.date === dateKey && isSessionTime(plan.time) ? plan.time : null;
  }
  const slot = weeklySlots(plan).find((item) => item.weekday === weekdayIndex(dateKey));
  return slot?.time ?? null;
}

/**
 * True from two hours before the session until the session hour starts.
 * A 18:30 session sends at 16:00 and, if that hour was missed, at 17:00.
 * The session day stays the same day: a 01:00 session has no two-hour window left.
 */
export function sessionBriefDue(input: {
  plan: SessionPlan | null | undefined;
  dateKey: string;
  hour: number;
}): { time: string } | null {
  const time = sessionTimeOnDay(input.plan, input.dateKey);
  if (!time) return null;
  const sessionHour = clockHour(time);
  if (sessionHour === null || sessionHour < SESSION_BRIEF_LEAD_HOURS) return null;
  const lead = sessionHour - SESSION_BRIEF_LEAD_HOURS;
  if (input.hour < lead || input.hour >= sessionHour) return null;
  return { time };
}

/** Paid premium and a live trial both get the sheet. A locked week does not. */
export function sessionPdfOpen(status: WeekAccessStatus): boolean {
  return status === "paid" || status === "trial";
}

/** One line on the file. The sheet itself is the summary. */
export function sessionPdfCaption(locale: LocaleId, time: string): string {
  return translate(locale, "botSessionBriefLead", { time });
}
