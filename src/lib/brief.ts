import { formatDayLabel } from "./dates";
import { formatFeelings } from "./feelings";
import { fill } from "./i18n";
import type { Feeling, JournalEntry } from "./types";

export type FeelingCount = { feeling: Feeling; count: number };
export type TagCount = { tag: string; count: number };

function countsFrom<T extends string>(values: T[]): { key: T; count: number }[] {
  const map = new Map<T, number>();
  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "ru"));
}

export function feelingCounts(entries: JournalEntry[]): FeelingCount[] {
  return countsFrom(entries.flatMap((entry) => entry.feelings)).map(
    ({ key, count }) => ({ feeling: key, count }),
  );
}

export function tagCounts(entries: JournalEntry[]): TagCount[] {
  return countsFrom(
    entries.flatMap((entry) => entry.tags),
  ).map(({ key, count }) => ({ tag: key, count }));
}

export function entriesOnDates(
  entries: JournalEntry[],
  dates: string[],
): JournalEntry[] {
  const set = new Set(dates);
  return entries.filter((entry) => set.has(entry.date));
}

export function persistentTags(
  current: TagCount[],
  previous: TagCount[],
): string[] {
  const prev = new Set(previous.map((item) => item.tag));
  return current.filter((item) => prev.has(item.tag)).map((item) => item.tag);
}

function noteExcerpt(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= 240) return clean;
  return `${clean.slice(0, 237).trimEnd()}…`;
}

export type BriefCopy = {
  empty: string;
  most: string;
  mostPast: string;
  past: string;
  themes: string;
  carried: string;
  entries: string;
  today: string;
  say: string;
  talkEmpty: string;
  feeling?: (feeling: Feeling) => string;
  day?: (dateKey: string) => string;
};

const RU_BRIEF: BriefCopy = {
  empty:
    "За эту неделю ещё нет записей. Бриф соберётся из заметок, отметок и поля «говорить на сеансе».",
  most: "Чаще всего: {main}.",
  mostPast: "Чаще всего: {main}. {compared}.",
  past: "{feeling} на прошлой неделе было {count}",
  themes: "Темы: {list}.",
  carried: "С прошлой недели повторяется: {list}.",
  entries: "Записи:",
  today: "сегодня",
  say: "Сказать на сеансе: {talk}",
  talkEmpty: "Поле «говорить на сеансе» пока пустое.",
};

/** Every note with text. Older lines drop first if the week is long; today stays. */
function noteFacts(
  entries: JournalEntry[],
  todayKey: string | undefined,
  copy: BriefCopy,
): string | null {
  const notes = entries
    .filter((entry) => entry.body.trim())
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );
  if (notes.length === 0) return null;

  const lines = notes.map((entry) => {
    const when =
      entry.date === todayKey ? copy.today : (copy.day?.(entry.date) ?? formatDayLabel(entry.date));
    const feelings =
      entry.feelings.length > 0
        ? ` (${entry.feelings.map((feeling) => copy.feeling?.(feeling) ?? feeling).join(", ")})`
        : "";
    return {
      date: entry.date,
      line: `${when}${feelings}: ${noteExcerpt(entry.body)}`,
    };
  });

  const size = () => lines.reduce((sum, item) => sum + item.line.length + 1, 0);
  while (lines.length > 1 && size() > 2800) {
    const index = lines.findIndex((item) => item.date !== todayKey);
    if (index === -1) break;
    lines.splice(index, 1);
  }

  return `${copy.entries}\n${lines.map((item) => item.line).join("\n")}`;
}

function feelingLine(
  current: FeelingCount[],
  previous: FeelingCount[],
  copy: BriefCopy,
): string | null {
  if (current.length === 0) return null;
  const top = current.slice(0, 3);
  const prevMap = new Map(previous.map((item) => [item.feeling, item.count]));
  const label = (feeling: Feeling) => copy.feeling?.(feeling) ?? feeling;
  const main = top
    .map((item) => `${label(item.feeling)} — ${item.count}`)
    .join(", ");
  const compared = top
    .filter((item) => prevMap.has(item.feeling))
    .map((item) =>
      fill(copy.past, { feeling: label(item.feeling), count: prevMap.get(item.feeling) }),
    );
  if (compared.length === 0) return fill(copy.most, { main });
  return fill(copy.mostPast, { main, compared: compared.join("; ") });
}

export function buildRuleBrief(input: {
  weekEntries: JournalEntry[];
  prevEntries: JournalEntry[];
  talkNotes: string;
  todayKey?: string;
  copy?: BriefCopy;
}): string {
  const copy = input.copy ?? RU_BRIEF;
  const notes = input.weekEntries.filter((entry) => entry.body.trim());
  const feelings = feelingCounts(input.weekEntries);
  const prevFeelings = feelingCounts(input.prevEntries);
  const tags = tagCounts(input.weekEntries);
  const carried = persistentTags(tags, tagCounts(input.prevEntries));
  const talk = input.talkNotes.trim();

  if (notes.length === 0 && feelings.length === 0 && !talk) {
    return copy.empty;
  }

  const lines: string[] = [];
  const feelingsText = feelingLine(feelings, prevFeelings, copy);
  if (feelingsText) lines.push(feelingsText);

  if (tags.length > 0) {
    lines.push(
      fill(copy.themes, {
        list: tags
          .slice(0, 5)
          .map((item) => `${item.tag} ×${item.count}`)
          .join(", "),
      }),
    );
  }

  if (carried.length > 0) {
    lines.push(fill(copy.carried, { list: carried.slice(0, 4).join(", ") }));
  }

  const facts = noteFacts(notes, input.todayKey, copy);
  if (facts) lines.push(facts);

  if (talk) lines.push(fill(copy.say, { talk }));
  else lines.push(copy.talkEmpty);

  return lines.join("\n\n");
}

export function briefStamp(entries: JournalEntry[], talkNotes: string): string {
  const body = [...entries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => `${entry.id}:${entry.updatedAt}`)
    .join("|");
  const source = `${body}\n${talkNotes.trim()}`;
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 33) ^ source.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function feelingsLabel(feelings: Feeling[]): string {
  return formatFeelings(feelings);
}
