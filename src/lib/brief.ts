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

const LIGHT: ReadonlySet<Feeling> = new Set(["радость", "спокойно"]);

/** A tasty meal is not a session topic. Appetite and overeating still are, via the note text. */
const MUNDANE_TAGS = new Set(["еда"]);

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

function isLightOnly(entry: JournalEntry): boolean {
  return entry.feelings.length > 0 && entry.feelings.every((feeling) => LIGHT.has(feeling));
}

/** A note is a session topic when it names a hard feeling or a real theme, not a pleasant meal. */
function isSessionMaterial(entry: JournalEntry): boolean {
  if (!entry.body.trim() || isLightOnly(entry)) return false;
  if (entry.feelings.some((feeling) => !LIGHT.has(feeling))) return true;
  return entry.tags.some((tag) => !MUNDANE_TAGS.has(tag));
}

/** A label with a count is not an episode. A meal, a feeling word, or a repeated tag is not noise by itself. */
export function isBacklogNoise(text: string): boolean {
  const clean = text.trim().toLowerCase().replace(/ё/g, "е").replace(/^снова:\s*/, "");
  if (/^(еда|радость|спокойно)(?:\s*[—:-]\s*\d+)?$/.test(clean)) return true;
  return /^[\p{L}]{2,24}\s*[—-]\s*\d+$/u.test(clean);
}

const CONTEXT_LIMIT = 3500;

const RU_CONTEXT = {
  week: "Заметки этого интервала:",
  earlier:
    "Прошлый интервал, только как фон. Тему из него не заводи, если в текущих заметках этого нет:",
  said: "Человек сам записал к сеансу:",
  today: "сегодня",
};

function chronological(entries: JournalEntry[]): JournalEntry[] {
  return entries
    .filter((entry) => entry.body.trim())
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );
}

function formatNoteLine(
  entry: JournalEntry,
  todayKey: string | undefined,
  copy: {
    today: string;
    feeling?: (feeling: Feeling) => string;
    day?: (dateKey: string) => string;
  },
): string {
  const when =
    entry.date === todayKey ? copy.today : (copy.day?.(entry.date) ?? formatDayLabel(entry.date));
  const feelings =
    entry.feelings.length > 0
      ? ` (${entry.feelings.map((feeling) => copy.feeling?.(feeling) ?? feeling).join(", ")})`
      : "";
  return `${when}${feelings}: ${noteExcerpt(entry.body)}`;
}

/**
 * The week as written. No tag counts and no ranking.
 * The model reads this and decides what weighs enough for a session.
 */
export function backlogContext(input: {
  weekEntries: JournalEntry[];
  prevEntries: JournalEntry[];
  talkNotes: string;
  todayKey?: string;
  today?: string;
  feeling?: (feeling: Feeling) => string;
  day?: (dateKey: string) => string;
}): string {
  const copy = {
    ...RU_CONTEXT,
    today: input.today ?? RU_CONTEXT.today,
    feeling: input.feeling,
    day: input.day,
  };
  const week = chronological(input.weekEntries).map((entry) =>
    formatNoteLine(entry, input.todayKey, copy),
  );
  const earlier = chronological(input.prevEntries).map((entry) =>
    formatNoteLine(entry, undefined, copy),
  );
  const said = input.talkNotes
    .split(/[\n;]+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 2);

  const blocks = () => {
    const parts: string[] = [];
    if (week.length > 0) parts.push(`${copy.week}\n${week.join("\n")}`);
    if (earlier.length > 0) parts.push(`${copy.earlier}\n${earlier.join("\n")}`);
    if (said.length > 0) parts.push(`${copy.said}\n${said.join("\n")}`);
    return parts;
  };
  const size = () => blocks().join("\n\n").length;
  while (size() > CONTEXT_LIMIT && earlier.length > 0) earlier.shift();
  while (size() > CONTEXT_LIMIT && week.length > 1) week.shift();
  if (size() > CONTEXT_LIMIT && week.length === 1 && week[0].length > 80) {
    const overflow = size() - CONTEXT_LIMIT;
    week[0] = `${week[0].slice(0, Math.max(40, week[0].length - overflow - 1)).trimEnd()}…`;
  }
  return blocks().join("\n\n");
}

