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
  detail?: string;
  priority: BacklogPriority;
};

export type BacklogCopy = {
  own: string;
  carried: string;
  feeling?: (feeling: Feeling) => string;
};

const RU_BACKLOG: BacklogCopy = {
  own: "Сами вынесли на сеанс.",
  carried: "На прошлой неделе это уже было.",
};

const LIGHT: ReadonlySet<Feeling> = new Set(["радость", "спокойно"]);

/** Sharp enough to open the session ahead of a merely familiar theme. */
const ACUTE: ReadonlySet<Feeling> = new Set(["стыд", "пусто", "тяжело"]);

const FEELING_WEIGHT: Record<Feeling, number> = {
  стыд: 90,
  пусто: 80,
  тяжело: 70,
  тревожно: 50,
  злость: 45,
  грусть: 40,
  напряжение: 30,
  усталость: 20,
  спокойно: 0,
  радость: 0,
};

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

/** Model leftovers like «еда — 2» and a joyful meal are not topics. */
export function isBacklogNoise(text: string): boolean {
  const clean = text.trim().toLowerCase().replace(/ё/g, "е").replace(/^снова:\s*/, "");
  if (/^(еда|радость|спокойно)(?:\s*[—:-]\s*\d+)?$/.test(clean)) return true;
  if (/^[\p{L}]{2,24}\s*[—-]\s*\d+$/u.test(clean)) return true;
  const meal = /(вкусно|поела|поел|поели)/.test(clean);
  const hard = /(тревог|стыд|зл|тяжел|напряж|груст|устал|пусто|вин|обид|страш|плак|бессон|дедлайн|мама|пап|работ)/.test(clean);
  return meal && !hard;
}

function capitalizeTopic(text: string): string {
  const clean = text.trim();
  if (!clean) return clean;
  return clean.charAt(0).toLocaleUpperCase("ru") + clean.slice(1);
}

function episodeExcerpt(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  const sentence = clean.split(/(?<=[.!?…])\s+/)[0] ?? clean;
  if (sentence.length <= 120) return sentence;
  return `${sentence.slice(0, 117).trimEnd()}…`;
}

function joinSentences(parts: string[]): string {
  return parts.reduce((acc, part) => {
    if (!acc) return part;
    const sep = /[.!?…]$/.test(acc) ? " " : ". ";
    return `${acc}${sep}${part}`;
  }, "");
}

function capDetail(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 240) return clean;
  return `${clean.slice(0, 237).trimEnd()}…`;
}

function primaryTag(entry: JournalEntry): string | null {
  return entry.tags.find((tag) => !MUNDANE_TAGS.has(tag)) ?? null;
}

function heaviestHardFeeling(entry: JournalEntry): Feeling | null {
  let best: Feeling | null = null;
  let weight = 0;
  for (const feeling of entry.feelings) {
    if (LIGHT.has(feeling)) continue;
    const next = FEELING_WEIGHT[feeling] ?? 0;
    if (next > weight) {
      weight = next;
      best = feeling;
    }
  }
  return best;
}

type TopicNote = { entry: JournalEntry; when: string; excerpt: string };

type TopicCluster = {
  title: string;
  notes: TopicNote[];
  acute: boolean;
  carried: boolean;
  hard: boolean;
  latest: string;
};

function clusterScore(cluster: TopicCluster): number {
  let score = 0;
  if (cluster.acute) score += 1000;
  if (cluster.carried || cluster.notes.length >= 2) score += 400;
  if (cluster.hard) score += 100;
  score += Math.min(cluster.notes.length, 3);
  return score;
}

function clusterPriority(cluster: TopicCluster): BacklogPriority {
  if (cluster.acute || cluster.carried || cluster.notes.length >= 2) return "high";
  if (cluster.hard) return "mid";
  return "low";
}

function clusterDetail(cluster: TopicCluster, copy: BacklogCopy): string {
  const ranked = [...cluster.notes].sort((a, b) => {
    const acuteA = a.entry.feelings.some((feeling) => ACUTE.has(feeling)) ? 1 : 0;
    const acuteB = b.entry.feelings.some((feeling) => ACUTE.has(feeling)) ? 1 : 0;
    if (acuteA !== acuteB) return acuteB - acuteA;
    return (
      b.entry.date.localeCompare(a.entry.date) ||
      b.entry.createdAt.localeCompare(a.entry.createdAt)
    );
  });
  const picked = ranked
    .slice(0, 2)
    .sort(
      (a, b) =>
        a.entry.date.localeCompare(b.entry.date) ||
        a.entry.createdAt.localeCompare(b.entry.createdAt),
    );
  const parts = picked.map((note) => `${note.when}: ${note.excerpt}`);
  if (cluster.carried) parts.push(copy.carried);
  return capDetail(joinSentences(parts));
}

