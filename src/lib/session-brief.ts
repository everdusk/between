import { parseDateKey } from "./dates";
import type { LocaleId } from "./i18n";
import { translate } from "./messages";
import { isSessionTime, weeklySlots } from "./session-plan";
import type { SessionPlan } from "./types";
import type { WeekAccessStatus } from "./week-access";

/** The hourly job sends the session file on the 09:00 tick of the session day. */
export const SESSION_DIGEST_HOUR = 9;

export const SESSION_BRIEF_SLOT = "session-brief";

function weekdayIndex(dateKey: string): number {
  const day = parseDateKey(dateKey).getDay();
  return day === 0 ? 6 : day - 1;
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

/** True at 09:00 local on a day that has a session. */
export function sessionBriefDue(input: {
  plan: SessionPlan | null | undefined;
  dateKey: string;
  hour: number;
}): { time: string } | null {
  const time = sessionTimeOnDay(input.plan, input.dateKey);
  if (!time || input.hour !== SESSION_DIGEST_HOUR) return null;
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
