"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayLabel, formatLongDate } from "@/lib/dates";
import { buildPeriodSummary } from "@/lib/session-summary";
import type { JournalEntry, SessionNote } from "@/lib/types";

interface SessionPrepSummaryProps {
  entries: JournalEntry[];
  sessions: SessionNote[];
}

export function SessionPrepSummary({
  entries,
  sessions,
}: SessionPrepSummaryProps) {
  const summary = useMemo(
    () => buildPeriodSummary(entries, sessions),
    [entries, sessions],
  );
  const [open, setOpen] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  if (!summary) {
    return (
      <section className="space-y-2 border-b border-border/70 pb-6">
        <h3 className="font-display text-lg text-foreground">
          С последнего сеанса
        </h3>
        <p className="rounded-lg border border-dashed border-border/80 bg-background/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          Пока нет сохранённых сеансов. Зафиксируйте итог во вкладке «Сеансы» —
          здесь появится сводка записей после этой даты.
        </p>
      </section>
    );
  }

  const sessionLabel = formatLongDate(summary.lastSession.date);

  if (summary.entryCount === 0) {
    return (
      <section className="space-y-2 border-b border-border/70 pb-6">
        <h3 className="font-display text-lg text-foreground">
          С последнего сеанса
        </h3>
        <p className="text-sm text-muted-foreground">
          После сеанса от {sessionLabel} новых записей в дневнике пока нет.
          Пишите в «Дневник» или боту — сводка соберётся здесь к следующей
          встрече.
        </p>
      </section>
    );
  }

  async function handleCopy() {
    if (!summary) return;
    const text = summary.plainText;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setCopyState(ok ? "ok" : "fail");
    window.setTimeout(() => setCopyState("idle"), 2000);
  }

  return (
    <section className="space-y-3 border-b border-border/70 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-display text-lg text-foreground">
            С последнего сеанса
          </h3>
          <p className="text-sm text-muted-foreground">
            Записи после {sessionLabel} — к подготовке к встрече.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Свернуть" : "Открыть"}
        </Button>
      </div>

      {open && (
        <div className="animate-in fade-in slide-in-from-top-1 space-y-4 duration-300">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span>
              Записей:{" "}
              <strong className="font-medium text-foreground">
                {summary.entryCount}
              </strong>
            </span>
            {summary.avgMood !== null && (
              <span>
                Среднее настроение:{" "}
                <strong className="font-medium text-foreground">
                  {summary.avgMood.toFixed(1)}
                </strong>
              </span>
            )}
          </div>

          {summary.moodTrend === "up" && (
            <p className="text-sm text-foreground/90">
              Настроение к концу периода в среднем выше, чем в начале.
            </p>
          )}
          {summary.moodTrend === "down" && (
            <p className="text-sm text-foreground/90">
              Настроение к концу периода в среднем ниже, чем в начале.
            </p>
          )}
          {summary.moodTrend === "flat" && (
            <p className="text-sm text-muted-foreground">
              Настроение за период без явного сдвига вверх или вниз.
            </p>
          )}

          {summary.themes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Темы
              </p>
              <ul className="flex flex-wrap gap-2">
                {summary.themes.map(({ tag, count }) => (
                  <li key={tag}>
                    <Badge variant="outline" className="font-normal">
                      {tag}
                      {count > 1 && (
                        <span className="ml-1.5 text-muted-foreground">
                          ×{count}
                        </span>
                      )}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Ключевые моменты
            </p>
            <ul className="space-y-0 divide-y divide-border/70">
              {summary.highlights.map((h) => (
                <li key={h.date} className="space-y-1.5 py-3">
                  <p className="text-sm font-medium text-foreground">
                    {formatDayLabel(h.date)}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {h.moodLabel}
                    </span>
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {h.excerpt}
                  </p>
                </li>
              ))}
            </ul>
            {summary.entryCount > summary.highlights.length && (
              <p className="text-xs text-muted-foreground">
                Показаны {summary.highlights.length} из {summary.entryCount}{" "}
                дней — крайние по настроению и крайние по дате.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-w-[12.5rem]"
              onClick={handleCopy}
              aria-live="polite"
            >
              {copyState === "ok"
                ? "Скопировано"
                : copyState === "fail"
                  ? "Не удалось скопировать"
                  : "Скопировать сводку"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
