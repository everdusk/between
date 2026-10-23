"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SessionBacklog } from "@/components/session-backlog";
import { WeekSpectrum } from "@/components/week-spectrum";
import {
  formatDateSpan,
  formatDayLabel,
  formatLongDate,
  formatTime,
  toDateKey,
  weekKey,
} from "@/lib/dates";
import { therapyWeekKey, therapyWindow } from "@/lib/session-summary";
import {
  briefStamp,
  buildRuleBrief,
  entriesOnDates,
  tagCounts,
} from "@/lib/brief";
import { parseModelThemes, shownEntryTags, themeContextChunks } from "@/lib/tags";
import { feelingFill } from "@/lib/spectrum";
import { requestBrief } from "@/lib/journal-api";
import type { BacklogItem, BacklogSource, JournalEntry, SessionNote, WeekPrep } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/messages";

function briefFailure(
  reason: string | undefined,
  t: (key: MessageKey, vars?: Record<string, string | number | undefined>) => string,
): string {
  if (reason === "limit") return t("briefLimit");
  if (reason === "no_model") return t("briefNoModel");
  if (
    reason?.includes("gemini_400") ||
    reason?.includes("gemini_401") ||
    reason?.includes("gemini_403") ||
    reason?.includes("groq_401") ||
    reason?.includes("groq_403")
  ) {
    return t("briefBadKey");
  }
  return t("briefPlain", { reason: reason ? ` (${reason})` : "" });
}

interface WeeklyPanelProps {
  entries: JournalEntry[];
  sessions: SessionNote[];
  weekPreps: WeekPrep[];
  onSaveBrief: (
    weekKey: string,
    briefText: string,
    briefStamp: string,
    talkNotes: string,
  ) => boolean;
  onSaveBacklog: (
    weekKey: string,
    backlog: BacklogItem[],
    backlogStamp: string,
    backlogSource: BacklogSource,
    backlogHidden: string[],
  ) => boolean;
  onSaveThemes: (
    updates: { id: string; updatedAt: string; themes: string[] }[],
    weekKey: string,
    themeStamp: string,
    themeSource: "model" | "rules",
  ) => boolean;
  initData?: string;
  disabled?: boolean;
}

