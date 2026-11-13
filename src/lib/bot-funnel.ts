import { analyticsDedupToken, analyticsRedis } from "./analytics";
import {
  analyticsCount,
  analyticsDedupKey,
  analyticsQuiet,
  reportDaySpan,
  statsWindow,
} from "./analytics-model";
import { weekdayShort } from "./dates";
import { ONBOARD_HOURS } from "./onboarding";
import { feelingLabel } from "./messages";
import { PICKER_FEELINGS, type Feeling, DEFAULT_TIME_ZONE } from "./types";
import { todayInTimeZone } from "./zoned";

const DEDUP_TTL_SEC = 3 * 24 * 60 * 60;
const COUNTER_TTL_SEC = 400 * 24 * 60 * 60;

const DAY_KEYS = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10", "2026-01-11"];

const STEP_MARKS = ["start", "yes", "no", "days", "time", "mood", "note"] as const;
const WEEKDAY_MARKS = DAY_KEYS.map((_, index) => `wd${index}`);
const HOUR_MARKS = ONBOARD_HOURS.map((hour) => `h${String(hour).padStart(2, "0")}`);
const FEELING_MARKS = PICKER_FEELINGS.map((_, index) => `f${index}`);
const ALL_MARKS = [...STEP_MARKS, ...WEEKDAY_MARKS, ...HOUR_MARKS, ...FEELING_MARKS];
const MARK_SET = new Set<string>(ALL_MARKS);

