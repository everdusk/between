"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toDateKey } from "@/lib/dates";
import {
  describeSessionPlan,
  isSessionTime,
  WEEKDAY_SHORT,
} from "@/lib/session-plan";
import { DEFAULT_TIME_ZONE, type NotifyPrefs, type SessionPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SessionRhythmProps {
  plan: SessionPlan | null;
  notify: NotifyPrefs;
  onSavePlan: (plan: Omit<SessionPlan, "updatedAt">) => boolean;
  onSaveNotify: (prefs: Pick<NotifyPrefs, "moodPolls" | "eveningNudge">) => boolean;
  disabled?: boolean;
}

function deviceZoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function SessionRhythm(props: SessionRhythmProps) {
  return <SessionRhythmForm key={props.plan?.updatedAt ?? "new"} {...props} />;
}

function SessionRhythmForm({
  plan,
  notify,
  onSavePlan,
  onSaveNotify,
  disabled,
}: SessionRhythmProps) {
  const [mode, setMode] = useState<SessionPlan["mode"]>(plan?.mode ?? "weekly");
  const [date, setDate] = useState(plan?.date || toDateKey());
  const [time, setTime] = useState(plan?.time || "17:00");
  const [weekday, setWeekday] = useState(plan?.weekday ?? 3);
  const [savedFlash, setSavedFlash] = useState(false);
  const zone = deviceZoneLabel();
  const preview = plan ? describeSessionPlan(plan) : "Расписание ещё не задано.";

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
        <h3 className="font-display text-lg text-foreground">Когда сеанс</h3>
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
            Ближайшая дата
          </Button>
          <Button
            type="button"
            variant={mode === "weekly" ? "default" : "outline"}
            disabled={disabled}
            onClick={() => setMode("weekly")}
          >
            Каждую неделю
          </Button>
        </div>

        {mode === "once" ? (
          <div className="space-y-2">
            <Label htmlFor="plan-date">Дата</Label>
            <Input
              id="plan-date"
              type="date"
              value={date}
              disabled={disabled}
              onChange={(event) => setDate(event.target.value)}
              required
              className="w-auto"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>День</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_SHORT.map((label, index) => (
                <button
                  key={label}
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
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="plan-time">Время</Label>
          <Input
            id="plan-time"
            type="time"
            value={time}
            disabled={disabled}
            onChange={(event) => setTime(event.target.value)}
            required
            className="w-auto"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={disabled || !isSessionTime(time)}>
            Сохранить расписание
          </Button>
          {savedFlash && (
            <span className="text-sm text-primary">Сохранено</span>
          )}
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="font-display text-lg text-foreground">Напоминания бота</h3>
        <p className="text-sm text-muted-foreground">
          Опросы в 9:00, 14:00 и 18:00. В 21:00 — вопрос, если за день не было
          заметки. Часовой пояс телефона: {zone}. Пока приложение не открывали,
          бот считает время по {DEFAULT_TIME_ZONE}.
        </p>
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
          Спрашивать самочувствие три раза в день
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
          В 21:00 спросить, есть ли чем поделиться
        </label>
      </div>
    </section>
  );
}
