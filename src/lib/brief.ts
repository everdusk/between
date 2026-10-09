import { formatFeelings } from "./feelings";
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

function excerpt(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  if (sentence.length <= 140) return sentence;
  return `${sentence.slice(0, 137).trimEnd()}…`;
}

function quoteForTag(entries: JournalEntry[], tag: string): string | null {
  const note = entries.find(
    (entry) => entry.tags.includes(tag) && entry.body.trim(),
  );
  if (!note) return null;
  const text = excerpt(note.body);
  return text ? `«${text}» — ${tag}` : null;
}

function feelingLine(
  current: FeelingCount[],
  previous: FeelingCount[],
): string | null {
  if (current.length === 0) return null;
  const top = current.slice(0, 3);
  const prevMap = new Map(previous.map((item) => [item.feeling, item.count]));
  const main = top
    .map((item) => `${item.feeling} — ${item.count}`)
    .join(", ");
  const compared = top
    .filter((item) => prevMap.has(item.feeling))
    .map(
      (item) =>
        `${item.feeling} на прошлой неделе было ${prevMap.get(item.feeling)}`,
    );
  if (compared.length === 0) return `Чаще всего: ${main}.`;
  return `Чаще всего: ${main}. ${compared.join("; ")}.`;
}

export function buildRuleBrief(input: {
  weekEntries: JournalEntry[];
  prevEntries: JournalEntry[];
  talkNotes: string;
}): string {
  const notes = input.weekEntries.filter((entry) => entry.body.trim());
  const feelings = feelingCounts(input.weekEntries);
  const prevFeelings = feelingCounts(input.prevEntries);
  const tags = tagCounts(input.weekEntries);
  const carried = persistentTags(tags, tagCounts(input.prevEntries));
  const talk = input.talkNotes.trim();

  if (notes.length === 0 && feelings.length === 0 && !talk) {
    return "За эту неделю ещё нет записей. Бриф соберётся из заметок, отметок и поля «говорить на сеансе».";
  }

  const lines: string[] = [];
  const feelingsText = feelingLine(feelings, prevFeelings);
  if (feelingsText) lines.push(feelingsText);

  if (tags.length > 0) {
    lines.push(
      `Темы: ${tags
        .slice(0, 5)
        .map((item) => `${item.tag} ×${item.count}`)
        .join(", ")}.`,
    );
  }

  if (carried.length > 0) {
    lines.push(`С прошлой недели повторяется: ${carried.slice(0, 4).join(", ")}.`);
  }

  const quotes = tags
    .slice(0, 3)
    .map((item) => quoteForTag(notes, item.tag))
    .filter((line): line is string => Boolean(line))
    .slice(0, 2);
  if (quotes.length > 0) lines.push(quotes.join("\n"));

  if (talk) lines.push(`Сказать на сеансе: ${talk}`);
  else lines.push("Поле «говорить на сеансе» пока пустое.");

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
