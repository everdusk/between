"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SessionPrepSummary } from "@/components/session-prep-summary";
import {
  formatDayLabel,
  formatTime,
  formatWeekRange,
  parseDateKey,
  toDateKey,
  trailingDateKeys,
  weekDayKeys,
  weekKey,
} from "@/lib/dates";
import {
  briefStamp,
  buildRuleBrief,
  entriesOnDates,
  feelingCounts,
  persistentTags,
  tagCounts,
} from "@/lib/brief";
import { SLOT_LABELS } from "@/lib/feelings";
import { requestBrief } from "@/lib/journal-api";
import type { JournalEntry, SessionNote, WeekPrep } from "@/lib/types";
import { cn } from "@/lib/utils";

function briefFailure(reason: string | undefined): string {
  if (reason === "limit") {
    return "На сегодня хватит запросов к модели. Ниже сборка по записям.";
  }
  if (reason === "no_model") {
    return "Ключ модели на сервер не попал. В Vercel нужна GEMINI_API_KEY или GROQ_API_KEY для Production.";
  }
  if (
    reason?.includes("gemini_400") ||
    reason?.includes("gemini_401") ||
    reason?.includes("gemini_403") ||
    reason?.includes("groq_401") ||
    reason?.includes("groq_403")
  ) {
    return "Сервер отклонил ключ модели. В Vercel для Production нужен ключ AI Studio (GEMINI_API_KEY) или Groq (GROQ_API_KEY), без кавычек.";
  }
  return `Модель не ответила${reason ? ` (${reason})` : ""}. Ниже сборка по записям.`;
}

interface WeeklyPanelProps {
  entries: JournalEntry[];
  sessions: SessionNote[];
  weekPreps: WeekPrep[];
  onSavePrep: (weekKey: string, talkNotes: string) => boolean;
  onSaveBrief: (
    weekKey: string,
    briefText: string,
    briefStamp: string,
    talkNotes: string,
  ) => boolean;
  initData?: string;
  disabled?: boolean;
}

export function WeeklyPanel({
  entries,
  sessions,
  weekPreps,
  onSavePrep,
  onSaveBrief,
  initData,
  disabled,
}: WeeklyPanelProps) {
  const now = new Date();
  const todayKey = toDateKey(now);
  const key = weekKey(now);
  const days = weekDayKeys(now);
  const prevDays = weekDayKeys(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
  );
  const prep = weekPreps.find((item) => item.weekKey === key);
  const [talkDraft, setTalkDraft] = useState<string | null>(null);
  const talkNotes = talkDraft ?? prep?.talkNotes ?? "";
  const [savedFlash, setSavedFlash] = useState(false);
  const [briefPhase, setBriefPhase] = useState<
    "idle" | "loading" | "local" | "plain" | "failed"
  >("idle");
  const [briefNote, setBriefNote] = useState<string | null>(null);

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
  const monthEntries = entriesOnDates(
    entries,
    trailingDateKeys(30, parseDateKey(todayKey)),
  );

  const weekFeelings = feelingCounts(weekEntries);
  const monthFeelings = feelingCounts(monthEntries);
  const weekTags = tagCounts(weekEntries);
  const carried = persistentTags(weekTags, tagCounts(prevEntries));
  const noteDays = days.filter((day) =>
    (byDate.get(day) ?? []).some((entry) => entry.body.trim()),
  ).length;
  const rules = buildRuleBrief({
    weekEntries,
    prevEntries,
    talkNotes,
  });
  const stamp = briefStamp(weekEntries, talkNotes);
  const modelText = prep?.briefStamp === stamp ? prep.briefText : undefined;

  function handleSave() {
    const ok = onSavePrep(key, talkNotes.trim());
    if (ok) {
      setTalkDraft(null);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    }
  }

  async function formulate() {
    setBriefPhase("loading");
    setBriefNote(null);
    if (!initData) {
      setBriefPhase("local");
      setBriefNote("Вне Telegram остаётся сборка по записям, без модели.");
      return;
    }
    const result = await requestBrief(initData, rules, stamp);
    if (!result.ok || !result.text) {
      setBriefPhase(result.ok ? "plain" : "failed");
      setBriefNote(
        result.ok
          ? briefFailure(result.reason)
          : "Не удалось сформулировать текст. Ниже сборка по записям.",
      );
      return;
    }
    onSaveBrief(key, result.text, stamp, talkNotes.trim());
    setTalkDraft(null);
    setBriefPhase("idle");
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

      <section className="space-y-3">
        <h3 className="font-display text-lg text-foreground">Бриф к сеансу</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {modelText || rules}
        </p>
        {modelText && (
          <p className="text-xs text-muted-foreground">Сформулировано по фактам недели.</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || briefPhase === "loading"}
            onClick={() => void formulate()}
          >
            {briefPhase === "loading" ? "Собираю текст…" : "Сформулировать текст"}
          </Button>
          {briefNote && (
            <p className="text-sm text-muted-foreground">{briefNote}</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg text-foreground">Тренды</h3>
        <p className="text-sm text-muted-foreground">
          Дней с заметками: {noteDays} из 7. Отметок и записей за неделю:{" "}
          {weekEntries.length}.
        </p>
        <FeelingLine title="Эта неделя" items={weekFeelings} />
        <FeelingLine title="30 дней" items={monthFeelings} />
        {carried.length > 0 && (
          <p className="text-sm text-foreground/90">
            С прошлой недели повторяется: {carried.join(", ")}.
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

      <ul className="space-y-0 divide-y divide-border/70">
        {days.map((day) => {
          const list = byDate.get(day) ?? [];
          return (
            <li
              key={day}
              className={cn(
                "grid gap-2 py-4 sm:grid-cols-[7.5rem_1fr] sm:gap-6",
                list.length === 0 && "opacity-55",
              )}
            >
              <div className="text-sm font-medium text-foreground">
                {formatDayLabel(day)}
              </div>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет записи</p>
              ) : (
                <ul className="space-y-3">
                  {list.map((entry) => (
                    <li key={entry.id} className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        {formatTime(entry.createdAt)}
                        {entry.slot ? ` · ${SLOT_LABELS[entry.slot]}` : ""}
                        {entry.feelings.length > 0
                          ? ` · ${entry.feelings.join(", ")}`
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
          onChange={(event) => setTalkDraft(event.target.value)}
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

function FeelingLine({
  title,
  items,
}: {
  title: string;
  items: { feeling: string; count: number }[];
}) {
  return (
    <p className="text-sm text-muted-foreground">
      {title}:{" "}
      {items.length === 0 ? (
        <span>пока нет отметок</span>
      ) : (
        <span className="text-foreground">
          {items
            .slice(0, 5)
            .map((item) => `${item.feeling} ×${item.count}`)
            .join(", ")}
        </span>
      )}
    </p>
  );
}
