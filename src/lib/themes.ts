import { createId, parseDateKey } from "./dates";
import { feelingValence } from "./feelings";
import type {
  Feeling,
  JournalEntry,
  SessionNote,
  SessionTheme,
  ThemeLink,
  ThemeQuote,
} from "./types";

const QUOTE_MAX = 140;
const CREATE_CONFIDENCE = 0.7;
const CREATE_INTENSITY = 5;
const MERGE_CONFIDENCE = 0.85;
const BRIEF_WORD_LIMIT = 300;

export type JudgeVerdict = {
  relevant: boolean;
  matchTheme: string | null;
  intensity: number;
  newTheme: string | null;
  confidence: number;
  quote: string;
  reason: string;
};

export type ThemeState = {
  themes: SessionTheme[];
  links: ThemeLink[];
};

export type DedupHit = {
  themeId: string;
  confidence: number;
  title: string;
};

export type ThemeMark = "new" | "returned" | "week2" | "week3";

function fold(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function words(value: string): string[] {
  return fold(value)
    .split(/[^a-zа-я0-9]+/i)
    .filter((word) => word.length > 3);
}

/** Same person, situation, or pattern. Used so a dismissed theme is not reborn. */
export function sameProblemTitle(left: string, right: string): boolean {
  const a = fold(left);
  const b = fold(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const aw = new Set(words(a));
  const bw = new Set(words(b));
  if (aw.size === 0 || bw.size === 0) return false;
  let shared = 0;
  for (const word of aw) if (bw.has(word)) shared += 1;
  const union = new Set([...aw, ...bw]).size;
  return union > 0 && shared / union >= 0.5;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Quote must be the person's words. A paraphrase is dropped. */
export function verbatimQuote(body: string, quote: string): string {
  const clean = quote.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const clipped = clean.length > QUOTE_MAX ? clean.slice(0, QUOTE_MAX).trimEnd() : clean;
  const hay = fold(body);
  const needle = fold(clipped);
  if (!needle || !hay.includes(needle)) return "";
  return clipped;
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = parseDateKey(fromKey).getTime();
  const to = parseDateKey(toKey).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function recencyScore(lastSeen: string, todayKey: string): number {
  const age = daysBetween(lastSeen, todayKey);
  if (age < 2) return 3;
  if (age < 5) return 2;
  if (age < 7) return 1;
  return 0;
}

/** How many extra periods between sessions the theme already spans. */
export function weeksPersisting(theme: SessionTheme, sessionDates: string[], todayKey: string): number {
  const sessions = [...sessionDates].filter((date) => date <= todayKey).sort();
  if (sessions.length === 0) return 0;
  const dates = [
    theme.firstSeen,
    theme.lastSeen,
    ...theme.quotes.map((quote) => quote.date),
  ].filter((date) => date <= todayKey);
  const periodOf = (date: string) => {
    let period = 0;
    for (const session of sessions) {
      if (date > session) period += 1;
    }
    return period;
  };
  const periods = new Set(dates.map(periodOf));
  return Math.max(0, periods.size - 1);
}

export function themeScore(
  theme: SessionTheme,
  todayKey: string,
  sessionDates: string[],
): number {
  return (
    2 * Math.log(1 + theme.count) +
    0.5 * theme.peakIntensity +
    recencyScore(theme.lastSeen, todayKey) +
    2 * weeksPersisting(theme, sessionDates, todayKey) +
    (theme.reopened ? 4 : 0)
  );
}

export function themeMark(
  theme: SessionTheme,
  todayKey: string,
  sessionDates: string[],
): ThemeMark {
  if (theme.reopened) return "returned";
  const extra = weeksPersisting(theme, sessionDates, todayKey);
  if (extra >= 2) return "week3";
  if (extra >= 1) return "week2";
  return "new";
}

function heaviestFeeling(feelings: Feeling[]): Feeling | undefined {
  const ranked: Feeling[] = [
    "тяжело",
    "стыд",
    "пусто",
    "тревожно",
    "злость",
    "грусть",
    "напряжение",
    "усталость",
  ];
  return ranked.find((feeling) => feelings.includes(feeling));
}

/** What the judge should see for a feeling mark. The app has words, not a 1–10 slider. */
export function feelingIntensity(feelings: Feeling[]): number {
  const weights: Partial<Record<Feeling, number>> = {
    тяжело: 8,
    стыд: 8,
    пусто: 8,
    тревожно: 8,
    злость: 8,
    грусть: 8,
    напряжение: 8,
    усталость: 4,
    спокойно: 2,
    радость: 2,
  };
  return feelings.reduce((max, feeling) => Math.max(max, weights[feeling] ?? 0), 0);
}

function recount(theme: SessionTheme, links: ThemeLink[]): SessionTheme {
  const ids = new Set(
    links.filter((link) => link.themeId === theme.id).map((link) => link.entryId),
  );
  const count = theme.manual ? Math.max(ids.size, 1) : ids.size;
  return { ...theme, count };
}

function recountAll(themes: SessionTheme[], links: ThemeLink[]): SessionTheme[] {
  return themes.map((theme) => recount(theme, links));
}

function fallbackTitle(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length < 4) return "";
  const sentence = (clean.split(/(?<=[.!?…])\s+/)[0] ?? clean).trim();
  return sentence.slice(0, 80).trim();
}

function upsertQuote(theme: SessionTheme, quote: ThemeQuote | null): ThemeQuote[] {
  if (!quote) return theme.quotes;
  const without = theme.quotes.filter(
    (item) => !(item.entryId === quote.entryId && item.text === quote.text),
  );
  return [...without, quote].slice(-8);
}

export function applyVerdict(
  state: ThemeState,
  entry: Pick<JournalEntry, "id" | "date" | "body" | "feelings">,
  verdict: JudgeVerdict,
  now = new Date().toISOString(),
  userId = "local",
): { state: ThemeState; touchedId: string | null } {
  const marked = feelingIntensity(entry.feelings);
  const heavy = marked >= CREATE_INTENSITY;
  const substantial = entry.body.replace(/\s+/g, " ").trim().length >= 40;
  const charged = heavy || substantial;
  const intensity = clamp(
    Math.round(Math.max(verdict.intensity, heavy ? marked : substantial ? CREATE_INTENSITY : 0)),
    1,
    10,
  );
  const confidence = clamp(
    charged ? Math.max(verdict.confidence, CREATE_CONFIDENCE) : verdict.confidence,
    0,
    1,
  );
  const relevant = verdict.relevant || charged;
  const quoteText = verbatimQuote(entry.body, verdict.quote);
  const quote: ThemeQuote | null = quoteText
    ? { entryId: entry.id, text: quoteText, date: entry.date, intensity }
    : null;
  const feeling = heaviestFeeling(entry.feelings);

  const matched = verdict.matchTheme
    ? state.themes.find((theme) => theme.id === verdict.matchTheme)
    : undefined;

  if (matched && !matched.dismissed) {
    const links = state.links.some(
      (link) => link.entryId === entry.id && link.themeId === matched.id,
    )
      ? state.links.map((link) =>
          link.entryId === entry.id ? { ...link, themeId: matched.id, confidence } : link,
        )
      : [
          ...state.links.filter((link) => link.entryId !== entry.id),
          { entryId: entry.id, themeId: matched.id, confidence },
        ];
    const reopened = matched.status === "discussed";
    const themes = recountAll(
      state.themes.map((theme) => {
        if (theme.id !== matched.id) return theme;
        const next: SessionTheme = {
          ...theme,
          status: "active",
          reopened: theme.reopened || reopened,
          lastSeen: entry.date > theme.lastSeen ? entry.date : theme.lastSeen,
          firstSeen: entry.date < theme.firstSeen ? entry.date : theme.firstSeen,
          peakIntensity: Math.max(theme.peakIntensity, intensity),
          confidence: Math.max(theme.confidence, confidence),
          quotes: upsertQuote(theme, quote),
          updatedAt: now,
        };
        if (feeling && intensity >= theme.peakIntensity) next.peakFeeling = feeling;
        return next;
      }),
      links,
    );
    return { state: { themes, links }, touchedId: matched.id };
  }

  if (matched?.dismissed) {
    return { state, touchedId: null };
  }

  const named = verdict.newTheme?.replace(/\s+/g, " ").trim() ?? "";
  const title = named || (relevant && charged ? fallbackTitle(entry.body) : "");
  const canCreate =
    relevant &&
    !verdict.matchTheme &&
    confidence >= CREATE_CONFIDENCE &&
    intensity >= CREATE_INTENSITY &&
    title.length >= 4 &&
    !state.themes.some((theme) => theme.dismissed && sameProblemTitle(theme.title, title));

  if (!canCreate) return { state, touchedId: null };

  const id = createId();
  const links = [
    ...state.links.filter((link) => link.entryId !== entry.id),
    { entryId: entry.id, themeId: id, confidence },
  ];
  const created: SessionTheme = {
    id,
    userId,
    title: title.slice(0, 80),
    status: "active",
    count: 1,
    firstSeen: entry.date,
    lastSeen: entry.date,
    peakIntensity: intensity,
    peakFeeling: feeling,
    reopened: false,
    dismissed: false,
    confidence,
    summary: title.slice(0, 80),
    quotes: quote ? [quote] : [],
    updatedAt: now,
  };
  return {
    state: { themes: recountAll([...state.themes, created], links), links },
    touchedId: id,
  };
}

export function mergeThemes(
  state: ThemeState,
  keepId: string,
  dropId: string,
  title: string | undefined,
  now = new Date().toISOString(),
): ThemeState {
  if (keepId === dropId) return state;
  const keep = state.themes.find((theme) => theme.id === keepId);
  const drop = state.themes.find((theme) => theme.id === dropId);
  if (!keep || !drop || keep.dismissed || drop.dismissed) return state;
  const links = state.links.map((link) =>
    link.themeId === dropId ? { ...link, themeId: keepId } : link,
  );
  const seen = new Set<string>();
  const unique: ThemeLink[] = [];
  for (const link of links) {
    if (seen.has(link.entryId)) continue;
    seen.add(link.entryId);
    unique.push(link);
  }
  const quotes = [...keep.quotes];
  for (const quote of drop.quotes) {
    if (!quotes.some((item) => item.entryId === quote.entryId && item.text === quote.text)) {
      quotes.push(quote);
    }
  }
  const nextTitle = (title?.replace(/\s+/g, " ").trim() || keep.title).slice(0, 80);
  const merged: SessionTheme = recount(
    {
      ...keep,
      title: nextTitle,
      summary: nextTitle,
      status: "active",
      reopened: keep.reopened || drop.reopened,
      dismissed: false,
      firstSeen: keep.firstSeen < drop.firstSeen ? keep.firstSeen : drop.firstSeen,
      lastSeen: keep.lastSeen > drop.lastSeen ? keep.lastSeen : drop.lastSeen,
      peakIntensity: Math.max(keep.peakIntensity, drop.peakIntensity),
      peakFeeling:
        keep.peakIntensity >= drop.peakIntensity ? keep.peakFeeling : drop.peakFeeling,
      confidence: Math.max(keep.confidence, drop.confidence),
      quotes: quotes.slice(-8),
      manual: keep.manual || drop.manual,
      updatedAt: now,
    },
    unique,
  );
  return {
    themes: state.themes.filter((theme) => theme.id !== dropId).map((theme) =>
      theme.id === keepId ? merged : theme,
    ),
    links: unique,
  };
}

/** One theme against the other open ones. At most two cascades. */
export function dedupTouched(
  state: ThemeState,
  touchedId: string | null,
  ask: (theme: SessionTheme, others: SessionTheme[]) => DedupHit | null,
): ThemeState {
  let current = state;
  let focus = touchedId;
  for (let pass = 0; pass < 2 && focus; pass += 1) {
    const theme = current.themes.find((item) => item.id === focus && item.status === "active" && !item.dismissed);
    if (!theme) break;
    const others = current.themes.filter(
      (item) => item.id !== theme.id && item.status === "active" && !item.dismissed,
    );
    const hit = others.length > 0 ? ask(theme, others) : null;
    if (!hit || hit.confidence < MERGE_CONFIDENCE || hit.themeId === theme.id) break;
    const other = others.find((item) => item.id === hit.themeId);
    if (!other) break;
    current = mergeThemes(current, other.id, theme.id, hit.title);
    focus = other.id;
  }
  return current;
}

export function settleEntry(
  state: ThemeState,
  entry: Pick<JournalEntry, "id" | "date" | "body" | "feelings">,
  verdict: JudgeVerdict,
  ask: (theme: SessionTheme, others: SessionTheme[]) => DedupHit | null = () => null,
): ThemeState {
  const applied = applyVerdict(state, entry, verdict);
  return dedupTouched(applied.state, applied.touchedId, ask);
}

export function openThemes(themes: SessionTheme[]): SessionTheme[] {
  return themes.filter((theme) => theme.status === "active" && !theme.dismissed);
}

export function rankedThemes(
  themes: SessionTheme[],
  todayKey: string,
  sessionDates: string[],
): SessionTheme[] {
  return openThemes(themes)
    .map((theme) => ({ theme, score: themeScore(theme, todayKey, sessionDates) }))
    .sort((a, b) => b.score - a.score || b.theme.lastSeen.localeCompare(a.theme.lastSeen))
    .map((item) => item.theme);
}

export function discussTheme(themes: SessionTheme[], id: string, discussed: boolean, now = new Date().toISOString()): SessionTheme[] {
  return themes.map((theme) =>
    theme.id === id
      ? {
          ...theme,
          status: discussed ? "discussed" : "active",
          updatedAt: now,
        }
      : theme,
  );
}

export function dismissTheme(themes: SessionTheme[], id: string, now = new Date().toISOString()): SessionTheme[] {
  return themes.map((theme) =>
    theme.id === id
      ? { ...theme, dismissed: true, status: "archived", updatedAt: now }
      : theme,
  );
}

export function addManualTheme(
  themes: SessionTheme[],
  title: string,
  todayKey: string,
  now = new Date().toISOString(),
): SessionTheme[] {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 80);
  if (clean.length < 2) return themes;
  if (themes.some((theme) => !theme.dismissed && sameProblemTitle(theme.title, clean))) {
    return themes;
  }
  return [
    ...themes,
    {
      id: createId(),
      userId: "local",
      title: clean,
      status: "active",
      count: 1,
      firstSeen: todayKey,
      lastSeen: todayKey,
      peakIntensity: 5,
      reopened: false,
      dismissed: false,
      confidence: 1,
      summary: clean,
      quotes: [],
      manual: true,
      updatedAt: now,
    },
  ];
}

/** Versioned so a note judged before charged feelings could open a theme is read again. */
export function judgeStamp(entry: Pick<JournalEntry, "id" | "updatedAt">): string {
  return `2:${entry.id}:${entry.updatedAt}`;
}

/** Short cache key. The raw id plus timestamp does not fit the brief stamp limit. */
export function modelRequestStamp(prefix: string, entryStamp: string, pass = 0): string {
  let hash = 5381;
  const source = `${prefix}:${entryStamp}:${pass}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 33) ^ source.charCodeAt(index);
  }
  return `${prefix}:${(hash >>> 0).toString(36)}`;
}

export function pendingJudgeEntries(
  entries: JournalEntry[],
  settled: string[],
  periodDates: string[],
): JournalEntry[] {
  const days = new Set(periodDates);
  const done = new Set(settled);
  return entries
    .filter((entry) => entry.body.trim() && days.has(entry.date) && !done.has(judgeStamp(entry)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export function themesForJudge(themes: SessionTheme[]): SessionTheme[] {
  return themes
    .filter((theme) => theme.status === "active" && !theme.dismissed)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, 15);
}

function readJson(raw: string): unknown {
  let text = raw.trim();
  if (!text) return null;
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function asBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return null;
}

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function parseJudgeVerdict(raw: string): JudgeVerdict | null {
  const data = readJson(raw);
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const relevant = asBool(row.relevant);
  const confidence = asNum(row.confidence);
  if (relevant === null || confidence === null) return null;
  const matchRaw = typeof row.match_theme === "string" ? row.match_theme : row.matchTheme;
  const match = typeof matchRaw === "string" && matchRaw.trim() ? matchRaw.trim() : null;
  let title: string | null = null;
  const namedSource = row.new_theme ?? row.newTheme;
  if (typeof namedSource === "string" && namedSource.trim()) title = namedSource.trim();
  if (namedSource && typeof namedSource === "object") {
    const named = (namedSource as { title?: unknown }).title;
    if (typeof named === "string" && named.trim()) title = named.trim();
  }
  return {
    relevant,
    matchTheme: match,
    intensity: asNum(row.intensity) ?? 1,
    newTheme: title,
    confidence,
    quote: typeof row.quote === "string" ? row.quote : "",
    reason: typeof row.reason === "string" ? row.reason : "",
  };
}

export function parseDedupHit(raw: string): DedupHit | null {
  const data = readJson(raw);
  if (!data || typeof data !== "object") return null;
  const row = data as { same?: unknown; theme_id?: unknown; confidence?: unknown; title?: unknown };
  if (row.same !== true) return null;
  if (typeof row.theme_id !== "string" || !row.theme_id.trim()) return null;
  if (typeof row.confidence !== "number") return null;
  return {
    themeId: row.theme_id.trim(),
    confidence: row.confidence,
    title: typeof row.title === "string" ? row.title : "",
  };
}

export type BriefQuote = { entryId: string; date: string; text: string };

export type BriefModel = {
  header: string;
  mood: string | null;
  anomalies: { date: string; label: string; themes: string }[];
  themes: {
    id: string;
    title: string;
    count: number;
    peak: string | null;
    mark: ThemeMark;
    quotes: BriefQuote[];
  }[];
  discussed: { id: string; title: string; reopened: boolean }[];
  words: number;
};

export type BriefCopy = {
  header: string;
  headerOpen: string;
  moodUp: string;
  moodDown: string;
  moodFlat: string;
  anomaly: string;
  discussed: string;
  returned: string;
  mark: Record<ThemeMark, string>;
};

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function moodLine(entries: JournalEntry[], copy: BriefCopy): string | null {
  const scored = entries.filter((entry) => feelingValence(entry.feelings) !== null);
  if (scored.length < 2) return null;
  const mid = Math.floor(scored.length / 2);
  const avg = (rows: JournalEntry[]) =>
    rows.reduce((sum, entry) => sum + (feelingValence(entry.feelings) ?? 0), 0) / rows.length;
  const delta = avg(scored.slice(mid)) - avg(scored.slice(0, mid));
  if (delta >= 0.35) return copy.moodUp;
  if (delta <= -0.35) return copy.moodDown;
  return copy.moodFlat;
}

export function buildSessionBrief(input: {
  themes: SessionTheme[];
  entries: JournalEntry[];
  sessionDates: string[];
  lastSession: SessionNote | null;
  todayKey: string;
  copy: BriefCopy;
  dayLabel: (date: string) => string;
  longDate: (date: string) => string;
  feelingLabel: (feeling: Feeling) => string;
  entryPhrase: (count: number) => string;
  dayPhrase: (count: number) => string;
}): BriefModel {
  const periodEntries = input.entries.filter((entry) => entry.date <= input.todayKey);
  const days = new Set(periodEntries.map((entry) => entry.date));
  const header = input.lastSession
    ? fill(input.copy.header, {
        date: input.longDate(input.lastSession.date),
        entries: input.entryPhrase(periodEntries.length),
        days: input.dayPhrase(days.size),
      })
    : fill(input.copy.headerOpen, {
        entries: input.entryPhrase(periodEntries.length),
        days: input.dayPhrase(days.size),
      });

  const ranked = rankedThemes(input.themes, input.todayKey, input.sessionDates).slice(0, 4);
  const themes = ranked.map((theme) => ({
    id: theme.id,
    title: theme.title,
    count: theme.count,
    peak: theme.peakFeeling ? input.feelingLabel(theme.peakFeeling) : null,
    mark: themeMark(theme, input.todayKey, input.sessionDates),
    quotes: [...theme.quotes]
      .sort((a, b) => b.intensity - a.intensity || b.date.localeCompare(a.date))
      .slice(0, 2)
      .map((quote) => ({ entryId: quote.entryId, date: quote.date, text: quote.text })),
  }));

  const byDay = new Map<string, string[]>();
  for (const theme of ranked) {
    for (const quote of theme.quotes) {
      const list = byDay.get(quote.date) ?? [];
      if (!list.includes(theme.title)) list.push(theme.title);
      byDay.set(quote.date, list);
    }
  }
  const valences = periodEntries
    .map((entry) => feelingValence(entry.feelings))
    .filter((value): value is number => value !== null);
  const mean =
    valences.length > 0 ? valences.reduce((sum, value) => sum + value, 0) / valences.length : 0;
  const anomalies = [...days]
    .filter((date) => {
      const dayEntries = periodEntries.filter((entry) => entry.date === date);
      const scores = dayEntries
        .map((entry) => feelingValence(entry.feelings))
        .filter((value): value is number => value !== null);
      if (scores.length === 0 || !(byDay.get(date)?.length)) return false;
      const dayMean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      return dayMean <= mean - 0.5;
    })
    .slice(0, 3)
    .map((date) => ({
      date,
      label: input.dayLabel(date),
      themes: (byDay.get(date) ?? []).join(", "),
    }));

  const discussed = input.themes
    .filter((theme) => theme.status === "discussed" && !theme.dismissed)
    .slice(0, 4)
    .map((theme) => ({ id: theme.id, title: theme.title, reopened: theme.reopened }));

  const mood = moodLine(periodEntries, input.copy);
  const text = [
    header,
    mood ?? "",
    ...anomalies.map((item) => fill(input.copy.anomaly, { day: item.label, themes: item.themes })),
    ...themes.flatMap((theme) => [
      theme.title,
      ...theme.quotes.map((quote) => quote.text),
      input.copy.mark[theme.mark],
    ]),
    ...discussed.map((item) => item.title),
  ].join(" ");

  return {
    header,
    mood,
    anomalies,
    themes,
    discussed,
    words: wordCount(text),
  };
}

export function clipPattern(briefWords: number, pattern: string, limit = BRIEF_WORD_LIMIT): string {
  const clean = pattern.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const room = limit - briefWords;
  if (room <= 0) return "";
  const parts = clean.split(/(?<=[.!?])\s+/);
  const kept: string[] = [];
  for (const part of parts) {
    const next = [...kept, part].join(" ");
    if (wordCount(next) > room) break;
    kept.push(part);
    if (kept.length >= 3) break;
  }
  if (kept.length > 0) return kept.join(" ");
  return clean.split(/\s+/).slice(0, room).join(" ");
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : "",
  );
}

export function briefWordLimit(): number {
  return BRIEF_WORD_LIMIT;
}

function themeLine(theme: SessionTheme): string {
  const quotes = theme.quotes
    .slice(-3)
    .map((quote) => `${quote.date}: ${quote.text}`)
    .join(" | ");
  return `${theme.id} | ${theme.title} | ${theme.summary} | ×${theme.count} | ${theme.lastSeen}${quotes ? ` | ${quotes}` : ""}`;
}

export function judgeFacts(themes: SessionTheme[], entry: Pick<JournalEntry, "id" | "date" | "body" | "feelings">): string {
  const open = themesForJudge(themes).map(themeLine).join("\n");
  return [
    open ? `Открытые темы:\n${open}` : "Открытых тем нет.",
    `Запись ${entry.date}, отметка ${entry.feelings.join(", ") || "нет"}, интенсивность по отметке ${feelingIntensity(entry.feelings)}.`,
    entry.body.trim(),
  ].join("\n\n");
}

export function dedupFacts(theme: SessionTheme, others: SessionTheme[]): string {
  return [`Тема:\n${themeLine(theme)}`, `Другие:\n${others.map(themeLine).join("\n")}`].join("\n\n");
}

export function patternKey(themes: SessionTheme[], locale: string): string {
  const body = themes
    .map((theme) => `${theme.id}:${theme.updatedAt}:${theme.count}:${theme.status}`)
    .sort()
    .join("|");
  let hash = 5381;
  const source = `${body}\n${locale}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 33) ^ source.charCodeAt(index);
  }
  return `p:${(hash >>> 0).toString(36)}:${locale}`;
}

/** The saved brief already matches these themes, so the button must not call the model. */
export function patternAlreadyCurrent(
  savedStamp: string | undefined,
  stamp: string,
  text: string,
): boolean {
  return Boolean(text) && savedStamp === stamp;
}

export function patternFacts(themes: SessionTheme[]): string {
  return JSON.stringify(
    themes.slice(0, 4).map((theme) => ({
      title: theme.title,
      count: theme.count,
      peak: theme.peakFeeling ?? null,
      intensity: theme.peakIntensity,
      reopened: theme.reopened,
      quotes: theme.quotes.slice(0, 2).map((quote) => quote.text),
    })),
  );
}
