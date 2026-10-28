"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { badgeVariants } from "@/components/ui/badge";
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
import { entryInWindow, therapyWindow } from "@/lib/session-summary";
import { briefStamp, tagCounts } from "@/lib/brief";
import { parseModelThemes, shownEntryTags, themeContextChunks } from "@/lib/tags";
import { feelingFill } from "@/lib/spectrum";
import { requestBrief } from "@/lib/journal-api";
import {
  clipPattern,
  patternFacts,
  patternKey,
  patternShouldRequest,
  pendingJudgeEntries,
  rankedThemes,
} from "@/lib/themes";
import type { JournalEntry, SessionNote, SessionPlan, SessionTheme, ThemeLink, WeekPrep } from "@/lib/types";
import { cn } from "@/lib/utils";

const themeGaveUp = new Set<string>();
const patternGaveUp = new Set<string>();

interface WeeklyPanelProps {
  entries: JournalEntry[];
  sessions: SessionNote[];
  plan: SessionPlan | null;
  weekPreps: WeekPrep[];
  themes: SessionTheme[];
  themeLinks: ThemeLink[];
  judgeSettled: string[];
  onDiscussTheme: (id: string, discussed: boolean) => void;
  onDismissTheme: (id: string) => void;
  onAddTheme: (title: string) => void;
  onSavePattern: (weekKey: string, patternText: string, patternStamp: string) => boolean;
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
  plan,
  weekPreps,
  themes,
  themeLinks,
  judgeSettled,
  onDiscussTheme,
  onDismissTheme,
  onAddTheme,
  onSavePattern,
  onSaveThemes,
  initData,
  disabled,
}: WeeklyPanelProps) {
  const { t, locale, feeling, slot, count } = useI18n();
  const [now, setNow] = useState(() => new Date());
  const todayKey = toDateKey(now);
  const period = therapyWindow(sessions, entries, todayKey, now, plan);
  const days = period.days;
  const key = period.weekKey;
  const boundaryAt = period.endsAt?.getTime() ?? null;
  useEffect(() => {
    if (boundaryAt === null) return;
    const delay = boundaryAt - Date.now() + 1000;
    if (delay <= 0 || delay > 8 * 24 * 60 * 60 * 1000) return;
    const timer = window.setTimeout(() => setNow(new Date()), delay);
    return () => window.clearTimeout(timer);
  }, [boundaryAt]);
  const prep =
    weekPreps.find((item) => item.weekKey === key) ??
    weekPreps.find((item) => item.weekKey === weekKey(now));
  const [focusDay, setFocusDay] = useState<string | null>(null);
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
    focusDay && days.includes(focusDay) ? focusDay : latestNotedDay(days, byDate, todayKey);
  const noteDays = days.filter((day) =>
    (byDate.get(day) ?? []).some((entry) => entry.body.trim()),
  ).length;
  const sessionDates = sessions.map((session) => session.date);
  const agenda = rankedThemes(themes, todayKey, sessionDates);
  const said = themes
    .filter((theme) => theme.status === "discussed" && !theme.dismissed)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || a.title.localeCompare(b.title));
  const patternStamp = patternKey(agenda, locale);
  const patternFactText = patternFacts(agenda);
  const patternBody = prep?.patternText ? clipPattern(0, prep.patternText) : "";
  const judging = pendingJudgeEntries(weekEntries, judgeSettled, days).length > 0;
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
    if (themeGaveUp.has(themeStamp)) return;
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
        if (!parsed) {
          themeGaveUp.add(themeStamp);
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
  }, [themesSettled, disabled, initData, themeChunkKey, themeStamp, locale, key, onSaveThemes]);

  const patternAttempt = useRef<string | null>(null);
  const savedPatternStamp = prep?.patternStamp;
  const savedPatternText = prep?.patternText ?? "";
  useEffect(() => {
    if (
      !patternShouldRequest({
        hasInitData: Boolean(initData),
        disabled: Boolean(disabled),
        judging,
        themeCount: agenda.length,
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
      const result = await requestBrief(initData as string, facts, patternStamp, locale, "pattern");
      if (cancelled) return;
      if (!result.ok || !result.text) {
        patternGaveUp.add(patternStamp);
        return;
      }
      onSavePattern(key, clipPattern(0, result.text), patternStamp);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    agenda.length,
    disabled,
    initData,
    judging,
    key,
    locale,
    onSavePattern,
    patternFactText,
    patternStamp,
    savedPatternStamp,
    savedPatternText,
  ]);

  const notesPhrase = count(weekEntries.length, "note");
  const notesSpace = notesPhrase.indexOf(" ");

  return (
    <div className="space-y-4">
      <div className="space-y-2 px-2 pt-1 pb-1">
        <p className="eyebrow text-section-header">{t("weekTitle")}</p>
        <h2 className="font-display text-[2.125rem] leading-[1.05] tracking-tight text-foreground sm:text-[2.5rem]">
          {period.last && days.length === 0
            ? t("afterSessionLead", { date: formatLongDate(period.last.date, locale) })
            : t("weekLead", {
                range: formatDateSpan(days[0] ?? todayKey, days[days.length - 1] ?? todayKey, locale),
              })}
        </h2>
      </div>

      <WeekSpectrum
        dayKeys={days}
        entries={weekEntries}
        todayKey={todayKey}
        patternTitle={t("briefPatternTitle")}
        patternText={patternBody}
        patternPending={
          patternBody
            ? ""
            : judging
              ? t("backlogRefreshing")
              : patternShouldRequest({
                    hasInitData: Boolean(initData),
                    disabled: Boolean(disabled),
                    judging: false,
                    themeCount: agenda.length,
                    savedStamp: savedPatternStamp,
                    stamp: patternStamp,
                    savedText: savedPatternText,
                    gaveUp: patternGaveUp.has(patternStamp),
                    inFlight: false,
                  })
                ? t("formulating")
                : ""
        }
      />

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

      <SessionBacklog
        themes={[...agenda, ...said]}
        entries={entries}
        links={themeLinks}
        refreshing={Boolean(initData) && judging}
        disabled={disabled}
        onDiscuss={onDiscussTheme}
        onDismiss={onDismissTheme}
        onAdd={onAddTheme}
        onOpenNote={setFocusDay}
      />

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
          if (activeTheme && list.length === 0) return null;
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
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
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
