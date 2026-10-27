"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
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
import { briefStamp, tagCounts } from "@/lib/brief";
import { parseModelThemes, shownEntryTags, themeContextChunks } from "@/lib/tags";
import { feelingFill } from "@/lib/spectrum";
import { requestBrief } from "@/lib/journal-api";
import {
  buildSessionBrief,
  clipPattern,
  patternFacts,
  patternKey,
  pendingJudgeEntries,
  rankedThemes,
  type BriefCopy,
} from "@/lib/themes";
import type { JournalEntry, SessionNote, SessionTheme, ThemeLink, WeekPrep } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/messages";

const themeGaveUp = new Set<string>();
const patternGaveUp = new Set<string>();

function briefFailure(
  reason: string | undefined,
  t: (key: MessageKey, vars?: Record<string, string | number | undefined>) => string,
): string {
  if (reason === "limit") return t("briefLimit");
  if (reason === "no_model") return t("briefNoModel");
  if (reason?.includes("aitunnel_key_shape")) return t("briefTunnelKey");
  if (reason?.includes("aitunnel_403")) {
    const marker = "aitunnel_403:";
    const at = reason.indexOf(marker);
    const note = at >= 0 ? reason.slice(at + marker.length).trim() : "";
    return note ? `${t("briefTunnelForbidden")} ${note}` : t("briefTunnelForbidden");
  }
  if (reason?.includes("aitunnel_401")) return t("briefTunnelRejected");
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
  const now = new Date();
  const todayKey = toDateKey(now);
  const period = therapyWindow(sessions, entries, todayKey);
  const days = period.days;
  const key = therapyWeekKey(period.last);
  const prep =
    weekPreps.find((item) => item.weekKey === key) ??
    weekPreps.find((item) => item.weekKey === weekKey(now));
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
  const briefCopy: BriefCopy = {
    header: t("briefHeader"),
    headerOpen: t("briefHeaderOpen"),
    moodUp: t("moodUp"),
    moodDown: t("moodDown"),
    moodFlat: t("moodFlat"),
    anomaly: t("briefAnomaly"),
    discussed: t("briefDiscussedTitle"),
    returned: t("briefReturned"),
    mark: {
      new: t("themeNew"),
      returned: t("themeBack"),
      week2: t("themeWeek2"),
      week3: t("themeWeek3"),
    },
  };
  const agenda = rankedThemes(themes, todayKey, sessionDates);
  const said = themes
    .filter((theme) => theme.status === "discussed" && !theme.dismissed)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || a.title.localeCompare(b.title));
  const sessionBrief = buildSessionBrief({
    themes,
    entries: weekEntries,
    sessionDates,
    lastSession: period.last,
    todayKey,
    copy: briefCopy,
    dayLabel: (date) => formatDayLabel(date, locale),
    longDate: (date) => formatLongDate(date, locale),
    feelingLabel: feeling,
    entryPhrase: (amount) => count(amount, "note"),
    dayPhrase: (amount) => count(amount, "day"),
  });
  const patternStamp = patternKey(agenda, locale);
  const patternText =
    prep?.patternStamp === patternStamp ? clipPattern(sessionBrief.words, prep.patternText ?? "") : "";
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
  useEffect(() => {
    if (!initData || disabled || agenda.length === 0 || prep?.patternStamp === patternStamp) return;
    if (patternGaveUp.has(patternStamp)) return;
    if (patternAttempt.current === patternStamp) return;
    patternAttempt.current = patternStamp;
    let cancelled = false;
    void (async () => {
      const result = await requestBrief(
        initData,
        patternFacts(agenda),
        patternStamp,
        locale,
        "pattern",
      );
      if (cancelled) return;
      if (!result.ok || !result.text) {
        patternGaveUp.add(patternStamp);
        return;
      }
      onSavePattern(key, clipPattern(sessionBrief.words, result.text), patternStamp);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    agenda,
    disabled,
    initData,
    key,
    locale,
    onSavePattern,
    patternStamp,
    prep?.patternStamp,
    sessionBrief.words,
  ]);

  async function formulate() {
    setBriefPhase("loading");
    setBriefNote(null);
    if (!initData) {
      setBriefPhase("local");
      setBriefNote(t("briefLocal"));
      return;
    }
    if (agenda.length === 0) {
      setBriefPhase("idle");
      return;
    }
    const result = await requestBrief(initData, patternFacts(agenda), patternStamp, locale, "pattern");
    if (!result.ok || !result.text) {
      setBriefPhase(result.ok ? "plain" : "failed");
      setBriefNote(result.ok ? briefFailure(result.reason, t) : t("briefFail"));
      return;
    }
    onSavePattern(key, clipPattern(sessionBrief.words, result.text), patternStamp);
    setBriefPhase("idle");
  }

  const notesPhrase = count(weekEntries.length, "note");
  const notesSpace = notesPhrase.indexOf(" ");

  return (
    <div className="space-y-4">
      <div className="space-y-2 px-2 pt-1 pb-1">
        <p className="eyebrow text-muted-foreground">{t("weekTitle")}</p>
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
        selectedKey={selectedDay}
        onSelect={(day) => {
          setFocusDay(day);
          document.getElementById(`week-day-${day}`)?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }}
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

      <section className="ink relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -end-20 size-56 rounded-full bg-ink-foreground/[0.06] blur-2xl"
        />
        <div className="relative space-y-4">
          <div className="space-y-1.5">
            <p className="eyebrow text-ink-muted">{t("briefTitle")}</p>
            <p className="text-sm text-ink-muted">
              {t("briefStats", {
                days: noteDays,
                total: days.length,
                count: weekEntries.length,
              })}
            </p>
          </div>
          <div className="space-y-4 text-[0.9375rem] leading-relaxed text-ink-foreground/95">
            <p>{sessionBrief.header}</p>
            {sessionBrief.mood && <p>{sessionBrief.mood}</p>}
            {sessionBrief.anomalies.map((item) => (
              <p key={item.date}>{t("briefAnomaly", { day: item.label, themes: item.themes })}</p>
            ))}
            {sessionBrief.themes.map((theme) => (
              <div key={theme.id} className="space-y-1.5">
                <p>
                  {theme.title}
                  <span className="text-ink-muted">
                    {" "}
                    · ×{theme.count}
                    {theme.peak ? ` · ${theme.peak}` : ""} · {briefCopy.mark[theme.mark]}
                  </span>
                </p>
                {theme.quotes.map((quote) => (
                  <button
                    key={`${quote.entryId}:${quote.text}`}
                    type="button"
                    className="block text-start text-ink-foreground/80 underline-offset-4 hover:underline"
                    onClick={() => {
                      setFocusDay(quote.date);
                      document.getElementById(`week-day-${quote.date}`)?.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                      });
                    }}
                  >
                    {formatDayLabel(quote.date, locale)}: {quote.text}
                  </button>
                ))}
              </div>
            ))}
            {sessionBrief.discussed.length > 0 && (
              <div className="space-y-1">
                <p className="text-ink-muted">{t("briefDiscussedTitle")}</p>
                {sessionBrief.discussed.map((item) => (
                  <p key={item.id}>
                    {item.title}
                    {item.reopened ? ` — ${t("briefReturned")}` : ""}
                  </p>
                ))}
              </div>
            )}
            {patternText && (
              <div className="space-y-1">
                <p className="text-ink-muted">{t("briefPatternTitle")}</p>
                <p>{patternText}</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="bg-ink-foreground/12 text-ink-foreground hover:bg-ink-foreground/20"
              disabled={disabled || briefPhase === "loading"}
              onClick={() => void formulate()}
            >
              <Sparkles aria-hidden />
              {briefPhase === "loading" ? t("formulating") : t("formulate")}
            </Button>
            {briefNote && <p className="text-sm text-ink-muted">{briefNote}</p>}
          </div>
        </div>
      </section>

      {weekTags.length > 0 && (
        <div className="space-y-3 px-2 pt-3">
          <p className="eyebrow text-muted-foreground">{t("themes")}</p>
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
                  <span className="eyebrow rounded-full bg-primary/10 px-2 py-1 text-[0.6rem] text-primary">
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
