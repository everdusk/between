"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoodScale } from "@/components/mood-scale";
import { formatLongDate, toDateKey } from "@/lib/dates";
import type { JournalEntry, MoodLevel } from "@/lib/types";

interface JournalPanelProps {
  entries: JournalEntry[];
  onSave: (input: {
    id?: string;
    date: string;
    mood: MoodLevel;
    body: string;
    tags: string[];
  }) => boolean;
  onDelete: (id: string) => boolean;
  disabled?: boolean;
}

function parseTags(raw: string): string[] {
  const parts = raw.split(/[,;]+/).map((t) => t.trim().toLowerCase());
  const unique: string[] = [];
  for (const tag of parts) {
    if (tag && !unique.includes(tag)) unique.push(tag);
  }
  return unique.slice(0, 8);
}

export function JournalPanel({
  entries,
  onSave,
  onDelete,
  disabled,
}: JournalPanelProps) {
  const today = toDateKey();
  const [date, setDate] = useState(today);
  const entry = entries.find((e) => e.date === date) ?? null;
  const [mood, setMood] = useState<MoodLevel>(3);
  const [body, setBody] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setMood(entry?.mood ?? 3);
    setBody(entry?.body ?? "");
    setTagsRaw(entry?.tags.join(", ") ?? "");
  }, [entry]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = onSave({
      id: entry?.id,
      date,
      mood,
      body: body.trim(),
      tags: parseTags(tagsRaw),
    });
    if (ok) {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    }
  }

  const isEmpty = !entry && !body.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
          Дневник дня
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
          Коротко зафиксируйте, как прошёл день — это станет основой для
          недельного обзора перед сеансом.
        </p>
      </div>

      {isEmpty && (
        <p className="rounded-lg border border-dashed border-border/80 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
          Пока нет записи на эту дату. Начните с настроения и пары предложений
          — достаточно честного черновика.
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="journal-date">Дата</Label>
          <Input
            id="journal-date"
            type="date"
            value={date}
            max={today}
            disabled={disabled}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            {formatLongDate(date)}
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Настроение</Label>
          <MoodScale value={mood} onChange={setMood} disabled={disabled} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="journal-body">Мысли и переживания</Label>
        <Textarea
          id="journal-body"
          value={body}
          disabled={disabled}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Что сегодня занимало внимание? Что хотелось бы запомнить к сеансу?"
          className="min-h-36 resize-y"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="journal-tags">Темы и теги</Label>
        <Input
          id="journal-tags"
          value={tagsRaw}
          disabled={disabled}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="работа, сон, отношения — через запятую"
        />
        {parseTags(tagsRaw).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {parseTags(tagsRaw).map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={disabled || !body.trim()}>
          {entry ? "Обновить запись" : "Сохранить запись"}
        </Button>
        {entry && (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => onDelete(entry.id)}
          >
            Удалить
          </Button>
        )}
        {savedFlash && (
          <span className="animate-in fade-in text-sm text-primary duration-500">
            Сохранено
          </span>
        )}
      </div>
    </form>
  );
}
