"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDayLabel,
  formatWeekRange,
  weekDayKeys,
  weekKey,
} from "@/lib/dates";
import { SessionPrepSummary } from "@/components/session-prep-summary";
import {
  MOOD_LABELS,
  type JournalEntry,
  type SessionNote,
  type WeekPrep,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface WeeklyPanelProps {
  entries: JournalEntry[];
  sessions: SessionNote[];
  weekPreps: WeekPrep[];
  onSavePrep: (weekKey: string, talkNotes: string) => boolean;
  disabled?: boolean;
}

export function WeeklyPanel({
  entries,
  sessions,
  weekPreps,
  onSavePrep,
  disabled,
}: WeeklyPanelProps) {
  const now = new Date();
  const key = weekKey(now);
  const days = weekDayKeys(now);
  const prep = weekPreps.find((w) => w.weekKey === key);
  const [talkNotes, setTalkNotes] = useState(prep?.talkNotes ?? "");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setTalkNotes(prep?.talkNotes ?? "");
  }, [prep?.talkNotes]);

  const byDate = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    for (const e of entries) {
      if (days.includes(e.date)) map.set(e.date, e);
    }
    return map;
  }, [entries, days]);

  const weekEntries = days
    .map((d) => byDate.get(d))
    .filter((e): e is JournalEntry => Boolean(e));

  const themes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of weekEntries) {
      for (const tag of e.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
      .slice(0, 10);
  }, [weekEntries]);

  const recurring = themes.filter(([, n]) => n >= 2);
  const avgMood =
    weekEntries.length > 0
      ? weekEntries.reduce((s, e) => s + e.mood, 0) / weekEntries.length
      : null;

  function handleSave() {
    const ok = onSavePrep(key, talkNotes.trim());
    if (ok) {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
          Недельный обзор
        </h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          Неделя {formatWeekRange(now)} — сводка перед сеансом.
        </p>
      </div>

      <SessionPrepSummary entries={entries} sessions={sessions} />

      {weekEntries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
          За эту неделю записей ещё нет. Заполните дневник в течение дней —
          здесь появится картина недели и повторяющиеся темы.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span>
              Записей:{" "}
              <strong className="font-medium text-foreground">
                {weekEntries.length} из 7
              </strong>
            </span>
            {avgMood !== null && (
              <span>
                Среднее настроение:{" "}
                <strong className="font-medium text-foreground">
                  {avgMood.toFixed(1)}
                </strong>
              </span>
            )}
          </div>

          <ul className="space-y-0 divide-y divide-border/70">
            {days.map((day) => {
              const entry = byDate.get(day);
              return (
                <li
                  key={day}
                  className={cn(
                    "grid gap-2 py-4 sm:grid-cols-[7.5rem_1fr] sm:gap-6",
                    !entry && "opacity-55",
                  )}
                >
                  <div className="text-sm font-medium text-foreground">
                    {formatDayLabel(day)}
                  </div>
                  {entry ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Настроение:{" "}
                        <span className="text-foreground">
                          {MOOD_LABELS[entry.mood]}
                        </span>
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                        {entry.body}
                      </p>
                      {entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.tags.map((t) => (
                            <Badge
                              key={t}
                              variant="outline"
                              className="font-normal"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Нет записи</p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="space-y-3">
            <h3 className="font-display text-lg text-foreground">
              Повторяющиеся темы
            </h3>
            {recurring.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Пока нет тем, которые встречались больше одного раза. Добавьте
                одинаковые теги в дневнике — они соберутся здесь.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {recurring.map(([tag, count]) => (
                  <li key={tag}>
                    <Badge className="font-normal">
                      {tag}
                      <span className="ml-1.5 text-primary-foreground/70">
                        ×{count}
                      </span>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {themes.length > 0 && recurring.length < themes.length && (
              <p className="text-xs text-muted-foreground">
                Также упоминались:{" "}
                {themes
                  .filter(([, n]) => n < 2)
                  .map(([t]) => t)
                  .join(", ")}
              </p>
            )}
          </div>
        </>
      )}

      <div className="space-y-3 border-t border-border/70 pt-6">
        <div className="space-y-1">
          <Label htmlFor="talk-notes" className="font-display text-lg">
            Говорить на сеансе
          </Label>
          <p className="text-sm text-muted-foreground">
            Черновик того, что важно вынести на встречу. Можно править в любой
            момент недели.
          </p>
        </div>
        <Textarea
          id="talk-notes"
          value={talkNotes}
          disabled={disabled}
          onChange={(e) => setTalkNotes(e.target.value)}
          placeholder="Например: тревога перед дедлайнами, разговор с мамой, ощущение «я не справляюсь»…"
          className="min-h-28 resize-y"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={disabled} onClick={handleSave}>
            Сохранить заметку
          </Button>
          {savedFlash && (
            <span className="animate-in fade-in text-sm text-primary duration-500">
              Сохранено
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
