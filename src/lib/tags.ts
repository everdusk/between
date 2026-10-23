import { formatDayLabel } from "./dates";
import type { Feeling, JournalEntry } from "./types";

const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 32;
const THEME_CONTEXT_LIMIT = 3500;
const MAX_THEMES_PER_NOTE = 3;

/**
 * Themes a therapy week actually tracks.
 * A meal, a place, a friend, or a dream is not a theme by itself.
 */
export const THERAPY_THEMES = [
  "отношения",
  "семья",
  "границы",
  "стыд",
  "вина",
  "злость",
  "тревога",
  "самооценка",
  "одиночество",
  "потеря",
  "тело",
  "работа",
  "деньги",
  "детство",
  "контроль",
  "близость",
  "травма",
  "смысл",
] as const;

export type TherapyTheme = (typeof THERAPY_THEMES)[number];

const THEME_SET = new Set<string>(THERAPY_THEMES);

/** Old keyword labels. They are not themes and do not stay on the week. */
const LEGACY_MUNDANE = new Set([
  "мама",
  "папа",
  "сон",
  "друзья",
  "еда",
  "учеба",
  "дом",
  "будущее",
  "усталость",
]);

function fold(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

export function isTherapyTheme(tag: string): tag is TherapyTheme {
  return THEME_SET.has(fold(tag));
}

export function sanitizeTags(raw: string[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    const tag = fold(item);
    if (!tag || tag === "бот") continue;
    if (tag.length > MAX_TAG_LENGTH) continue;
    if (!out.includes(tag)) out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Keyword tagging is gone. Themes come from the note's meaning, not from a stem. */
export function suggestTags(text: string): string[] {
  void text;
  return [];
}

export function splitTags(entry: JournalEntry): {
  user: string[];
  auto: string[];
  hidden: string[];
} {
  const hidden = sanitizeTags(entry.themeHidden ?? []).filter(isTherapyTheme);
  const user =
    entry.userTags !== undefined
      ? sanitizeTags(entry.userTags)
      : sanitizeTags(entry.tags).filter(
          (tag) => !isTherapyTheme(tag) && !LEGACY_MUNDANE.has(tag),
        );
  const autoSource =
    entry.autoThemes ?? sanitizeTags(entry.tags).filter(isTherapyTheme);
  const auto = sanitizeTags(autoSource).filter(
    (tag) => isTherapyTheme(tag) && !hidden.includes(tag),
  );
  return { user, auto, hidden };
}

/** Tags worth showing: a therapy theme, or a line the person typed. Not «еда» or «дом». */
export function shownEntryTags(entry: JournalEntry): string[] {
  const parts = splitTags(entry);
  return sanitizeTags([...parts.auto, ...parts.user]);
}

export function applyThemePass(entry: JournalEntry, themes: string[]): JournalEntry {
  const hidden = new Set(splitTags(entry).hidden);
  const user = splitTags(entry).user;
  const auto: string[] = [];
  for (const theme of themes) {
    const tag = fold(theme);
    if (!isTherapyTheme(tag) || hidden.has(tag) || auto.includes(tag)) continue;
    auto.push(tag);
    if (auto.length >= MAX_THEMES_PER_NOTE) break;
  }
  return {
    ...entry,
    tags: sanitizeTags([...auto, ...user]),
    autoThemes: auto,
    userTags: user,
    themeHidden: hidden.size > 0 ? [...hidden] : undefined,
  };
}

export type ThemeAssignment = { id: string; themes: string[] };

export function parseModelThemes(raw: string): ThemeAssignment[] | null {
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

  const assignments: ThemeAssignment[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const record = row as { id?: unknown; themes?: unknown };
    if (typeof record.id !== "string" || !record.id.trim()) continue;
    const id = record.id.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    const themes: string[] = [];
    if (Array.isArray(record.themes)) {
      for (const theme of record.themes) {
        if (typeof theme !== "string") continue;
        const tag = fold(theme);
        if (!isTherapyTheme(tag) || themes.includes(tag)) continue;
        themes.push(tag);
        if (themes.length >= MAX_THEMES_PER_NOTE) break;
      }
    }
    assignments.push({ id, themes });
  }
  return assignments;
}

function themeLines(
  entries: JournalEntry[],
  options?: {
    todayKey?: string;
    today?: string;
    feeling?: (feeling: Feeling) => string;
    day?: (dateKey: string) => string;
  },
): string[] {
  const notes = entries
    .filter((entry) => entry.body.trim())
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );
  return notes.map((entry) => {
    const when =
      options?.todayKey && entry.date === options.todayKey
        ? (options.today ?? "сегодня")
        : (options?.day?.(entry.date) ?? formatDayLabel(entry.date));
    const feelings =
      entry.feelings.length > 0
        ? ` (${entry.feelings.map((feeling) => options?.feeling?.(feeling) ?? feeling).join(", ")})`
        : "";
    const body = entry.body.replace(/\s+/g, " ").trim();
    return `id: ${entry.id}\n${when}${feelings}: ${body}`;
  });
}

function fitThemeLine(line: string): string {
  if (line.length <= THEME_CONTEXT_LIMIT) return line;
  return `${line.slice(0, Math.max(40, THEME_CONTEXT_LIMIT - 1)).trimEnd()}…`;
}

/** Every note, split so each request stays within the model limit. Nothing is dropped. */
export function themeContextChunks(
  entries: JournalEntry[],
  options?: {
    todayKey?: string;
    today?: string;
    feeling?: (feeling: Feeling) => string;
    day?: (dateKey: string) => string;
  },
): string[] {
  const chunks: string[][] = [];
  let current: string[] = [];
  const lengthOf = (items: string[]) => items.join("\n\n").length;
  for (const line of themeLines(entries, options).map(fitThemeLine)) {
    if (current.length > 0 && lengthOf([...current, line]) > THEME_CONTEXT_LIMIT) {
      chunks.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) chunks.push(current);
  return chunks.map((items) => items.join("\n\n"));
}

export function themeContext(
  entries: JournalEntry[],
  options?: {
    todayKey?: string;
    today?: string;
    feeling?: (feeling: Feeling) => string;
    day?: (dateKey: string) => string;
  },
): string {
  const lines = themeLines(entries, options);
  const size = () => lines.join("\n\n").length;
  while (size() > THEME_CONTEXT_LIMIT && lines.length > 1) lines.shift();
  if (size() > THEME_CONTEXT_LIMIT && lines.length === 1 && lines[0].length > 80) {
    lines[0] = fitThemeLine(lines[0]);
  }
  return lines.join("\n\n");
}
