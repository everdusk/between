import { weekKey } from "./dates";
import type { LocaleId } from "./i18n";
import { mergeStores } from "./journal-api";
import { loadUserStore, saveUserStore } from "./redis";
import { entryInWindow, therapyWindow } from "./session-summary";
import {
  applyVerdict,
  clipPattern,
  dedupFacts,
  fallbackVerdict,
  judgeFacts,
  judgeStamp,
  mergeThemes,
  modelRequestStamp,
  parseDedupHit,
  parseJudgeVerdict,
  patternFacts,
  patternFromThemes,
  patternKey,
  patternReplyUsable,
  pendingJudgeEntries,
  rankedThemes,
  themesForJudge,
  type ThemeState,
} from "./themes";
import { emptyStore, type SessionTheme, type ThemeLink, type TherapyStore } from "./types";

/** Notes judged for one file. The hourly job cannot walk a whole journal. */
const SESSION_SHEET_JUDGE_CAP = 4;

export type SessionSheet = {
  themes: SessionTheme[];
  links: ThemeLink[];
  patternText: string;
  /** Judge stamps handled for this file. The week tab skips these notes. */
  judged: string[];
  judgedEntryIds: string[];
  patternStamp: string;
  weekKey: string;
  /** False when the paragraph was already on the week. */
  freshPattern: boolean;
};

export type SessionSheetAsk = (input: {
  facts: string;
  stamp: string;
  kind: "judge" | "dedup" | "pattern";
}) => Promise<{ text: string | null }>;

async function defaultAsk(
  userId: string,
  locale: LocaleId,
  input: Parameters<SessionSheetAsk>[0],
): Promise<{ text: string | null }> {
  const { completeBrief } = await import("@/app/api/brief/route");
  const result = await completeBrief({
    userId,
    facts: input.facts,
    stamp: input.stamp,
    locale,
    kind: input.kind,
  });
  return { text: result.text };
}

/**
 * Pattern and backlog for the session file.
 * `rememberSessionSheet` stores the result so the week tab does not ask again.
 */
