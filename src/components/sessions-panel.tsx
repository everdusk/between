"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatLongDate, toDateKey } from "@/lib/dates";
import type { SessionNote } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SessionsPanelProps {
  sessions: SessionNote[];
  onSave: (input: {
    id?: string;
    date: string;
    summary: string;
    insights: string;
    homework: string;
  }) => boolean;
  onDelete: (id: string) => boolean;
  disabled?: boolean;
}

const emptyForm = () => ({
  date: toDateKey(),
  summary: "",
  insights: "",
  homework: "",
});

export function SessionsPanel({
  sessions,
  onSave,
  onDelete,
  disabled,
}: SessionsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [savedFlash, setSavedFlash] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(
    sessions[0]?.id ?? null,
  );

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  function startNew() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function startEdit(session: SessionNote) {
    setEditingId(session.id);
    setForm({
      date: session.date,
      summary: session.summary,
      insights: session.insights,
      homework: session.homework,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = onSave({
      id: editingId ?? undefined,
      date: form.date,
      summary: form.summary.trim(),
      insights: form.insights.trim(),
      homework: form.homework.trim(),
    });
    if (ok) {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
      if (!editingId) startNew();
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
          Итоги сеанса
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
          После встречи зафиксируйте, что обсудили, какие инсайты остались и
          какие шаги взять с собой.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <Label htmlFor="session-date">Дата сеанса</Label>
            <Input
              id="session-date"
              type="date"
              value={form.date}
              max={toDateKey()}
              disabled={disabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, date: e.target.value }))
              }
              required
              className="w-auto"
            />
          </div>
          {editingId && (
            <Button type="button" variant="ghost" onClick={startNew}>
              Новая запись
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-summary">Что обсудили</Label>
          <Textarea
            id="session-summary"
            value={form.summary}
            disabled={disabled}
            onChange={(e) =>
              setForm((f) => ({ ...f, summary: e.target.value }))
            }
            placeholder="Кратко: темы разговора, ключевые моменты"
            className="min-h-24 resize-y"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-insights">Инсайты</Label>
          <Textarea
            id="session-insights"
            value={form.insights}
            disabled={disabled}
            onChange={(e) =>
              setForm((f) => ({ ...f, insights: e.target.value }))
            }
            placeholder="Что стало яснее, что зацепило"
            className="min-h-20 resize-y"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-homework">Домашка и следующие шаги</Label>
          <Textarea
            id="session-homework"
            value={form.homework}
            disabled={disabled}
            onChange={(e) =>
              setForm((f) => ({ ...f, homework: e.target.value }))
            }
            placeholder="Что попробовать до следующего сеанса"
            className="min-h-20 resize-y"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={disabled || !form.summary.trim()}
          >
            {editingId ? "Обновить итог" : "Сохранить итог"}
          </Button>
          {savedFlash && (
            <span className="animate-in fade-in text-sm text-primary duration-500">
              Сохранено
            </span>
          )}
        </div>
      </form>

      <Separator />

      <div className="space-y-4">
        <h3 className="font-display text-lg text-foreground">
          Прошлые сеансы
        </h3>
        {sorted.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
            Пока нет сохранённых итогов. После первого сеанса запись появится
            здесь.
          </p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((session) => {
              const open = expandedId === session.id;
              return (
                <li
                  key={session.id}
                  className="rounded-xl border border-border/60 bg-background/50"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                    onClick={() =>
                      setExpandedId(open ? null : session.id)
                    }
                    aria-expanded={open}
                  >
                    <span className="font-medium text-foreground">
                      {formatLongDate(session.date)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {open ? "Свернуть" : "Открыть"}
                    </span>
                  </button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-300 ease-out",
                      open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-3 border-t border-border/50 px-4 py-4 text-sm leading-relaxed">
                        <div>
                          <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                            Обсудили
                          </p>
                          <p className="whitespace-pre-wrap text-foreground/90">
                            {session.summary}
                          </p>
                        </div>
                        {session.insights && (
                          <div>
                            <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                              Инсайты
                            </p>
                            <p className="whitespace-pre-wrap text-foreground/90">
                              {session.insights}
                            </p>
                          </div>
                        )}
                        {session.homework && (
                          <div>
                            <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                              Дальше
                            </p>
                            <p className="whitespace-pre-wrap text-foreground/90">
                              {session.homework}
                            </p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={disabled}
                            onClick={() => startEdit(session)}
                          >
                            Редактировать
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={disabled}
                            onClick={() => onDelete(session.id)}
                          >
                            Удалить
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
