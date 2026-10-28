"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { ThemeDateInput } from "@/components/theme-date-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatLongDate, toDateKey, weekdayLong, weekdayName, weekdayShort } from "@/lib/dates";
import {
  clockLabel,
  isSessionTime,
  nextWeeklyOccurrence,
  onceSessionDate,
  weeklySlots,
} from "@/lib/session-plan";
import type { NotifyPrefs, SessionPlan, SessionSlot } from "@/lib/types";
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
  const [slots, setSlots] = useState<SessionSlot[]>(() => editorSlots(plan));
  const [savedFlash, setSavedFlash] = useState(false);
  const preview = plan ? planPreview(plan, locale, t) : t("noSchedule");
  const weeklyReady = slots.length > 0 && slots.every((slot) => isSessionTime(slot.time));

  function toggleDay(weekday: number) {
    setSlots((current) => {
      if (current.some((slot) => slot.weekday === weekday)) {
        return current.filter((slot) => slot.weekday !== weekday);
      }
      return [...current, { weekday, time: "17:00" }].sort((a, b) => a.weekday - b.weekday);
    });
  }

  function setSlotTime(weekday: number, next: string) {
    setSlots((current) =>
      current.map((slot) => (slot.weekday === weekday ? { ...slot, time: next || slot.time } : slot)),
    );
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "once") {
      if (!isSessionTime(time) || !date) return;
      const ok = onSavePlan({
        mode,
        date,
        time,
        weekday: slots[0]?.weekday ?? plan?.weekday ?? 3,
        slots,
      });
      if (ok) flash();
      return;
    }
    if (!weeklyReady) return;
    const ordered = [...slots].sort((a, b) => a.weekday - b.weekday);
    const ok = onSavePlan({
      mode,
      date: "",
      time: ordered[0].time,
      weekday: ordered[0].weekday,
      slots: ordered,
    });
    if (ok) flash();
  }

  function flash() {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  }

  return (
    <>
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="space-y-1.5">
          <h3 className="font-display text-xl tracking-tight text-foreground">{t("whenSession")}</h3>
          <p className="text-sm text-muted-foreground">{preview}</p>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-5">
          <div
            role="radiogroup"
            aria-label={t("whenSession")}
            className="grid grid-cols-2 gap-1 rounded-full bg-foreground/[0.06] p-1"
          >
            {(["once", "weekly"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={mode === item}
                disabled={disabled}
                onClick={() => setMode(item)}
                className={cn(
                  "h-9 rounded-full text-sm font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none",
                  mode === item
                    ? "bg-card text-foreground shadow-[0_1px_2px_oklch(0_0_0_/_0.06)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item === "once" ? t("nextDate") : t("everyWeek")}
              </button>
            ))}
          </div>

          {mode === "once" ? (
            <div className="space-y-3">
              <Label htmlFor="plan-date">{t("date")}</Label>
              <ThemeDateInput
                id="plan-date"
                type="date"
                display={formatLongDate(date, locale)}
                value={date}
                disabled={disabled}
                onChange={(event) => {
                  if (event.target.value) setDate(event.target.value);
                }}
                required
              />
            </div>
          ) : (
            <div className="space-y-3">
              <Label>{t("day")}</Label>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_KEYS.map((key, index) => {
                  const on = slots.some((slot) => slot.weekday === index);
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      aria-pressed={on}
                      aria-label={weekdayName(index, locale)}
                      onClick={() => toggleDay(index)}
                      className={cn(
                        "h-11 rounded-2xl border text-sm font-medium capitalize transition-[background-color,color,transform] duration-200 active:scale-[0.96] focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none",
                        on
                          ? "border-transparent bg-foreground text-background shadow-[0_10px_24px_-14px_var(--foreground)]"
                          : "border-[color:var(--glass-border)] bg-background/55 text-foreground hover:bg-background/85",
                      )}
                    >
                      {weekdayShort(key, locale)}
                    </button>
                  );
                })}
              </div>
              {slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("planWeeklyMissing")}</p>
              ) : (
                <div className="space-y-2">
                  {slots.map((slot) => (
                    <div key={slot.weekday} className="flex items-center justify-between gap-3">
                      <span className="text-sm capitalize text-foreground">
                        {weekdayName(slot.weekday, locale)}
                      </span>
                      <ThemeDateInput
                        id={`plan-time-${slot.weekday}`}
                        type="time"
                        display={slot.time}
                        value={slot.time}
                        disabled={disabled}
                        aria-label={`${t("time")} ${weekdayName(slot.weekday, locale)}`}
                        onChange={(event) => {
                          if (event.target.value) setSlotTime(slot.weekday, event.target.value);
                        }}
                        required
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === "once" && (
            <div className="space-y-3">
              <Label htmlFor="plan-time">{t("time")}</Label>
              <ThemeDateInput
                id="plan-time"
                type="time"
                display={time}
                value={time}
                disabled={disabled}
                onChange={(event) => {
                  if (event.target.value) setTime(event.target.value);
                }}
                required
              />
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="submit"
              variant="secondary"
              disabled={disabled || (mode === "once" ? !isSessionTime(time) : !weeklyReady)}
            >
              {t("saveSchedule")}
            </Button>
            {savedFlash && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary animate-in fade-in zoom-in-95 duration-300">
                <Check aria-hidden className="size-4" />
                {t("saved")}
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="glass rounded-3xl p-5 sm:p-6">
        <h3 className="font-display text-xl tracking-tight text-foreground">{t("botReminders")}</h3>
        <div className="mt-3 divide-y divide-[color:var(--glass-border)]">
          <Switch
            className="py-3.5"
            label={t("pollToggle")}
            checked={notify.moodPolls}
            disabled={disabled}
            onChange={(event) =>
              onSaveNotify({
                moodPolls: event.target.checked,
                eveningNudge: notify.eveningNudge,
              })
            }
          />
          <Switch
            className="py-3.5"
            label={t("nudgeToggle")}
            checked={notify.eveningNudge}
            disabled={disabled}
            onChange={(event) =>
              onSaveNotify({
                moodPolls: notify.moodPolls,
                eveningNudge: event.target.checked,
              })
            }
          />
        </div>
      </section>
    </>
  );
}

function planPreview(
  plan: SessionPlan,
  locale: string,
  t: (
    key: "planOnceMissing" | "planOncePast" | "planOnceNext" | "planWeeklyMissing" | "planWeekly" | "planSlot",
    vars?: Record<string, string>,
  ) => string,
): string {
  if (plan.mode === "once") {
    const at = onceSessionDate(plan);
    if (!at) return t("planOnceMissing");
    const when = `${formatLongDate(plan.date, locale)}, ${plan.time}`;
    if (at.getTime() < Date.now()) return t("planOncePast", { when });
    return t("planOnceNext", { when });
  }
  const chosen = weeklySlots(plan);
  const next = nextWeeklyOccurrence(plan);
  if (chosen.length === 0 || !next) return t("planWeeklyMissing");
  return t("planWeekly", {
    days: chosen
      .map((slot) => t("planSlot", { day: weekdayLong(slot.weekday, locale), time: slot.time }))
      .join(", "),
    date: `${formatLongDate(toDateKey(next), locale)}, ${clockLabel(next)}`,
  });
}

function editorSlots(plan: SessionPlan | null): SessionSlot[] {
  if (!plan) return [{ weekday: 3, time: "17:00" }];
  const saved = weeklySlots({ ...plan, mode: "weekly" });
  if (saved.length > 0) return saved;
  const weekday = plan.weekday >= 0 && plan.weekday <= 6 ? plan.weekday : 3;
  return [{ weekday, time: isSessionTime(plan.time) ? plan.time : "17:00" }];
}