type CounterRedis = {
  sadd: (key: string, member: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<unknown>;
  incr: (key: string) => Promise<number>;
  mget: (...keys: string[]) => Promise<(number | string | null)[]>;
};

export type BotFunnelChoice =
  | { step: "start" | "yes" | "no" | "note" }
  | { step: "days"; days: number[] }
  | { step: "time"; hour: number }
  | { step: "mood"; feeling: Feeling };

export type BotFunnelCounts = {
  start: number;
  yes: number;
  no: number;
  days: number;
  time: number;
  mood: number;
  note: number;
  weekdays: number[];
  hours: number[];
  feelings: number[];
};

export type BotFunnelReport = {
  windowDays: number;
  totals: BotFunnelCounts;
  today: BotFunnelCounts;
  messengers: { telegram: BotFunnelCounts; max: BotFunnelCounts };
};

export function emptyBotFunnel(): BotFunnelCounts {
  return {
    start: 0,
    yes: 0,
    no: 0,
    days: 0,
    time: 0,
    mood: 0,
    note: 0,
    weekdays: DAY_KEYS.map(() => 0),
    hours: ONBOARD_HOURS.map(() => 0),
    feelings: PICKER_FEELINGS.map(() => 0),
  };
}

export function funnelCounterKey(day: string, messenger: "telegram" | "max", mark: string): string {
  return `between:analytics:funnel:${day}:${messenger}:${mark}`;
}

/** Counter names for one committed answer. Toggles are not answers. */
export function marksForChoice(choice: BotFunnelChoice): string[] {
  if (choice.step === "days") {
    const days = [...new Set(choice.days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort(
      (a, b) => a - b,
    );
    return ["days", ...days.map((day) => `wd${day}`)];
  }
  if (choice.step === "time") {
    const hour = ONBOARD_HOURS.find((item) => item === choice.hour);
    return hour == null ? ["time"] : ["time", `h${String(hour).padStart(2, "0")}`];
  }
  if (choice.step === "mood") {
    const index = PICKER_FEELINGS.findIndex((item) => item === choice.feeling);
    return index < 0 ? ["mood"] : ["mood", `f${index}`];
  }
  return [choice.step];
}

function countsFrom(raw: (number | string | null)[]): BotFunnelCounts {
  const counts = emptyBotFunnel();
  const value = (mark: string) => analyticsCount(raw[ALL_MARKS.indexOf(mark)]);
  counts.start = value("start");
  counts.yes = value("yes");
  counts.no = value("no");
  counts.days = value("days");
  counts.time = value("time");
  counts.mood = value("mood");
  counts.note = value("note");
  counts.weekdays = WEEKDAY_MARKS.map((mark) => value(mark));
  counts.hours = HOUR_MARKS.map((mark) => value(mark));
  counts.feelings = FEELING_MARKS.map((mark) => value(mark));
  return counts;
}

export function addBotFunnel(left: BotFunnelCounts, right: BotFunnelCounts): BotFunnelCounts {
  return {
    start: left.start + right.start,
    yes: left.yes + right.yes,
    no: left.no + right.no,
    days: left.days + right.days,
    time: left.time + right.time,
    mood: left.mood + right.mood,
    note: left.note + right.note,
    weekdays: left.weekdays.map((count, index) => count + (right.weekdays[index] ?? 0)),
    hours: left.hours.map((count, index) => count + (right.hours[index] ?? 0)),
    feelings: left.feelings.map((count, index) => count + (right.feelings[index] ?? 0)),
  };
}

function sumRows(rows: { counts: BotFunnelCounts }[]): BotFunnelCounts {
  return rows.reduce((sum, row) => addBotFunnel(sum, row.counts), emptyBotFunnel());
}

export async function recordBotFunnel(
  redis: CounterRedis,
  input: {
    userId: number | string;
    messenger: "telegram" | "max";
    day: string;
    pepper: string;
    choice: BotFunnelChoice;
  },
): Promise<void> {
  const dedupKey = analyticsDedupKey(input.day);
  let wrote = false;
  for (const mark of marksForChoice(input.choice)) {
    if (!MARK_SET.has(mark)) continue;
    const token = analyticsDedupToken(
      input.pepper,
      `${input.messenger}:${input.userId}:funnel:${mark}:${input.day}`,
    );
    const added = await redis.sadd(dedupKey, token);
    if (String(added) === "0") continue;
    const key = funnelCounterKey(input.day, input.messenger, mark);
    await redis.incr(key);
    await redis.expire(key, COUNTER_TTL_SEC).catch(() => undefined);
    wrote = true;
  }
  if (wrote) await redis.expire(dedupKey, DEDUP_TTL_SEC).catch(() => undefined);
}

export async function loadBotFunnel(redis: CounterRedis, now = new Date()): Promise<BotFunnelReport> {
  const today = todayInTimeZone(DEFAULT_TIME_ZONE, now);
  const { reportDays } = reportDaySpan();
  const days = statsWindow(today, reportDays);
  const keys: string[] = [];
  for (const messenger of ["telegram", "max"] as const) {
    for (const day of days) {
      for (const mark of ALL_MARKS) keys.push(funnelCounterKey(day, messenger, mark));
    }
  }
  const raw = keys.length ? await redis.mget(...keys) : [];
  const width = ALL_MARKS.length;
  const read = (offset: number) =>
    days.map((day, index) => ({
      day,
      counts: countsFrom(raw.slice(offset + index * width, offset + (index + 1) * width)),
    }));
  const telegramRows = read(0);
  const maxRows = read(days.length * width);
  const todayOf = (rows: { day: string; counts: BotFunnelCounts }[]) =>
    rows.find((row) => row.day === today)?.counts ?? emptyBotFunnel();
  return {
    windowDays: days.length,
    totals: addBotFunnel(sumRows(telegramRows), sumRows(maxRows)),
    today: addBotFunnel(todayOf(telegramRows), todayOf(maxRows)),
    messengers: { telegram: sumRows(telegramRows), max: sumRows(maxRows) },
  };
}

function choiceList(parts: string[]): string {
  return parts.length ? ` — ${parts.join(", ")}` : "";
}

function funnelLines(counts: BotFunnelCounts): string[] {
  const therapist = counts.yes + counts.no;
  const therapistSplit = [
    counts.yes ? `да ${counts.yes}` : "",
    counts.no ? `нет ${counts.no}` : "",
  ].filter(Boolean);
  const days = counts.weekdays.flatMap((count, index) =>
    count > 0 ? [`${weekdayShort(DAY_KEYS[index], "ru")} ${count}`] : [],
  );
  const hours = counts.hours.flatMap((count, index) =>
    count > 0 ? [`${String(ONBOARD_HOURS[index]).padStart(2, "0")}:00 ×${count}`] : [],
  );
  const feelings = counts.feelings
    .map((count, index) => ({ count, index }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map((item) => `${feelingLabel("ru", PICKER_FEELINGS[item.index])} ${item.count}`);
  return [
    `Старт ${counts.start}`,
    `Терапевт ${therapist}${choiceList(therapistSplit)}`,
    `Дни ${counts.days}${choiceList(days)}`,
    `Время ${counts.time}${choiceList(hours)}`,
    `Настроение ${counts.mood}${choiceList(feelings)}`,
    `Заметка ${counts.note}`,
  ];
}

function hasAnswers(counts: BotFunnelCounts): boolean {
  return (
    counts.start + counts.yes + counts.no + counts.days + counts.time + counts.mood + counts.note > 0
  );
}

/** The quiz as one funnel. Empty until somebody answers. */
export function formatBotFunnel(report: BotFunnelReport): string {
  if (!hasAnswers(report.totals)) return "";
  const lines = [`Воронка бота, ${report.windowDays} дн.`, ...funnelLines(report.totals)];
  const today = report.today;
  const todayParts = [
    today.start ? `старт ${today.start}` : "",
    today.yes + today.no ? `терапевт ${today.yes + today.no}` : "",
    today.days ? `дни ${today.days}` : "",
    today.time ? `время ${today.time}` : "",
    today.mood ? `настроение ${today.mood}` : "",
    today.note ? `заметка ${today.note}` : "",
  ].filter(Boolean);
  if (todayParts.length) lines.push(`Сегодня: ${todayParts.join(", ")}`);
  const telegram = report.messengers.telegram.start;
  const max = report.messengers.max.start;
  if (telegram > 0 && max > 0) lines.push(`Telegram ${telegram} · MAX ${max}`);
  return lines.join("\n");
}

/** The funnel block for `/stats`. Blank until the first answer. */
export async function botFunnelBlock(now = new Date()): Promise<string> {
  const redis = analyticsRedis();
  if (!redis) return "";
  try {
    return formatBotFunnel(await loadBotFunnel(redis, now));
  } catch {
    return "";
  }
}

/** One person, one answer, one day. A repeated tap does not move the funnel. */
export async function trackBotFunnel(input: {
  userId: number | string;
  messenger: "telegram" | "max";
  choice: BotFunnelChoice;
  username?: string | null;
}): Promise<void> {
  if (
    analyticsQuiet({
      username: input.username,
      userId: input.userId,
      messenger: input.messenger,
      owners: process.env.ANALYTICS_OWNERS,
    })
  ) {
    return;
  }
  const redis = analyticsRedis();
  const pepper = process.env.BOT_TOKEN?.trim() || process.env.MAX_BOT_TOKEN?.trim();
  if (!redis || !pepper) return;
  try {
    await recordBotFunnel(redis, {
      ...input,
      day: todayInTimeZone(DEFAULT_TIME_ZONE),
      pepper,
    });
  } catch {
    // The reply is already decided. A missed counter can wait for the next answer.
  }
}
