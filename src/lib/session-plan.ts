import { formatLongDate, toDateKey } from "./dates";
import type { SessionPlan } from "./types";

export const WEEKDAY_LONG = [
  "понедельник",
  "вторник",
  "среду",
  "четверг",
  "пятницу",
  "субботу",
  "воскресенье",
] as const;

export const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isSessionTime(value: string): boolean {
  return TIME_RE.test(value);
}

function weekdayIndex(date: Date): number {
  return date.getDay() === 0 ? 6 : date.getDay() - 1;
}

export function onceSessionDate(plan: SessionPlan): Date | null {
  if (!plan.date || !isSessionTime(plan.time)) return null;
  const [year, month, day] = plan.date.split("-").map(Number);
  const [hour, minute] = plan.time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function nextWeeklyOccurrence(
  plan: SessionPlan,
  now = new Date(),
): Date | null {
  if (!isSessionTime(plan.time)) return null;
  if (!Number.isInteger(plan.weekday) || plan.weekday < 0 || plan.weekday > 6) {
    return null;
  }
  const [hour, minute] = plan.time.split(":").map(Number);
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      hour,
      minute,
      0,
      0,
    );
    if (weekdayIndex(candidate) === plan.weekday && candidate.getTime() >= now.getTime()) {
      return candidate;
    }
  }
  return null;
}

export function describeSessionPlan(plan: SessionPlan, now = new Date()): string {
  if (plan.mode === "once") {
    const at = onceSessionDate(plan);
    if (!at) return "Укажите дату и время ближайшего сеанса.";
    const when = `${formatLongDate(plan.date)}, ${plan.time}`;
    if (at.getTime() < now.getTime()) return `Эта встреча уже прошла: ${when}.`;
    return `Следующий сеанс: ${when}.`;
  }
  const next = nextWeeklyOccurrence(plan, now);
  if (!next) return "Укажите день и время еженедельного сеанса.";
  const day = WEEKDAY_LONG[plan.weekday] ?? "день";
  return `Каждый ${day} в ${plan.time}. Ближайший — ${formatLongDate(toDateKey(next))}.`;
}
