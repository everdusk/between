import { weekKey } from "./dates";
import type { LocaleId } from "./i18n";
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
import type { SessionTheme, ThemeLink, TherapyStore } from "./types";

/** Notes judged for one file. The hourly job cannot walk a whole journal. */
const SESSION_SHEET_JUDGE_CAP = 4;

export type SessionSheet = {
  themes: SessionTheme[];
  links: ThemeLink[];
  patternText: string;
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
 * Pattern and backlog for the session file only.
 * The journal still receives them when the week tab is open.
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
  for (const entry of pending) {
    const stamp = judgeStamp(entry);
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
  if (pending.length === 0 && patternReplyUsable(stored)) {
    return { themes: state.themes, links: state.links, patternText: stored };
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
    themes: state.themes,
    links: state.links,
    patternText: pattern || patternFromThemes(agenda),
  };
}
