import { DEFAULT_TIME_ZONE } from "./types";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(timeZone?: string | null): string {
  if (timeZone && isValidTimeZone(timeZone)) return timeZone;
  return DEFAULT_TIME_ZONE;
}

export function zonedParts(
  date: Date,
  timeZone?: string | null,
): { dateKey: string; hour: number; minute: number } {
  const tz = resolveTimeZone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const pick = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;
    const year = pick("year");
    const month = pick("month");
    const day = pick("day");
    const hour = Number(pick("hour"));
    const minute = Number(pick("minute"));
    if (year && month && day && Number.isFinite(hour) && Number.isFinite(minute)) {
      return {
        dateKey: `${year}-${month}-${day}`,
        hour: hour === 24 ? 0 : hour,
        minute,
      };
    }
  } catch {
    // fall through
  }
  return {
    dateKey: date.toISOString().slice(0, 10),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

export function todayInTimeZone(timeZone?: string | null, now = new Date()): string {
  return zonedParts(now, timeZone).dateKey;
}

export function timeLabelInZone(timeZone?: string | null, now = new Date()): string {
  const { hour, minute } = zonedParts(now, timeZone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