export function WeeklyPanel({
  entries,
  sessions,
  weekPreps,
  onSaveBrief,
  onSaveBacklog,
  onSaveThemes,
  initData,
  disabled,
}: WeeklyPanelProps) {
  const { t, locale, feeling, slot } = useI18n();
  const now = new Date();
  const todayKey = toDateKey(now);
  const period = therapyWindow(sessions, entries, todayKey);
  const days = period.days;
  const prevDays = period.previousDays;
  const key = therapyWeekKey(period.last);
  const prep =
    weekPreps.find((item) => item.weekKey === key) ??
    weekPreps.find((item) => item.weekKey === weekKey(now));
  const talkNotes = prep?.talkNotes ?? "";
  const [briefPhase, setBriefPhase] = useState<
    "idle" | "loading" | "local" | "plain" | "failed"
  >("idle");
  const [briefNote, setBriefNote] = useState<string | null>(null);
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const [themeFilter, setThemeFilter] = useState<string | null>(null);

  const byDate = new Map<string, JournalEntry[]>();
  for (const day of days) byDate.set(day, []);
  for (const entry of entries) {
    const list = byDate.get(entry.date);
    if (list) list.push(entry);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const weekEntries = days.flatMap((day) => byDate.get(day) ?? []);
  const prevEntries = entriesOnDates(entries, prevDays);

  const weekTags = tagCounts(
    weekEntries.map((entry) => ({ ...entry, tags: shownEntryTags(entry) })),
  );
  const activeTheme = weekTags.some((item) => item.tag === themeFilter) ? themeFilter : null;
  const selectedDay =
    focusDay && days.includes(focusDay) ? focusDay : latestNotedDay(days, byDate, todayKey);
  const noteDays = days.filter((day) =>
    (byDate.get(day) ?? []).some((entry) => entry.body.trim()),
  ).length;
  const rules = buildRuleBrief({
    weekEntries,
    prevEntries,
    talkNotes,
    todayKey,
    copy: {
      empty: t("briefEmpty"),
      most: t("briefMost"),
      mostPast: t("briefMostPast"),
      past: t("briefPast"),
      themes: t("briefThemes"),
      carried: t("briefCarriedLine"),
      entries: t("briefEntries"),
      today: t("briefToday"),
      say: t("briefSay"),
      feeling,
      day: (key) => formatDayLabel(key, locale),
    },
  });
  const stamp = `${briefStamp(weekEntries, talkNotes)}:${locale}`;
  const modelText = prep?.briefStamp === stamp ? prep.briefText : undefined;
  const themeStamp = `t2:${briefStamp(
    weekEntries.filter((entry) => entry.body.trim()),
    "",
  )}`;
  const themesSettled = prep?.themeStamp === themeStamp && prep.themeSource === "model";
  const themeChunks = themeContextChunks(weekEntries, {
    todayKey,
    today: t("briefToday"),
    feeling,
    day: (day) => formatDayLabel(day, locale),
  });
  const themeChunkKey = themeChunks.join("\u0000");
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
    if (themesSettled || disabled || !initData || !themeChunkKey) return;
    if (themeAttempt.current === themeStamp) return;
    themeAttempt.current = themeStamp;
    let cancelled = false;
    void (async () => {
      const found = new Map<string, string[]>();
      const chunks = themeChunksRef.current;
      for (let index = 0; index < chunks.length; index += 1) {
        const result = await requestBrief(
          initData,
          chunks[index],
          `${themeStamp}:${index}`,
          locale,
          "themes",
        );
        if (cancelled) return;
        const parsed = result.ok && result.text != null ? parseModelThemes(result.text) : null;
        if (!parsed) return;
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
  }, [themesSettled, disabled, initData, themeChunkKey, themeStamp, locale, key, onSaveThemes]);

  async function formulate() {
    setBriefPhase("loading");
    setBriefNote(null);
    if (!initData) {
      setBriefPhase("local");
      setBriefNote(t("briefLocal"));
      return;
    }
    const result = await requestBrief(initData, rules, stamp, locale);
    if (!result.ok || !result.text) {
      setBriefPhase(result.ok ? "plain" : "failed");
      setBriefNote(
        result.ok ? briefFailure(result.reason, t) : t("briefFail"),
      );
      return;
    }
    onSaveBrief(key, result.text, stamp, talkNotes.trim());
    setBriefPhase("idle");
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
          {t("weekTitle")}
        </h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          {period.last && days.length === 0
            ? t("afterSessionLead", { date: formatLongDate(period.last.date, locale) })
            : t("weekLead", {
                range: formatDateSpan(days[0] ?? todayKey, days[days.length - 1] ?? todayKey, locale),
              })}
        </p>
      </div>

      <WeekSpectrum
        dayKeys={days}
        entries={weekEntries}
        todayKey={todayKey}
        selectedKey={selectedDay}
        onSelect={(day) => {
          setFocusDay(day);
          document.getElementById(`week-day-${day}`)?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }}
      />

      <SessionBacklog
        weekKey={key}
        weekEntries={weekEntries}
        prevEntries={prevEntries}
        talkNotes={talkNotes}
        todayKey={todayKey}
        prep={prep}
        initData={initData}
        disabled={disabled}
        onSave={onSaveBacklog}
      />

      <section className="space-y-3 rounded-3xl border border-border/60 bg-card/70 p-4 sm:p-5">
        <div className="space-y-1">
          <h3 className="font-display text-lg text-foreground">{t("briefTitle")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("briefStats", {
              days: noteDays,
              total: days.length,
              count: weekEntries.length,
            })}
          </p>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {modelText || rules}
        </p>
        {modelText && (
          <p className="text-xs text-muted-foreground">{t("briefModel")}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || briefPhase === "loading"}
            onClick={() => void formulate()}
          >
            {briefPhase === "loading" ? t("formulating") : t("formulate")}
          </Button>
          {briefNote && (
            <p className="text-sm text-muted-foreground">{briefNote}</p>
          )}
        </div>
      </section>

      {weekTags.length > 0 && (
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
                className={cn(badgeVariants({ variant: pressed ? "default" : "outline" }), "font-normal")}
              >
                {item.tag}
                <span className={cn("ml-1.5", pressed ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  ×{item.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <ul className="space-y-2">
        {days.map((day) => {
          const list = (byDate.get(day) ?? []).filter(
            (entry) => !activeTheme || shownEntryTags(entry).includes(activeTheme),
          );
          if (activeTheme && list.length === 0) return null;
          const tone = list.find((entry) => entry.feelings.length > 0)?.feelings[0];
          return (
            <li
              key={day}
              id={`week-day-${day}`}
              className={cn(
                "grid gap-2 rounded-2xl px-3 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-6",
                day === selectedDay
                  ? "bg-primary/10 ring-1 ring-primary/25"
                  : list.length === 0 && "opacity-55",
              )}
            >
              <div className="flex items-start gap-2 text-sm font-medium text-foreground">
                {tone && (
                  <span
                    aria-hidden
                    className="mt-1 size-2 shrink-0 rounded-full"
                    style={{ background: feelingFill(tone) }}
                  />
                )}
                <span>{formatDayLabel(day, locale)}</span>
              </div>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noEntry")}</p>
              ) : (
                <ul className="space-y-3">
                  {list.map((entry) => (
                    <li key={entry.id} className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        {formatTime(entry.createdAt, locale)}
                        {entry.slot ? ` · ${slot(entry.slot)}` : ""}
                        {entry.feelings.length > 0
                          ? ` · ${entry.feelings.map((item) => feeling(item)).join(", ")}`
                          : ""}
                      </p>
                      {entry.body.trim() && (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                          {entry.body}
                        </p>
                      )}
                      {shownEntryTags(entry).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
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
