import { parseDateKey } from "./dates";
import type { LocaleId } from "./i18n";
import { feelingLabel, translate } from "./messages";
import { entryInWindow, therapyWindow } from "./session-summary";
import { isSessionTime, weeklySlots } from "./session-plan";
import { buildWeekSpectrum } from "./spectrum";
import { patternReplyUsable, rankedThemes } from "./themes";
import type { SessionPlan, TherapyStore } from "./types";

/** The hourly job sends once inside this window, on the session day. */
export const SESSION_BRIEF_LEAD_HOURS = 2;

export const SESSION_BRIEF_SLOT = "session-brief";

function weekdayIndex(dateKey: string): number {
  const day = parseDateKey(dateKey).getDay();
  return day === 0 ? 6 : day - 1;
}

function clockHour(time: string): number | null {
  if (!isSessionTime(time)) return null;
  return Number(time.slice(0, 2));
}

/** The session clock on this calendar day, when the plan has one. */
export function sessionTimeOnDay(plan: SessionPlan | null | undefined, dateKey: string): string | null {
  if (!plan) return null;
  if (plan.mode === "once") {
    return plan.date === dateKey && isSessionTime(plan.time) ? plan.time : null;
  }
  const slot = weeklySlots(plan).find((item) => item.weekday === weekdayIndex(dateKey));
  return slot?.time ?? null;
}

/**
 * True from two hours before the session until the session hour starts.
 * A 18:30 session sends at 16:00 and, if that hour was missed, at 17:00.
 * The session day stays the same day: a 01:00 session has no two-hour window left.
 */
export function sessionBriefDue(input: {
  plan: SessionPlan | null | undefined;
  dateKey: string;
  hour: number;
}): { time: string } | null {
  const time = sessionTimeOnDay(input.plan, input.dateKey);
  if (!time) return null;
  const sessionHour = clockHour(time);
  if (sessionHour === null || sessionHour < SESSION_BRIEF_LEAD_HOURS) return null;
  const lead = sessionHour - SESSION_BRIEF_LEAD_HOURS;
  if (input.hour < lead || input.hour >= sessionHour) return null;
  return { time };
}

function patternParagraph(store: TherapyStore, weekKey: string): string {
  const usable = (text: string | undefined) => {
    const clean = text?.replace(/\s+/g, " ").trim() ?? "";
    return patternReplyUsable(clean) ? clean : "";
  };
  const matched = store.weekPreps.find((item) => item.weekKey === weekKey);
  const fromWindow = usable(matched?.patternText);
  if (fromWindow) return fromWindow;
  const latest = [...store.weekPreps]
    .filter((item) => usable(item.patternText))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return usable(latest?.patternText);
}

/** Pattern, the most common mood, and the backlog as bullets. */
export function sessionBriefText(input: {
  store: TherapyStore;
  locale: LocaleId;
  todayKey: string;
  now: Date;
  time: string;
}): string {
  const { store, locale, todayKey, now, time } = input;
  const period = therapyWindow(store.sessions, store.entries, todayKey, now, store.sessionPlan);
  const entries = store.entries.filter((entry) => entryInWindow(entry, period));
  const spectrum = buildWeekSpectrum(period.days, entries);
  const pattern = patternParagraph(store, period.weekKey) || translate(locale, "patternThin");
  const mood =
    spectrum.top.length === 0
      ? translate(locale, "spectrumNoFeelings")
      : spectrum.top.length === 1
        ? translate(locale, "spectrumTopOne", { feeling: feelingLabel(locale, spectrum.top[0]) })
        : spectrum.top.length === 2
          ? translate(locale, "spectrumTopTwo", {
              a: feelingLabel(locale, spectrum.top[0]),
              b: feelingLabel(locale, spectrum.top[1]),
            })
          : translate(locale, "spectrumTopMany");
  const themes = rankedThemes(
    store.themes,
    todayKey,
    store.sessions.map((session) => session.date),
  );
  const bullets = themes
    .map((theme) => theme.title.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((title) => `• ${title}`);
  const backlog = bullets.length > 0 ? bullets.join("\n") : translate(locale, "backlogEmpty");
  return [
    translate(locale, "botSessionBriefLead", { time }),
    "",
    translate(locale, "briefPatternTitle"),
    pattern,
    "",
    mood,
    "",
    translate(locale, "backlogTitle"),
    backlog,
  ].join("\n");
}