/** Notes in the order they were written, before the model has ranked them. */
export function backlogPassages(input: {
  weekEntries: JournalEntry[];
  talkNotes: string;
  day?: (dateKey: string) => string;
}): BacklogDraft[] {
  const drafts: BacklogDraft[] = [];
  const seen = new Set<string>();
  function add(text: string) {
    const clean = clipTopic(text);
    if (clean.length < 2 || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    drafts.push({ text: clean, priority: "mid" });
  }

  const said = input.talkNotes
    .split(/[\n;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 2);
  for (const line of said) add(line);

  const notes = chronological(input.weekEntries);
  const room = Math.max(0, 7 - drafts.length);
  for (const entry of notes.slice(-room)) {
    const when = input.day?.(entry.date) ?? formatDayLabel(entry.date);
    add(`${when}: ${topicExcerpt(entry.body)}`);
  }
  return drafts.slice(0, 7);
}

export function buildRuleBacklog(input: {
  weekEntries: JournalEntry[];
  prevEntries: JournalEntry[];
  talkNotes: string;
  day?: (dateKey: string) => string;
}): BacklogItem[] {
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
  const carried = new Set(
    persistentTags(tags, tagCounts(input.prevEntries)).filter((tag) => !MUNDANE_TAGS.has(tag)),
  );
  const repeatedTags = new Set(
    tags.filter((item) => item.count >= 2 && !MUNDANE_TAGS.has(item.tag)).map((item) => item.tag),
  );
  const repeatedFeelings = new Set(
    feelingCounts(input.weekEntries)
      .filter((item) => !LIGHT.has(item.feeling) && item.count >= 2)
      .map((item) => item.feeling),
  );

  const notes = input.weekEntries
    .filter(isSessionMaterial)
    .map((entry) => {
      const repeated =
        entry.feelings.some((feeling) => repeatedFeelings.has(feeling)) ||
        entry.tags.some((tag) => repeatedTags.has(tag) || carried.has(tag));
      const when = input.day?.(entry.date) ?? formatDayLabel(entry.date);
      return {
        text: `${when}: ${topicExcerpt(entry.body)}`,
        priority: (repeated ? "high" : "mid") as BacklogPriority,
        date: entry.date,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  for (const note of notes) add(note.text, note.priority, 2);

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
    if (clean.length < 2 || isBacklogNoise(clean)) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push({ text: clean, priority: record.priority as BacklogPriority });
    if (drafts.length >= 7) break;
  }
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

export const USER_BACKLOG_CAP = 20;

function topicCore(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .replace(/^[^:]{1,40}:\s*/, "");
}

export function topicsOverlap(a: string, b: string): boolean {
  const left = topicCore(a);
  const right = topicCore(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 8 && right.includes(left)) return true;
  if (right.length >= 8 && left.includes(right)) return true;
  return false;
}

export function appendBacklogItem(
  items: BacklogItem[],
  text: string,
): BacklogItem[] | null {
  const clean = clipTopic(text);
  if (clean.length < 2 || items.length >= USER_BACKLOG_CAP) return null;
  if (items.some((item) => topicsOverlap(item.text, clean))) return null;
  return [
    ...items,
    { id: backlogId(clean), text: clean, priority: "high", done: false, origin: "user" },
  ];
}

/**
 * The list is the generated topics, plus lines the person wrote.
 * A check survives a reworded line. A removed generated line stays removed.
 * `handwritten` treats older items without an origin as lines the person kept.
 */
export function fillBacklog(input: {
  generated: { text: string; priority: BacklogPriority }[];
  previous?: BacklogItem[];
  hidden?: string[];
  handwritten?: boolean;
}): BacklogItem[] {
  const previous = input.previous ?? [];
  const hidden = input.hidden ?? [];
  const userItems: BacklogItem[] = [];
  for (const item of previous) {
    const origin = item.origin ?? (input.handwritten ? "user" : undefined);
    if (origin !== "user") continue;
    if (userItems.some((row) => topicsOverlap(row.text, item.text))) continue;
    if (userItems.length >= USER_BACKLOG_CAP) break;
    userItems.push({ ...item, origin: "user" });
  }

  const autos: BacklogItem[] = [];
  for (const item of input.generated) {
    const text = clipTopic(item.text);
    if (text.length < 2) continue;
    if (hidden.some((row) => topicsOverlap(row, text))) continue;
    if (userItems.some((row) => topicsOverlap(row.text, text))) continue;
    if (autos.some((row) => topicsOverlap(row.text, text))) continue;
    const said = previous.some((row) => row.done && topicsOverlap(row.text, text));
    autos.push({
      id: backlogId(text),
      text,
      priority: item.priority,
      done: said,
      origin: "auto",
    });
    if (autos.length >= 7) break;
  }

  return [...userItems, ...autos].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );
}