export function buildRuleBacklog(input: {
  weekEntries: JournalEntry[];
  prevEntries: JournalEntry[];
  talkNotes: string;
  day?: (dateKey: string) => string;
  copy?: BacklogCopy;
}): BacklogItem[] {
  const copy = input.copy ?? RU_BACKLOG;
  const whenOf = (dateKey: string) => input.day?.(dateKey) ?? formatDayLabel(dateKey);
  const drafts: BacklogDraft[] = [];
  const seen = new Set<string>();

  for (const line of input.talkNotes.split(/[\n;]+/)) {
    const text = clipTopic(line);
    if (text.length < 4) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push({ text, detail: copy.own, priority: "high" });
  }

  const carriedTags = new Set(
    input.prevEntries.flatMap((entry) => entry.tags).filter((tag) => !MUNDANE_TAGS.has(tag)),
  );
  const carriedFeelings = new Set(
    input.prevEntries.flatMap((entry) => entry.feelings).filter((feeling) => !LIGHT.has(feeling)),
  );

  const clusters = new Map<string, TopicCluster>();
  const material = input.weekEntries
    .filter(isSessionMaterial)
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );

  for (const entry of material) {
    const tag = primaryTag(entry);
    const feeling = heaviestHardFeeling(entry);
    const key = tag ? `tag:${tag}` : feeling ? `feeling:${feeling}` : null;
    if (!key) continue;
    const title = tag
      ? capitalizeTopic(tag)
      : capitalizeTopic(copy.feeling?.(feeling!) ?? feeling!);
    const note: TopicNote = {
      entry,
      when: whenOf(entry.date),
      excerpt: episodeExcerpt(entry.body),
    };
    const existing = clusters.get(key);
    if (existing) {
      existing.notes.push(note);
      if (entry.date > existing.latest) existing.latest = entry.date;
      if (entry.feelings.some((item) => ACUTE.has(item))) existing.acute = true;
      if (entry.feelings.some((item) => !LIGHT.has(item))) existing.hard = true;
      continue;
    }
    clusters.set(key, {
      title,
      notes: [note],
      acute: entry.feelings.some((item) => ACUTE.has(item)),
      carried: tag ? carriedTags.has(tag) : Boolean(feeling && carriedFeelings.has(feeling)),
      hard: entry.feelings.some((item) => !LIGHT.has(item)),
      latest: entry.date,
    });
  }

  const topics = [...clusters.values()].sort((a, b) => {
    const byScore = clusterScore(b) - clusterScore(a);
    if (byScore !== 0) return byScore;
    const byDate = b.latest.localeCompare(a.latest);
    if (byDate !== 0) return byDate;
    return a.title.localeCompare(b.title, "ru");
  });

  for (const topic of topics) {
    const key = topic.title.toLowerCase();
    const detail = clusterDetail(topic, copy);
    const talk = drafts.find((item) => item.text.toLowerCase() === key);
    if (talk) {
      talk.detail = capDetail(joinSentences([talk.detail ?? copy.own, detail]));
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push({ text: topic.title, detail, priority: clusterPriority(topic) });
  }

  const capped = drafts.slice(0, 7);
  if (capped.length > 0 && capped[0].priority !== "high") {
    capped[0] = { ...capped[0], priority: "high" };
  }

  return capped.map((item) => ({
    id: backlogId(item.text),
    text: item.text,
    ...(item.detail ? { detail: item.detail } : {}),
    priority: item.priority,
    done: false,
  }));
}

const PRIORITY_ORDER: BacklogPriority[] = ["high", "mid", "low"];

/** Numbered handoff a person can paste to a therapist, grouped by priority. */
export function formatBacklogHandoff(
  items: BacklogItem[],
  labels: Record<BacklogPriority, string>,
  title: string,
): string {
  const lines: string[] = [title, ""];
  let number = 1;
  for (const priority of PRIORITY_ORDER) {
    const group = items.filter((item) => item.priority === priority);
    if (group.length === 0) continue;
    lines.push(labels[priority]);
    for (const item of group) {
      lines.push(`${number}. ${item.text}`);
      if (item.detail?.trim()) lines.push(item.detail.trim());
      lines.push("");
      number += 1;
    }
  }
  return lines.join("\n").trim();
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
    const record = row as { text?: unknown; detail?: unknown; priority?: unknown };
    if (typeof record.text !== "string") continue;
    if (typeof record.priority !== "string" || !BACKLOG_PRIORITIES.has(record.priority as BacklogPriority)) {
      continue;
    }
    const clean = clipTopic(record.text);
    if (clean.length < 2 || isBacklogNoise(clean)) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const detail =
      typeof record.detail === "string"
        ? record.detail.replace(/\s+/g, " ").trim().slice(0, 240)
        : "";
    drafts.push({
      text: clean,
      ...(detail ? { detail } : {}),
      priority: record.priority as BacklogPriority,
    });
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
    ...(item.detail ? { detail: item.detail } : {}),
    priority: item.priority,
    done: done.has(item.text.trim().toLowerCase()),
  }));
}
