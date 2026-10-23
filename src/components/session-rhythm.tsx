"use client";

import { useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { ThemeDateInput } from "@/components/theme-date-input";
import { Label } from "@/components/ui/label";
import { formatLongDate, toDateKey, weekdayLong, weekdayShort } from "@/lib/dates";
import {
  isSessionTime,
  nextWeeklyOccurrence,
  onceSessionDate,
} from "@/lib/session-plan";
import type { NotifyPrefs, SessionPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SessionRhythmProps {
  plan: SessionPlan | null;
  notify: NotifyPrefs;
  onSavePlan: (plan: Omit<SessionPlan, "updatedAt">) => boolean;
  onSaveNotify: (prefs: Pick<NotifyPrefs, "moodPolls" | "eveningNudge">) => boolean;
  disabled?: boolean;
}

export function SessionRhythm(props: SessionRhythmProps) {
  return <SessionRhythmForm key={props.plan?.updatedAt ?? "new"} {...props} />;
}

const WEEKDAY_KEYS = [
  "2026-01-05",
  "2026-01-06",
  "2026-01-07",
  "2026-01-08",
  "2026-01-09",
  "2026-01-10",
  "2026-01-11",
];

function SessionRhythmForm({
  plan,
  notify,
  onSavePlan,
  onSaveNotify,
  disabled,
}: SessionRhythmProps) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<SessionPlan["mode"]>(plan?.mode ?? "weekly");
  const [date, setDate] = useState(plan?.date || toDateKey());
  const [time, setTime] = useState(plan?.time || "17:00");
  const [weekday, setWeekday] = useState(plan?.weekday ?? 3);
  const [savedFlash, setSavedFlash] = useState(false);
  const preview = plan ? planPreview(plan, locale, t) : t("noSchedule");

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!isSessionTime(time)) return;
    if (mode === "once" && !date) return;
    const ok = onSavePlan({ mode, date: mode === "once" ? date : "", time, weekday });
    if (ok) {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    }
  }

  return (
    <section className="space-y-5 border-b border-border/70 pb-6">
      <div className="space-y-1">
        <h3 className="font-display text-lg text-foreground">{t("whenSession")}</h3>
        <p className="text-sm text-muted-foreground">{preview}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={mode === "once" ? "default" : "outline"}
            disabled={disabled}
            onClick={() => setMode("once")}
          >
            {t("nextDate")}
          </Button>
          <Button
            type="button"
            variant={mode === "weekly" ? "default" : "outline"}
            disabled={disabled}
            onClick={() => setMode("weekly")}
          >
            {t("everyWeek")}
          </Button>
        </div>

        {mode === "once" ? (
          <div className="space-y-2">
            <Label htmlFor="plan-date">{t("date")}</Label>
            <ThemeDateInput
              id="plan-date"
              type="date"
              value={date}
              disabled={disabled}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>{t("day")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_KEYS.map((key, index) => (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  aria-pressed={weekday === index}
                  onClick={() => setWeekday(index)}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-sm",
                    weekday === index
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/80 bg-background/70",
                  )}
                >
                  {weekdayShort(key, locale)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="plan-time">{t("time")}</Label>
          <ThemeDateInput
            id="plan-time"
            type="time"
            value={time}
            disabled={disabled}
            onChange={(event) => setTime(event.target.value)}
            required
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={disabled || !isSessionTime(time)}>
            {t("saveSchedule")}
          </Button>
          {savedFlash && (
            <span className="text-sm text-primary">{t("saved")}</span>
          )}
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="font-display text-lg text-foreground">{t("botReminders")}</h3>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-1"
            checked={notify.moodPolls}
            disabled={disabled}
            onChange={(event) =>
              onSaveNotify({
                moodPolls: event.target.checked,
                eveningNudge: notify.eveningNudge,
              })
            }
          />
          {t("pollToggle")}
        </label>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-1"
            checked={notify.eveningNudge}
            disabled={disabled}
            onChange={(event) =>
              onSaveNotify({
                moodPolls: notify.moodPolls,
                eveningNudge: event.target.checked,
              })
            }
          />
          {t("nudgeToggle")}
        </label>
      </div>
    </section>
  );
}

function planPreview(
  plan: SessionPlan,
  locale: string,
  t: (key: "planOnceMissing" | "planOncePast" | "planOnceNext" | "planWeeklyMissing" | "planWeekly", vars?: Record<string, string>) => string,
): string {
  if (plan.mode === "once") {
    const at = onceSessionDate(plan);
    if (!at) return t("planOnceMissing");
    const when = `${formatLongDate(plan.date, locale)}, ${plan.time}`;
    if (at.getTime() < Date.now()) return t("planOncePast", { when });
    return t("planOnceNext", { when });
  }
  const next = nextWeeklyOccurrence(plan);
  if (!next) return t("planWeeklyMissing");
  return t("planWeekly", {
    day: weekdayLong(plan.weekday, locale),
    time: plan.time,
    date: formatLongDate(toDateKey(next), locale),
  });
}
