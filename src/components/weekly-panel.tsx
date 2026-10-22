"use client";

import { useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SessionBacklog } from "@/components/session-backlog";
import { SessionPrepSummary } from "@/components/session-prep-summary";
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
  persistentTags,
  tagCounts,
} from "@/lib/brief";
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
  initData?: string;
  disabled?: boolean;
}

export function WeeklyPanel({
  entries,
  sessions,
  weekPreps,
  onSaveBrief,
  onSaveBacklog,
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

  const weekTags = tagCounts(weekEntries);
  const selectedDay =
    focusDay && days.includes(focusDay) ? focusDay : latestNotedDay(days, byDate, todayKey);
  const carried = persistentTags(weekTags, tagCounts(prevEntries));
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
      talkEmpty: t("briefTalkEmpty"),
      feeling,
      day: (key) => formatDayLabel(key, locale),
    },
  });
  const stamp = `${briefStamp(weekEntries, talkNotes)}:${locale}`;
  const modelText = prep?.briefStamp === stamp ? prep.briefText : undefined;

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

      {(carried.length > 0 || weekTags.length > 0) && (
        <section className="space-y-2">
          {carried.length > 0 && (
            <p className="text-sm text-foreground/90">
              {t("carried", { list: carried.join(", ") })}
            </p>
          )}
          {weekTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {weekTags.slice(0, 8).map((item) => (
                <Badge key={item.tag} className="font-normal">
                  {item.tag}
                  <span className="ml-1.5 text-primary-foreground/70">×{item.count}</span>
                </Badge>
              ))}
            </div>
          )}
        </section>
      )}

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

      <SessionPrepSummary entries={entries} sessions={sessions} />

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

      <ul className="space-y-2">
        {days.map((day) => {
          const list = byDate.get(day) ?? [];
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
                      {entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="font-normal">
                              {tag}
                            </Badge>
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
