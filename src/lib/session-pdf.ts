import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatDateSpan, formatDayLabel, formatLongDate, weekKey, weekdayShort } from "./dates";
import type { LocaleId } from "./i18n";
import { countPhrase, feelingLabel, translate } from "./messages";
import { entryInWindow, therapyWindow } from "./session-summary";
import { buildWeekSpectrum } from "./spectrum";
import { clipPattern, patternReplyUsable, rankedThemes } from "./themes";
import type { SessionSheet } from "./session-sheet";
import type { TherapyStore } from "./types";
import { buildWeekPdfModel, type WeekPdfModel } from "./week-pdf-model";
import { renderWeekPdf, type WeekPdfFonts } from "./week-pdf";

const FONT_FILES: Record<keyof WeekPdfFonts, string> = {
  display: "Unbounded-SemiBold.ttf",
  text: "Manrope-Regular.ttf",
  strong: "Manrope-SemiBold.ttf",
  arabic: "NotoSansArabic-Regular.ttf",
  devanagari: "NotoSansDevanagari-Regular.ttf",
};

let fontCache: Promise<WeekPdfFonts> | null = null;

function loadFonts(): Promise<WeekPdfFonts> {
  if (!fontCache) {
    const dir = path.join(process.cwd(), "public/fonts");
    fontCache = (async () => {
      const pairs = await Promise.all(
        (Object.keys(FONT_FILES) as (keyof WeekPdfFonts)[]).map(async (key) => {
          const bytes = new Uint8Array(await readFile(path.join(dir, FONT_FILES[key])));
          return [key, bytes] as const;
        }),
      );
      return Object.fromEntries(pairs) as WeekPdfFonts;
    })();
  }
  return fontCache;
}

/** Notes with text inside the same therapy period the sheet covers. Mood marks do not count. */
export function sessionPeriodNoteCount(
  store: TherapyStore,
  todayKey: string,
  now: Date,
): number {
  const period = therapyWindow(store.sessions, store.entries, todayKey, now, store.sessionPlan);
  return store.entries.filter(
    (entry) => entryInWindow(entry, period) && entry.body.trim().length > 0,
  ).length;
}

/** The same sheet the week tab builds, from the stored journal. */
export function buildSessionPdfModel(
  store: TherapyStore,
  locale: LocaleId,
  todayKey: string,
  now: Date,
  sheet?: SessionSheet,
): WeekPdfModel {
  const period = therapyWindow(store.sessions, store.entries, todayKey, now, store.sessionPlan);
  const days = period.days;
  const weekEntries = store.entries.filter((entry) => entryInWindow(entry, period));
  const sessionDates = store.sessions.map((session) => session.date);
  const themes = sheet?.themes ?? store.themes ?? [];
  const agenda = rankedThemes(themes, todayKey, sessionDates);
  const said = themes.filter((theme) => theme.status === "discussed" && !theme.dismissed);
  const prep =
    store.weekPreps.find((item) => item.weekKey === period.weekKey) ??
    store.weekPreps.find((item) => item.weekKey === weekKey(now));
  const patternRaw = sheet
    ? clipPattern(0, sheet.patternText)
    : prep?.patternText
      ? clipPattern(0, prep.patternText)
      : "";
  const pattern = patternReplyUsable(patternRaw) ? patternRaw : "";
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number | undefined>) =>
    translate(locale, key, vars);
  const feeling = (value: Parameters<typeof feelingLabel>[1]) => feelingLabel(locale, value);
  const spectrum = buildWeekSpectrum(days, weekEntries);
  return buildWeekPdfModel({
    todayKey,
    dayKeys: days,
    entries: store.entries,
    themes: [...agenda, ...said],
    links: sheet?.links ?? store.themeLinks ?? [],
    now,
    range:
      period.last && days.length === 0
        ? t("afterSessionLead", { date: formatLongDate(period.last.date, locale) })
        : t("weekLead", {
            range: formatDateSpan(days[0] ?? todayKey, days[days.length - 1] ?? todayKey, locale),
          }),
    spectrumLabel: t("spectrumLabel"),
    spectrumTitle: spectrumTitle(spectrum, t, feeling),
    spectrumLead: spectrumLead(spectrum, weekEntries.length, t, feeling),
    axis: t("spectrumAxis"),
    patternTitle: t("briefPatternTitle"),
    patternText: pattern || t("patternThin"),
    backlogTitle: t("backlogTitle"),
    backlogLead: t("backlogLead"),
    emptyBacklog: t("backlogEmpty"),
    noNotes: t("backlogNoNotes"),
    said: t("backlogSaid"),
    weekday: (day) => weekdayShort(day, locale),
    dayNumber: (day) => String(Number(day.slice(8))),
    when: (day) => formatDayLabel(day, locale),
    feeling,
    noteCount: (amount) => countPhrase(locale, amount, "note"),
  });
}

function spectrumTitle(
  spectrum: ReturnType<typeof buildWeekSpectrum>,
  t: (key: Parameters<typeof translate>[1], vars?: Record<string, string | number | undefined>) => string,
  feeling: (value: Parameters<typeof feelingLabel>[1]) => string,
): string {
  if (spectrum.feelingTotal === 0) return t("spectrumQuiet");
  if (spectrum.top.length === 1) return feeling(spectrum.top[0]);
  if (spectrum.top.length === 2) return t("spectrumPair", { a: feeling(spectrum.top[0]), b: feeling(spectrum.top[1]) });
  return t("spectrumSeveral");
}

function spectrumLead(
  spectrum: ReturnType<typeof buildWeekSpectrum>,
  noteCount: number,
  t: (key: Parameters<typeof translate>[1], vars?: Record<string, string | number | undefined>) => string,
  feeling: (value: Parameters<typeof feelingLabel>[1]) => string,
): string {
  if (spectrum.feelingTotal === 0 && noteCount === 0) return t("spectrumEmpty");
  if (spectrum.feelingTotal === 0) return t("spectrumNoFeelings");
  if (spectrum.top.length === 1) return t("spectrumTopOne", { feeling: feeling(spectrum.top[0]) });
  if (spectrum.top.length === 2) {
    return t("spectrumTopTwo", { a: feeling(spectrum.top[0]), b: feeling(spectrum.top[1]) });
  }
  return t("spectrumTopMany");
}

export async function renderSessionPdf(
  store: TherapyStore,
  locale: LocaleId,
  todayKey: string,
  now: Date,
  sheet?: SessionSheet,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const model = buildSessionPdfModel(store, locale, todayKey, now, sheet);
  const bytes = await renderWeekPdf(model, await loadFonts());
  return { bytes, filename: model.filename };
}
