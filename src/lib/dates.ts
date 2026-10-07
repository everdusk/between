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

const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
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

export function formatDayLabel(key: string): string {
  const d = parseDateKey(key);
  const weekday = WEEKDAY_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1];
  return `${weekday}, ${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

export function formatWeekRange(date: Date = new Date()): string {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_GENITIVE[start.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS_GENITIVE[start.getMonth()]} – ${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]}`;
}

export function formatLongDate(key: string): string {
  const d = parseDateKey(key);
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]} ${d.getFullYear()}`;
}

export function createId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
