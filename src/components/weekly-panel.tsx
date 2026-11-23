"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download, LoaderCircle, RotateCcw } from "lucide-react";
import { DateNavigation } from "@/components/date-navigation";
import { useI18n } from "@/components/locale-provider";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { reviewPdfText } from "@/lib/theme-review";
import { WeeklyReview, type SaveReview } from "./weekly-review";
import { WeekSpectrum } from "@/components/week-spectrum";
import {
  addDays, parseDateKey,
  formatDateSpan,
  formatDayLabel,
  formatLongDate,
  formatTime,
  toDateKey,
  weekdayShort,

} from "@/lib/dates";
import { entryInWindow, observationWindow } from "@/lib/session-summary";
import { briefStamp, tagCounts } from "@/lib/brief";
import { parseModelThemes, shownEntryTags, themeContextChunks } from "@/lib/tags";
import { feelingFill, spectrumTimeSummary } from "@/lib/spectrum";
import { buildWeekPdfModel } from "@/lib/week-pdf-model";
import { requestBrief } from "@/lib/journal-api";
import {
  clipPattern,
  judgeStamp,
  patternFacts,
  patternHasWords,
  patternKey,
  patternReplyUsable,
  patternShouldRequest,
  pendingJudgeEntries,
  rankedThemes,
} from "@/lib/themes";
import type { JournalEntry, SessionNote, SessionPlan, SessionTheme, ThemeLink, WeekPrep } from "@/lib/types";
import { cn } from "@/lib/utils";

const themeGaveUp = new Set<string>();
const patternGaveUp = new Set<string>();

interface WeeklyPanelProps {
  review?: SaveReview;
  inMessenger: boolean;
  entries: JournalEntry[];
  sessions: SessionNote[];
  plan: SessionPlan | null;
  weekPreps: WeekPrep[];
  themes: SessionTheme[];
  themeLinks: ThemeLink[];
  judgeSettled: string[];
  judgeSkipped?: string[];
  onSavePattern: (weekKey: string, patternText: string, patternStamp: string, pilot?: boolean) => boolean;
  onSaveThemes: (
    updates: { id: string; updatedAt: string; themes: string[] }[],
    weekKey: string,
    themeStamp: string,
    themeSource: "model" | "rules",
  ) => boolean;
  initData?: string;
  maxInitData?: string;
  /** Browser session: the week model may run without Telegram init data. */
  cloud?: boolean;
  guest?: boolean;
  disabled?: boolean;
}

