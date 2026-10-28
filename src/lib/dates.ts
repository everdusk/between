/** ISO date YYYY-MM-DD in local timezone */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the week containing `date` (local) */
export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function endOfWeek(date: Date = new Date()): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

/** ISO week key: YYYY-Www */
export function weekKey(date: Date = new Date()): string {
  const start = startOfWeek(date);
  const yearStart = new Date(start.getFullYear(), 0, 1);
  const weekNum = Math.floor(
    (start.getTime() - yearStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
  ) + 1;
  return `${start.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function weekDayKeys(date: Date = new Date()): string[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateKey(d);
  });
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Inclusive span. Empty when `startKey` is after `endKey`. */
export function dateKeysBetween(startKey: string, endKey: string): string[] {
  if (startKey > endKey) return [];
  const keys: string[] = [];
  let cursor = startKey;
  while (cursor <= endKey && keys.length < 400) {
    keys.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return keys;
}

const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const MONTHS_NOMINATIVE = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const INTL_LOCALE: Record<string, string> = {
  en: "en",
  hi: "hi",
  id: "id",
  pt: "pt-BR",
  es: "es",
  ar: "ar",
  vi: "vi",
  uk: "uk",
  tr: "tr",
  fa: "fa",
  uz: "uz",
};

function intlTag(locale?: string): string | null {
  if (!locale || locale === "ru") return null;
  return INTL_LOCALE[locale] ?? null;
}

export function weekdayShort(key: string, locale?: string): string {
  const tag = intlTag(locale);
  const d = parseDateKey(key);
  if (!tag) return WEEKDAY_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1];
  return new Intl.DateTimeFormat(tag, { weekday: "short" }).format(d);
}

const WEEKDAY_NOMINATIVE = [
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
  "воскресенье",
];

/** Monday = 0. A standalone label: «суббота», not «субботу». */
export function weekdayName(index: number, locale?: string): string {
  const tag = intlTag(locale);
  if (!tag || index < 0 || index > 6) return WEEKDAY_NOMINATIVE[index] ?? "";
  const monday = new Date(2026, 0, 5 + index);
  return new Intl.DateTimeFormat(tag, { weekday: "long" }).format(monday);
}

/** Monday = 0. Russian keeps the accusative used in «каждый вторник». */
export function weekdayLong(index: number, locale?: string): string {
  const tag = intlTag(locale);
  if (!tag || index < 0 || index > 6) {
    return ["понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"][index] ?? "";
  }
  const monday = new Date(2026, 0, 5 + index);
  return new Intl.DateTimeFormat(tag, { weekday: "long" }).format(monday);
}

export function formatDayLabel(key: string, locale?: string): string {
  const tag = intlTag(locale);
  const d = parseDateKey(key);
  if (!tag) return `${weekdayShort(key)}, ${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
  return new Intl.DateTimeFormat(tag, {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function formatWeekRange(date: Date = new Date(), locale?: string): string {
  return formatDateSpan(toDateKey(startOfWeek(date)), toDateKey(endOfWeek(date)), locale);
}

/** Day span for a therapy week, not a Monday–Sunday calendar week. */
export function formatDateSpan(startKey: string, endKey: string, locale?: string): string {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const tag = intlTag(locale);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (!tag) {
    if (startKey === endKey) return `${start.getDate()} ${MONTHS_GENITIVE[start.getMonth()]}`;
    if (sameMonth) return `${start.getDate()}–${end.getDate()} ${MONTHS_GENITIVE[start.getMonth()]}`;
    return `${start.getDate()} ${MONTHS_GENITIVE[start.getMonth()]} – ${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]}`;
  }
  const month = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long" });
  if (startKey === endKey) return month.format(start);
  if (sameMonth) {
    const monthName = new Intl.DateTimeFormat(tag, { month: "long" }).format(start);
    return `${start.getDate()}–${end.getDate()} ${monthName}`;
  }
  return `${month.format(start)} – ${month.format(end)}`;
}

export function formatLongDate(key: string, locale?: string): string {
  const tag = intlTag(locale);
  const d = parseDateKey(key);
  if (!tag) return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]} ${d.getFullYear()}`;
  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatTime(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const tag = intlTag(locale) ?? "ru-RU";
  return date.toLocaleTimeString(tag, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function trailingDateKeys(days: number, from = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() - offset);
    keys.push(toDateKey(date));
  }
  return keys;
}

export function monthStartKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function shiftMonth(key: string, delta: number): string {
  const date = parseDateKey(monthStartKey(key));
  date.setMonth(date.getMonth() + delta);
  return toDateKey(date);
}

/** Monday-first month. `null` pads the leading and trailing weekdays. */
export function monthCells(key: string): (string | null)[] {
  const first = parseDateKey(monthStartKey(key));
  const lead = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= count; day += 1) {
    cells.push(toDateKey(new Date(first.getFullYear(), first.getMonth(), day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function formatMonthTitle(key: string, locale?: string): string {
  const date = parseDateKey(monthStartKey(key));
  const tag = intlTag(locale);
  if (!tag) return `${MONTHS_NOMINATIVE[date.getMonth()]} ${date.getFullYear()}`;
  return new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }).format(date);
}

export function createId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
