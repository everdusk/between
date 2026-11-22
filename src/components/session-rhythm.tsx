"use client";

import { useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { EntryCalendar } from "@/components/entry-calendar";
import { TimePicker } from "@/components/time-picker";
import { Label } from "@/components/ui/label";
import { toDateKey, weekdayName, weekdayShort } from "@/lib/dates";
import { weeklySlots } from "@/lib/session-plan";
import type { SessionPlan, SessionSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SessionRhythmProps {
  plan: SessionPlan | null;
  onSavePlan: (plan: Omit<SessionPlan, "updatedAt">) => boolean;
  disabled?: boolean;
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

export function SessionRhythm({
  plan,
  onSavePlan,
  disabled,
}: SessionRhythmProps) {
  const { t, locale } = useI18n();
  const [saveFailed, setSaveFailed] = useState(false);
  const mode = plan?.mode ?? "weekly";
  const date = plan?.date || toDateKey();
  const time = plan?.time || "17:00";
  const slots = plan ? weeklySlots({ ...plan, mode: "weekly" }) : [];
  function saveOnce(nextDate: string, nextTime: string) {
    setSaveFailed(!onSavePlan({ mode: "once", date: nextDate, time: nextTime, slots, weekday: slots[0]?.weekday ?? 3 }));
  }

  function saveWeekly(nextSlots: SessionSlot[]) {
    const [first] = nextSlots;
    if (!first) return;
    setSaveFailed(!onSavePlan({ mode: "weekly", date: "", ...first, slots: nextSlots }));
  }

  function toggleDay(weekday: number) {
    const next = slots.some(slot => slot.weekday === weekday)
      ? slots.filter(slot => slot.weekday !== weekday)
      : [...slots, { weekday, time: "17:00" }].sort((a, b) => a.weekday - b.weekday);
    saveWeekly(next);
  }

  return (
      <section className="glass space-y-5 rounded-3xl p-5 sm:p-6">
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
                onClick={() => {
                  if (item === mode) return;
                  if (item === "once") saveOnce(date, time);
                  else saveWeekly(slots);
                }}
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
              <EntryCalendar
                id="plan-date"
                showDate
                value={date}
                disabled={disabled}
                onChange={next => saveOnce(next, time)}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div role="group" aria-label={t("day")} className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_KEYS.map((key, index) => {
                  const on = slots.some((slot) => slot.weekday === index);
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled || (on && slots.length === 1)}
                      title={on && slots.length === 1 ? t("planWeeklyMissing") : undefined}
                      aria-pressed={on}
                      aria-label={weekdayName(index, locale)}
                      onClick={() => toggleDay(index)}
                      className={cn(
                        "session-weekday h-11 rounded-2xl border text-sm font-medium capitalize transition-[background-color,color,transform] duration-200 active:scale-[0.96] focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none",
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
                    <div key={slot.weekday} className="flex items-center justify-end gap-3">
                      {slots.length > 1 && <span className="me-auto text-sm capitalize text-foreground">
                        {weekdayName(slot.weekday, locale)}
                      </span>}
                      <TimePicker
                        id={`plan-time-${slot.weekday}`}
                        value={slot.time}
                        disabled={disabled}
                        label={`${t("time")} ${weekdayName(slot.weekday, locale)}`}
                        onChange={time => saveWeekly(slots.map(item => item.weekday === slot.weekday ? { ...item, time } : item))}
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
              <TimePicker
                id="plan-time"
                label={t("time")}
                value={time}
                disabled={disabled}
                onChange={next => saveOnce(date, next)}
              />
            </div>
          )}

          {saveFailed && <p role="alert" className="text-sm text-destructive">{t("storageWrite")}</p>}
      </section>

  );
}
