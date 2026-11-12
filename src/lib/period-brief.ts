import { feelingLabel, translate } from "./messages";
import type { LocaleId } from "./i18n";
import { entryInWindow, therapyWindow } from "./session-summary";
import { sessionPeriodNoteCount } from "./session-pdf";
import { buildWeekSpectrum } from "./spectrum";
import type { TherapyStore } from "./types";

export type PeriodBrief = { notes: number; mood: string; themes: string };

/** Counts and labels already on the journal. Does not call the model. */
export function periodBrief(store: TherapyStore, locale: LocaleId, dateKey: string, now: Date): PeriodBrief {
  const period = therapyWindow(store.sessions, store.entries, dateKey, now, store.sessionPlan);
  const entries = store.entries.filter((entry) => entryInWindow(entry, period));
  const spectrum = buildWeekSpectrum(period.days, entries);
  const mood =
    spectrum.top.length === 0
      ? translate(locale, "spectrumNoFeelings")
      : spectrum.top
          .slice(0, 2)
          .map((feeling) => feelingLabel(locale, feeling))
          .join(", ");
  const themes = (store.themes ?? [])
    .filter((theme) => theme.status === "active" && !theme.dismissed && theme.title.trim())
    .slice(0, 2)
    .map((theme) => theme.title.trim());
  return {
    notes: sessionPeriodNoteCount(store, dateKey, now),
    mood,
    themes: themes.length > 0 ? themes.join(", ") : "—",
  };
}
