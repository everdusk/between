import { formatLongDate, toDateKey } from "./dates";
import type { SessionPlan, SessionSlot } from "./types";

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

export function weeklySlots(plan: SessionPlan | null | undefined): SessionSlot[] {
  if (!plan || plan.mode !== "weekly") return [];
  const raw =
    plan.slots && plan.slots.length > 0
      ? plan.slots
      : isSessionTime(plan.time) && Number.isInteger(plan.weekday)
        ? [{ weekday: plan.weekday, time: plan.time }]
        : [];
  const byDay = new Map<number, string>();
  for (const slot of raw) {
    if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6) continue;
    if (!isSessionTime(slot.time)) continue;
    byDay.set(slot.weekday, slot.time);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, time]) => ({ weekday, time }));
}

function atLocal(day: Date, time: string): Date {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

/** Soonest chosen day whose time is still ahead, including this minute. */
export function nextWeeklyOccurrence(
  plan: SessionPlan,
  now = new Date(),
): Date | null {
  const slots = weeklySlots(plan);
  let best: Date | null = null;
  for (const slot of slots) {
    for (let offset = 0; offset < 8; offset += 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      if (weekdayIndex(day) !== slot.weekday) continue;
      const candidate = atLocal(day, slot.time);
      if (candidate.getTime() < now.getTime()) continue;
      if (!best || candidate.getTime() < best.getTime()) best = candidate;
      break;
    }
  }
  return best;
}

/** Latest chosen day whose start has already arrived. The week turns an hour after that. */
export function previousWeeklyOccurrence(
  plan: SessionPlan,
  now = new Date(),
): Date | null {
  const slots = weeklySlots(plan);
  let best: Date | null = null;
  for (const slot of slots) {
    for (let offset = 0; offset < 8; offset += 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      if (weekdayIndex(day) !== slot.weekday) continue;
      const candidate = atLocal(day, slot.time);
      if (candidate.getTime() > now.getTime()) continue;
      if (!best || candidate.getTime() > best.getTime()) best = candidate;
      break;
    }
  }
  return best;
}

export function clockLabel(at: Date): string {
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}

export function describeSessionPlan(plan: SessionPlan, now = new Date()): string {
  if (plan.mode === "once") {
    const at = onceSessionDate(plan);
    if (!at) return "Укажите дату и время ближайшего сеанса.";
    const when = `${formatLongDate(plan.date)}, ${plan.time}`;
    if (at.getTime() < now.getTime()) return `Эта встреча уже прошла: ${when}.`;
    return `Следующий сеанс: ${when}.`;
  }
  const slots = weeklySlots(plan);
  const next = nextWeeklyOccurrence(plan, now);
  if (slots.length === 0 || !next) return "Укажите день и время еженедельного сеанса.";
  const days = slots
    .map((slot) => `${WEEKDAY_LONG[slot.weekday] ?? "день"} в ${slot.time}`)
    .join(", ");
  return `${days}. Ближайший — ${formatLongDate(toDateKey(next))}, ${clockLabel(next)}.`;
}