export async function prepareSessionSheet(
  store: TherapyStore,
  locale: LocaleId,
  todayKey: string,
  now: Date,
  userId: string,
  ask?: SessionSheetAsk,
): Promise<SessionSheet> {
  const run = ask ?? ((input) => defaultAsk(userId, locale, input));
  const period = therapyWindow(store.sessions, store.entries, todayKey, now, store.sessionPlan);
  const weekEntries = store.entries.filter((entry) => entryInWindow(entry, period));
  let state: ThemeState = {
    themes: [...(store.themes ?? [])],
    links: [...(store.themeLinks ?? [])],
  };
  const pending = pendingJudgeEntries(weekEntries, store.judgeSettled ?? [], period.days).slice(
    0,
    SESSION_SHEET_JUDGE_CAP,
  );
  const judged: string[] = [];
  const judgedEntryIds: string[] = [];
  for (const entry of pending) {
    const stamp = judgeStamp(entry);
    judged.push(stamp);
    judgedEntryIds.push(entry.id);
    let text: string | null = null;
    try {
      text = (await run({
        facts: judgeFacts(themesForJudge(state.themes), entry),
        stamp: modelRequestStamp("j", stamp),
        kind: "judge",
      })).text;
    } catch {
      text = null;
    }
    const verdict = text ? parseJudgeVerdict(text) : null;
    const applied = applyVerdict(
      state,
      entry,
      verdict ?? fallbackVerdict(entry),
      now.toISOString(),
      userId,
    );
    state = applied.state;
    let focus = verdict ? applied.touchedId : null;
    for (let pass = 0; pass < 2 && focus; pass += 1) {
      const theme = state.themes.find(
        (item) => item.id === focus && item.status === "active" && !item.dismissed,
      );
      const others = state.themes.filter(
        (item) => item.id !== focus && item.status === "active" && !item.dismissed,
      );
      if (!theme || theme.manual || others.length === 0) break;
      let dedupText: string | null = null;
      try {
        dedupText = (await run({
          facts: dedupFacts(theme, others),
          stamp: modelRequestStamp("d", stamp, pass),
          kind: "dedup",
        })).text;
      } catch {
        dedupText = null;
      }
      const hit = dedupText ? parseDedupHit(dedupText) : null;
      if (!hit || hit.confidence < 0.85 || hit.themeId === focus) break;
      state = mergeThemes(state, hit.themeId, focus, hit.title, now.toISOString());
      focus = hit.themeId;
    }
  }

  const sessionDates = store.sessions.map((session) => session.date);
  const agenda = rankedThemes(state.themes, todayKey, sessionDates);
  const prep =
    store.weekPreps.find((item) => item.weekKey === period.weekKey) ??
    store.weekPreps.find((item) => item.weekKey === weekKey(now));
  const stored = prep?.patternText ? clipPattern(0, prep.patternText) : "";
  const patternStamp = patternKey(agenda, locale);
  const carried = {
    themes: state.themes,
    links: state.links,
    judged,
    judgedEntryIds,
    patternStamp,
    weekKey: period.weekKey,
  };
  if (pending.length === 0 && patternReplyUsable(stored)) {
    return { ...carried, patternText: stored, freshPattern: false };
  }

  const facts = patternFacts(agenda);
  let pattern = "";
  if (facts.trim()) {
    try {
      const text = (await run({
        facts,
        stamp: patternKey(agenda, locale),
        kind: "pattern",
      })).text;
      const clipped = text ? clipPattern(0, text) : "";
      if (patternReplyUsable(clipped)) pattern = clipped;
    } catch {
      pattern = "";
    }
  }
  return {
    ...carried,
    patternText: pattern || patternFromThemes(agenda),
    freshPattern: true,
  };
}

/** Writes the sheet onto a journal without dropping notes the tab saved in the meantime. */
export function applySessionSheet(store: TherapyStore, sheet: SessionSheet, now: Date): TherapyStore {
  const settled = new Set(store.judgeSettled ?? []);
  const freshIds = new Set(
    sheet.judgedEntryIds.filter((id) => {
      const entry = store.entries.find((item) => item.id === id);
      return Boolean(entry && !settled.has(judgeStamp(entry)));
    }),
  );
  const themeIds = new Set(
    sheet.links.filter((link) => freshIds.has(link.entryId)).map((link) => link.themeId),
  );
  const patch = emptyStore();
  patch.themes = sheet.themes.filter((theme) => themeIds.has(theme.id));
  patch.themeLinks = sheet.links.filter((link) => freshIds.has(link.entryId));
  patch.judgeSettled = sheet.judged.filter((_, index) => freshIds.has(sheet.judgedEntryIds[index] ?? ""));
  const prep = store.weekPreps.find((item) => item.weekKey === sheet.weekKey);
  const existing = prep?.patternText ? clipPattern(0, prep.patternText) : "";
  if (sheet.freshPattern && patternReplyUsable(sheet.patternText) && !patternReplyUsable(existing)) {
    patch.weekPreps = [
      {
        ...(prep ?? { weekKey: sheet.weekKey, talkNotes: "" }),
        weekKey: sheet.weekKey,
        updatedAt: now.toISOString(),
        patternText: sheet.patternText,
        patternStamp: sheet.patternStamp,
      },
    ];
  }
  return mergeStores(store, patch);
}

/** Keeps the formed sheet on the journal. A missed write still lets the file go out. */
export async function rememberSessionSheet(owner: string, sheet: SessionSheet, now = new Date()): Promise<void> {
  try {
    const fresh = await loadUserStore(owner);
    await saveUserStore(owner, applySessionSheet(fresh, sheet, now));
  } catch {
    // The tab forms the sheet later if this write does not land.
  }
}