export function WeeklyPanel({
  review,
  inMessenger,
  entries,
  sessions,
  plan,
  weekPreps,
  themes,
  themeLinks,
  judgeSettled,
  judgeSkipped = [],
  onSavePattern,
  onSaveThemes,
  initData,
  maxInitData = "",
  cloud,
  guest = false,
  disabled,
}: WeeklyPanelProps) {
  const { t, locale, feeling, slot, count } = useI18n();
  const pilotEnabled = Boolean(review);
  const remote = !guest && Boolean(initData || maxInitData || cloud);
  const [clock, setNow] = useState(() => new Date());
  const [history, setHistory] = useState<Date[]>([]);
  const now = history.at(-1) ?? clock;
  const todayKey = toDateKey(now);
  const period = observationWindow(sessions, entries, todayKey, now, plan);
  const days = period.days;
  const key = period.weekKey;
  const boundaryAt = period.endsAt?.getTime() ?? null;
  useEffect(() => {
    if (history.length || boundaryAt === null) return;
    const delay = boundaryAt - Date.now() + 1000;
    if (delay <= 0 || delay > 8 * 24 * 60 * 60 * 1000) return;
    const timer = window.setTimeout(() => setNow(new Date()), delay);
    return () => window.clearTimeout(timer);
  }, [boundaryAt, history.length]);
  const prep =
    weekPreps.find((item) => item.weekKey === key);
  const [themeFilter, setThemeFilter] = useState<string | null>(null);

  const byDate = new Map<string, JournalEntry[]>();
  for (const day of days) byDate.set(day, []);
  for (const entry of entries) {
    if (!entryInWindow(entry, period)) continue;
    const list = byDate.get(entry.date);
    if (list) list.push(entry);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const weekEntries = days.flatMap((day) => byDate.get(day) ?? []);

  const weekTags = tagCounts(
    weekEntries.map((entry) => ({ ...entry, tags: shownEntryTags(entry) })),
  );
  const activeTheme = weekTags.some((item) => item.tag === themeFilter) ? themeFilter : null;
  const selectedDay =
    latestNotedDay(days, byDate, todayKey);
  const noteDays = days.filter((day) =>
    (byDate.get(day) ?? []).some((entry) => entry.body.trim()),
  ).length;
  const sessionDates = sessions.map((session) => session.date);
  const agenda = rankedThemes(themes, todayKey, sessionDates);
  const said = themes
    .filter((theme) => theme.status === "discussed" && !theme.dismissed)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || a.title.localeCompare(b.title));
  const patternFactText = patternFacts(agenda, { entries, links: themeLinks, dayKeys: days });
  const patternStamp = patternKey(agenda, locale, patternFactText);
  const patternRaw = prep?.patternText ? clipPattern(0, prep.patternText) : "";
  const patternBody = patternReplyUsable(patternRaw) ? patternRaw : "";
  const patternWords = patternHasWords(agenda);
  const skippedJudges = new Set(judgeSkipped);
  const judging =
    pendingJudgeEntries(weekEntries, judgeSettled, days).filter(
      (entry) => !skippedJudges.has(judgeStamp(entry)),
    ).length > 0;
  const themeStamp = `t2:${briefStamp(
    weekEntries.filter((entry) => entry.body.trim()),
    "",
  )}`;
  const themesSettled = prep?.themeStamp === themeStamp && prep.themeSource === "model";
  const [failedThemeStamp, setFailedThemeStamp] = useState<string | null>(null);
  const [failedPatternStamp, setFailedPatternStamp] = useState<string | null>(null);
  const themeChunks = themeContextChunks(weekEntries, {
    todayKey,
    today: t("briefToday"),
    feeling,
    day: (day) => formatDayLabel(day, locale),
  });
  const themeChunkKey = themeChunks.join("\u0000");
  const themesPending =
    remote &&
    !disabled &&
    !themesSettled &&
    Boolean(themeChunkKey) &&
    failedThemeStamp !== themeStamp &&
    !themeGaveUp.has(themeStamp);
  const themeChunksRef = useRef(themeChunks);
  const sentRef = useRef<{ id: string; updatedAt: string }[]>([]);
  useLayoutEffect(() => {
    themeChunksRef.current = themeChunks;
    sentRef.current = weekEntries
      .filter((entry) => entry.body.trim())
      .map((entry) => ({ id: entry.id, updatedAt: entry.updatedAt }));
  }, [themeChunkKey, themeChunks, weekEntries]);
  const themeAttempt = useRef<string | null>(null);

  useEffect(() => {
    if (themesSettled || disabled || !remote || !themeChunkKey) return;
    if (themeGaveUp.has(themeStamp)) return;
    if (themeAttempt.current === themeStamp) return;
    themeAttempt.current = themeStamp;
    let cancelled = false;
    void (async () => {
      const found = new Map<string, string[]>();
      const chunks = themeChunksRef.current;
      for (let index = 0; index < chunks.length; index += 1) {
        const result = await requestBrief(
          initData ?? "",
          chunks[index],
          `${themeStamp}:${index}`,
          locale,
          "themes",
          maxInitData,
        );
        if (cancelled) return;
        const parsed = result.ok && result.text != null ? parseModelThemes(result.text) : null;
        if (!parsed) {
          themeGaveUp.add(themeStamp);
          if (!cancelled) setFailedThemeStamp(themeStamp);
          return;
        }
        for (const row of parsed) found.set(row.id, row.themes);
      }
      const sent = sentRef.current;
      if (sent.some((item) => !found.has(item.id))) return;
      onSaveThemes(
        sent.map((item) => ({ ...item, themes: found.get(item.id) ?? [] })),
        key,
        themeStamp,
        "model",
      );
    })();
    return () => {
      cancelled = true;
      if (themeAttempt.current === themeStamp) themeAttempt.current = null;
    };
  }, [themesSettled, disabled, initData, maxInitData, remote, themeChunkKey, themeStamp, locale, key, onSaveThemes]);

  const patternAttempt = useRef<string | null>(null);
  const savedPatternStamp = prep?.patternStamp;
  const savedPatternText = prep?.patternText ?? "";
  useEffect(() => {
    if (
      pilotEnabled || !patternShouldRequest({
        hasInitData: remote,
        disabled: Boolean(disabled),
        judging,
        themeCount: agenda.length,
        hasWords: patternWords,
        savedStamp: savedPatternStamp,
        stamp: patternStamp,
        savedText: savedPatternText,
        gaveUp: patternGaveUp.has(patternStamp),
        inFlight: patternAttempt.current === patternStamp,
      })
    ) {
      return;
    }
    patternAttempt.current = patternStamp;
    const facts = patternFactText;
    let cancelled = false;
    void (async () => {
      const result = await requestBrief(initData ?? "", facts, patternStamp, locale, "pattern",maxInitData);
      if (cancelled) return;
      const text = result.ok ? clipPattern(0, result.text ?? "") : "";
      if (!result.ok || !patternReplyUsable(text)) {
        patternGaveUp.add(patternStamp);
        if (!cancelled) setFailedPatternStamp(patternStamp);
        return;
      }
      onSavePattern(key, text, patternStamp);
    })();
    return () => {
      cancelled = true;
      if (patternAttempt.current === patternStamp) patternAttempt.current = null;
    };
  }, [
    agenda.length,
    pilotEnabled,
    disabled,
    initData,
    remote,
    judging,
    key,
    locale,
    maxInitData,
    onSavePattern,
    patternFactText,
    patternStamp,
    patternWords,
    savedPatternStamp,
    savedPatternText,
  ]);

  const notesPhrase = count(weekEntries.length, "note");
  const notesSpace = notesPhrase.indexOf(" ");
  const shownPattern =
    patternBody ||
    (!patternWords ||
    Boolean(patternRaw) ||
    failedPatternStamp === patternStamp ||
    patternGaveUp.has(patternStamp)
      ? t("patternThin")
      : "");
  const pilotText = review && prep?.reviewSummary ? reviewPdfText(prep.reviewSummary.text,weekEntries,entries,t("reviewChange")) : "";
  const pdfPattern = pilotText || shownPattern;
  const [pdfAttempt, setPdfAttempt] = useState(0);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const deliverRef = useRef<typeof import("@/lib/week-pdf").deliverWeekPdf | null>(null);
  const pdfSignature = [
    todayKey,
    days.join(","),
    weekEntries.map((entry) => `${entry.id}:${entry.updatedAt}:${entry.body}`).join(","),
    pdfPattern,
    agenda.map((theme) => `${theme.id}:${theme.status}:${theme.title}`).join(","),
    said.map((theme) => `${theme.id}:${theme.title}`).join(","),
    themeLinks.map((link) => `${link.entryId}:${link.themeId}`).join(","),
    locale,
    pdfAttempt,
  ].join("|");
  const pdfState = failedFor === pdfSignature ? "fail" : readyFor === pdfSignature ? "ready" : "busy";
  useEffect(() => {
    let cancelled = false;
    fileRef.current = null;
    if (guest) return;
    const model = buildWeekPdfModel({
      todayKey,
      dayKeys: days,
      entries,
      themes: [...agenda, ...said],
      links: themeLinks,
      now,
      range:
        period.last && days.length === 0
          ? t("afterSessionLead", { date: formatLongDate(period.last.date, locale) })
          : t("weekLead", {
              range: formatDateSpan(days[0] ?? todayKey, days[days.length - 1] ?? todayKey, locale),
            }),
      spectrumLabel: t("spectrumLabel"),
      spectrumTitle: spectrumTimeSummary(weekEntries, t),
      spectrumLead: "",
      axis: "",
      patternTitle: t(review ? "reviewWeek" : "briefPatternTitle"),
      patternText: pdfPattern || t("patternThin"),
      backlogTitle: t("backlogTitle"),

      emptyBacklog: t("backlogEmpty"),
      noNotes: t("backlogNoNotes"),
      said: t("backlogSaid"),
      weekday: (day) => weekdayShort(day, locale),
      dayNumber: (day) => String(Number(day.slice(8))),
      when: (day) => formatDayLabel(day, locale),
      feeling,
      noteCount: (amount) => count(amount, "note"),
    });
    void import("@/lib/week-pdf")
      .then(async (mod) => {
        deliverRef.current = mod.deliverWeekPdf;
        const file = await mod.createWeekPdfFile(model);
        if (cancelled) return;
        fileRef.current = file;
        setReadyFor(pdfSignature);
      })
      .catch(() => {
        if (!cancelled) setFailedFor(pdfSignature);
      });
    return () => {
      cancelled = true;
    };
    // pdfSignature already names every input the sheet is built from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfSignature, guest]);

  function savePdf() {
    const file = fileRef.current;
    const deliver = deliverRef.current;
    if (!file || !deliver) return;
    void deliver(file, true, inMessenger ? "messenger" : "web");
  }

  const pdfLabel = t(pdfState === "busy" ? "weekPdfBusy" : pdfState === "fail" ? "weekPdfFail" : inMessenger ? "weekPdf" : "weekPdfDownload");
  return (
    <div className="space-y-4">
      <DateNavigation
        range
        previous={{
          label: t("deskOverview") + " ←",
          onClick: () => {
            const earlier = period.startsAfter
              ? new Date(period.startsAfter.getTime() - 1)
              : parseDateKey(addDays(days[0] ?? todayKey, -1));
            if (earlier < now) setHistory(prev => [...prev, earlier]);
          },
        }}
        next={{
          label: t("deskOverview") + " →",
          disabled: !history.length,
          onClick: () => setHistory(prev => prev.slice(0, -1)),
        }}
        action={!guest &&
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={pdfLabel}
            title={pdfLabel}
            disabled={pdfState === "busy"}
            onClick={() => {
              if (pdfState === "fail") {
                setPdfAttempt((attempt) => attempt + 1);
                return;
              }
              savePdf();
            }}
          >
            {pdfState === "busy" ? <LoaderCircle aria-hidden className="animate-spin" /> : pdfState === "fail" ? <RotateCcw aria-hidden /> : <Download aria-hidden />}
          </Button>
        }
      >
        <h2 className="text-balance">
          {period.last && days.length === 0
            ? t("afterSessionLead", { date: formatLongDate(period.last.date, locale) })
            : formatDateSpan(days[0] ?? todayKey, days[days.length - 1] ?? todayKey, locale)}
        </h2>
      </DateNavigation>

      <WeekSpectrum
        dayKeys={days}
        entries={weekEntries}
        todayKey={todayKey}
        patternTitle={guest ? "ИИ-обзор" : t("briefPatternTitle")}
        patternText={guest ? "После регистрации, когда накопится больше записей, здесь появится ИИ-сводка. Она поможет заметить, какие чувства и ситуации повторяются." : review ? "" : shownPattern}
        patternPending={
          review || patternBody ||
          !patternWords ||
          Boolean(patternRaw) ||
          failedPatternStamp === patternStamp ||
          patternGaveUp.has(patternStamp)
            ? ""
            : themesPending ||
                patternShouldRequest({
                  hasInitData: remote,
                  disabled: Boolean(disabled),
                  judging,
                  themeCount: agenda.length,
                  hasWords: patternWords,
                  savedStamp: savedPatternStamp,
                  stamp: patternStamp,
                  savedText: savedPatternText,
                  gaveUp: patternGaveUp.has(patternStamp) || failedPatternStamp === patternStamp,
                  inFlight: false,
                })
              ? t("formulating")
              : ""
        }
      />

      {review && !disabled && <WeeklyReview key={key} entries={entries} current={weekEntries} themes={themes}
        links={themeLinks} today={todayKey} live={!history.length} initData={initData ?? ""}
        maxInitData={maxInitData} period={key} save={review} saved={prep?.reviewSummary} saveSummary={onSavePattern} />}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-3xl p-5">
          <p className="tabular font-display text-[2rem] leading-none text-foreground">
            {noteDays}
            <span className="ms-1 font-sans text-base text-muted-foreground">/ {days.length}</span>
          </p>
          <p className="mt-2 text-xs leading-snug text-muted-foreground">{t("weekDaysNoted")}</p>
        </div>
        <div className="glass rounded-3xl p-5">
          <p className="tabular font-display text-[2rem] leading-none text-foreground">
            {notesSpace > 0 ? notesPhrase.slice(0, notesSpace) : notesPhrase}
          </p>
          <p className="mt-2 text-xs leading-snug text-muted-foreground">
            {notesSpace > 0 ? notesPhrase.slice(notesSpace + 1) : ""}
          </p>
        </div>
      </div>
      {weekEntries.some(entry=>entry.reflection) && <section className="glass space-y-3 rounded-3xl p-5"><h2 className="font-display text-xl">{t("insights")}</h2>
        {weekEntries.filter(entry=>entry.reflection).map(entry=><details key={entry.id} className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer">{entry.reflection!.insight || entry.reflection!.answer}</summary>
          <p className="mt-2 text-xs text-muted-foreground">{formatDayLabel(entry.date,locale)}</p><p className="whitespace-pre-wrap">{entry.body}</p>
          <p className="mt-2 whitespace-pre-wrap">{entry.reflection!.answer}</p>
        </details>)}</section>}



      {weekTags.length > 0 && (
        <div className="space-y-3 px-2 pt-3">
          <p className="eyebrow text-section-header">{t("themes")}</p>
          <div className="flex flex-wrap gap-2" aria-label={t("themes")}>
            {weekTags.map((item) => {
              const pressed = activeTheme === item.tag;
              return (
                <button
                  key={item.tag}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() =>
                    setThemeFilter((current) => (current === item.tag ? null : item.tag))
                  }
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-[background-color,color,transform] duration-200 active:scale-[0.97]",
                    pressed
                      ? "border-transparent bg-foreground text-background"
                      : "border-[color:var(--glass-border)] bg-background/55 text-foreground hover:bg-background/85",
                  )}
                >
                  {item.tag}
                  <span
                    className={cn(
                      "tabular text-xs",
                      pressed ? "text-background/70" : "text-muted-foreground",
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ul className="space-y-2 px-1 pt-2">
        {days.map((day) => {
          const list = (byDate.get(day) ?? []).filter(
            (entry) => !activeTheme || shownEntryTags(entry).includes(activeTheme),
          );
          if ((guest || activeTheme) && list.length === 0) return null;
          const tone = list.find((entry) => entry.feelings.length > 0)?.feelings[0];
          const selected = day === selectedDay;
          return (
            <li
              key={day}
              id={`week-day-${day}`}
              className={cn(
                "scroll-mt-4 rounded-3xl px-4 py-4 transition-colors",
                selected ? "glass" : list.length === 0 && "opacity-50",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: tone ? feelingFill(tone) : "transparent", boxShadow: tone ? undefined : "inset 0 0 0 1.5px var(--border)" }}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    day === todayKey ? "text-foreground" : "text-foreground/85",
                  )}
                >
                  {formatDayLabel(day, locale)}
                </span>
                {day === todayKey && (
                  <span className="eyebrow rounded-full bg-primary/10 px-2 py-1 text-[0.6rem] text-accent-text">
                    {t("todayTitle")}
                  </span>
                )}
              </div>
              {list.length === 0 ? (
                <p className="mt-2 ps-[1.1rem] text-sm text-muted-foreground">{t("noEntry")}</p>
              ) : (
                <ul className="mt-3 space-y-4 border-s border-[color:var(--glass-border)] ps-5 ms-[0.2rem]">
                  {list.map((entry) => (
                    <li key={entry.id} className="space-y-1.5">
                      <p className="tabular text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">
                          {formatTime(entry.createdAt, locale)}
                        </span>
                        {entry.slot ? ` · ${slot(entry.slot)}` : ""}
                        {entry.feelings.length > 0
                          ? ` · ${entry.feelings.map((item) => feeling(item)).join(", ")}`
                          : ""}
                      </p>
                      {entry.body.trim() && (
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                          {entry.body}
                        </p>
                      )}
                      {shownEntryTags(entry).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {shownEntryTags(entry).map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() =>
                                setThemeFilter((current) => (current === tag ? null : tag))
                              }
                              className={cn(badgeVariants({ variant: "outline" }), "font-normal")}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function latestNotedDay(
  days: string[],
  byDate: Map<string, JournalEntry[]>,
  todayKey: string,
): string {
  const elapsed = days.filter((day) => day <= todayKey);
  for (let index = elapsed.length - 1; index >= 0; index -= 1) {
    const day = elapsed[index];
    if ((byDate.get(day) ?? []).length > 0) return day;
  }
  return todayKey;
}
