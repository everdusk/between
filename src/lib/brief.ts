import { formatDayLabel } from "./dates";
import { formatFeelings } from "./feelings";
import { fill } from "./i18n";
import type { BacklogItem, BacklogPriority, Feeling, JournalEntry } from "./types";

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

export type BacklogDraft = {
  text: string;
  priority: BacklogPriority;
};

export type BacklogCopy = {
  again: string;
  times: string;
  feeling?: (feeling: Feeling) => string;
};

const RU_BACKLOG: BacklogCopy = {
  again: "Снова: {tag}",
  times: "{label} — {count}",
};

const HEAVY: ReadonlySet<Feeling> = new Set([
  "тревожно",
  "напряжение",
  "стыд",
  "злость",
  "тяжело",
]);

const LIGHT: ReadonlySet<Feeling> = new Set(["радость", "спокойно"]);

const PRIORITY_RANK: Record<BacklogPriority, number> = { high: 0, mid: 1, low: 2 };

export function backlogId(text: string): string {
  const source = text.trim().toLowerCase();
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 33) ^ source.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function clipTopic(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 80) return clean;
  return `${clean.slice(0, 77).trimEnd()}…`;
}

function topicExcerpt(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  const sentence = clean.split(/(?<=[.!?…])\s+/)[0] ?? clean;
  return clipTopic(sentence);
}

function sortDrafts(items: BacklogDraft[]): BacklogDraft[] {
  return [...items].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}

export function buildRuleBacklog(input: {
  weekEntries: JournalEntry[];
  prevEntries: JournalEntry[];
  talkNotes: string;
  copy?: BacklogCopy;
}): BacklogItem[] {
  const copy = input.copy ?? RU_BACKLOG;
  const drafts: BacklogDraft[] = [];
  const seen = new Set<string>();

  function add(text: string, priority: BacklogPriority, min = 4) {
    const clean = clipTopic(text);
    if (clean.length < min) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    drafts.push({ text: clean, priority });
  }

  for (const line of input.talkNotes.split(/[\n;]+/)) add(line, "high");

  const tags = tagCounts(input.weekEntries);
  const carried = persistentTags(tags, tagCounts(input.prevEntries));
  for (const tag of carried) add(fill(copy.again, { tag }), "high", 2);

  const feelings = feelingCounts(input.weekEntries);
  const label = (feeling: Feeling) => copy.feeling?.(feeling) ?? feeling;
  for (const item of feelings) {
    if (!HEAVY.has(item.feeling) || item.count < 2) continue;
    add(fill(copy.times, { label: label(item.feeling), count: item.count }), "high", 2);
  }

  for (const item of tags) {
    if (item.count < 2 || carried.includes(item.tag)) continue;
    add(fill(copy.times, { label: item.tag, count: item.count }), "mid", 2);
  }

  for (const item of feelings) {
    if (LIGHT.has(item.feeling) || HEAVY.has(item.feeling)) continue;
    if (item.count >= 2) {
      add(fill(copy.times, { label: label(item.feeling), count: item.count }), "mid", 2);
    }
  }

  for (const item of feelings) {
    if (!HEAVY.has(item.feeling) || item.count !== 1) continue;
    add(fill(copy.times, { label: label(item.feeling), count: item.count }), "mid", 2);
  }

  if (drafts.length < 3) {
    const notes = [...input.weekEntries]
      .filter((entry) => entry.body.trim())
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
      );
    for (const entry of notes) {
      add(topicExcerpt(entry.body), "low");
      if (drafts.length >= 7) break;
    }
  }

  return sortDrafts(drafts)
    .slice(0, 7)
    .map((item) => ({
      id: backlogId(item.text),
      text: item.text,
      priority: item.priority,
      done: false,
    }));
}

const BACKLOG_PRIORITIES = new Set<BacklogPriority>(["high", "mid", "low"]);

export function parseModelBacklog(raw: string): BacklogDraft[] | null {
  let text = raw.trim();
  if (!text) return null;
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;

  const drafts: BacklogDraft[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const record = row as { text?: unknown; priority?: unknown };
    if (typeof record.text !== "string") continue;
    if (typeof record.priority !== "string" || !BACKLOG_PRIORITIES.has(record.priority as BacklogPriority)) {
      continue;
    }
    const clean = clipTopic(record.text);
    if (clean.length < 2) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push({ text: clean, priority: record.priority as BacklogPriority });
    if (drafts.length >= 7) break;
  }
  if (drafts.length === 0) return null;
  return sortDrafts(drafts);
}

export function mergeBacklog(
  incoming: BacklogDraft[],
  previous: { text: string; done: boolean }[],
): BacklogItem[] {
  const done = new Set(
    previous
      .filter((item) => item.done)
      .map((item) => item.text.trim().toLowerCase()),
  );
  return incoming.slice(0, 7).map((item) => ({
    id: backlogId(item.text),
    text: item.text,
    priority: item.priority,
    done: done.has(item.text.trim().toLowerCase()),
  }));
}
