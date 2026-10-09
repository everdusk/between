"use client";

import { useMemo, useState } from "react";
import { FeelingPicker } from "@/components/feeling-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatLongDate, formatTime, toDateKey } from "@/lib/dates";
import { SLOT_LABELS } from "@/lib/feelings";
import { sanitizeTags, suggestTags } from "@/lib/tags";
import type { Feeling, JournalEntry } from "@/lib/types";

interface JournalPanelProps {
  entries: JournalEntry[];
  onSave: (input: {
    id?: string;
    date: string;
    body: string;
    feelings: Feeling[];
    tags: string[];
  }) => boolean;
  onDelete: (id: string) => boolean;
  disabled?: boolean;
}

export function JournalPanel({
  entries,
  onSave,
  onDelete,
  disabled,
}: JournalPanelProps) {
  const today = toDateKey();
  const [date, setDate] = useState(today);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feelings, setFeelings] = useState<Feeling[]>([]);
  const [body, setBody] = useState("");
  const [manual, setManual] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const dayEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.date === date)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [entries, date],
  );

  const tags = useMemo(() => {
    const auto = suggestTags(body).filter(
      (tag) => !dismissed.includes(tag) && !manual.includes(tag),
    );
    return sanitizeTags([...manual, ...auto]);
  }, [body, dismissed, manual]);

  function resetForm() {
    setEditingId(null);
    setFeelings([]);
    setBody("");
    setManual([]);
    setDismissed([]);
    setTagDraft("");
  }

  function startEdit(entry: JournalEntry) {
    const suggested = suggestTags(entry.body);
    setEditingId(entry.id);
    setFeelings(entry.feelings);
    setBody(entry.body);
    setManual(entry.tags.filter((tag) => !suggested.includes(tag)));
    setDismissed(suggested.filter((tag) => !entry.tags.includes(tag)));
    setTagDraft("");
  }

  function addManual(raw: string) {
    const [tag] = sanitizeTags([raw]);
    if (!tag) return;
    setManual((current) => (current.includes(tag) ? current : [...current, tag]));
    setDismissed((current) => current.filter((item) => item !== tag));
    setTagDraft("");
  }

  function removeTag(tag: string) {
    if (manual.includes(tag)) {
      setManual((current) => current.filter((item) => item !== tag));
      return;
    }
    setDismissed((current) => (current.includes(tag) ? current : [...current, tag]));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() && feelings.length === 0) return;
    const ok = onSave({
      id: editingId ?? undefined,
      date,
      body: body.trim(),
      feelings,
      tags,
    });
    if (ok) {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
      resetForm();
    }
  }

  const canSave = Boolean(body.trim() || feelings.length > 0);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
          Дневник дня
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
          За день можно оставить несколько заметок и отдельно отметить, как вы
          себя чувствуете. Темы подставятся из текста.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="journal-date">Дата</Label>
        <Input
          id="journal-date"
          type="date"
          value={date}
          max={today}
          disabled={disabled}
          onChange={(event) => {
            setDate(event.target.value);
            resetForm();
          }}
          required
          className="w-auto"
        />
        <p className="text-xs text-muted-foreground">{formatLongDate(date)}</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-display text-lg text-foreground">За этот день</h3>
        {dayEntries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
            Пока пусто. Ниже можно записать мысль или просто выбрать состояние.
          </p>
        ) : (
          <ul className="space-y-3">
            {dayEntries.map((entry) => {
              const checkin = entry.source === "checkin" || !entry.body.trim();
              return (
                <li
                  key={entry.id}
                  className="space-y-2 rounded-xl border border-border/60 bg-background/50 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatTime(entry.createdAt)}</span>
                    {entry.slot && <span>{SLOT_LABELS[entry.slot]}</span>}
                    {entry.source === "bot" && <span>из бота</span>}
                    {checkin && entry.source === "checkin" && <span>отметка</span>}
                  </div>
                  {entry.feelings.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {entry.feelings.map((feeling) => (
                        <Badge key={feeling} variant="secondary" className="font-normal">
                          {feeling}
                        </Badge>
                      ))}
                    </div>
                  )}
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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={disabled}
                      onClick={() => startEdit(entry)}
                    >
                      Править
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={disabled}
                      onClick={() => {
                        if (editingId === entry.id) resetForm();
                        onDelete(entry.id);
                      }}
                    >
                      Удалить
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 border-t border-border/70 pt-6">
        <div className="space-y-1">
          <h3 className="font-display text-lg text-foreground">
            {editingId ? "Править запись" : "Новая запись"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Текст и состояние можно сохранить по отдельности.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Как вы себя чувствуете</Label>
          <FeelingPicker value={feelings} onChange={setFeelings} disabled={disabled} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="journal-body">Заметка</Label>
          <Textarea
            id="journal-body"
            value={body}
            disabled={disabled}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Что сейчас занимает внимание?"
            className="min-h-32 resize-y"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="journal-tag">Темы</Label>
          <p className="text-xs text-muted-foreground">
            Совпадения из текста появляются сами. Лишние можно снять.
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  disabled={disabled}
                  onClick={() => removeTag(tag)}
                  className="rounded-full border border-border/80 bg-background/70 px-2.5 py-1 text-xs text-foreground"
                >
                  {tag}
                  <span className="ml-1.5 text-muted-foreground">убрать</span>
                </button>
              ))}
            </div>
          )}
          <Input
            id="journal-tag"
            value={tagDraft}
            disabled={disabled}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addManual(tagDraft);
              }
            }}
            onBlur={() => {
              if (tagDraft.trim()) addManual(tagDraft);
            }}
            placeholder="Своя тема — и Enter"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={disabled || !canSave}>
            {editingId ? "Обновить запись" : "Сохранить запись"}
          </Button>
          {editingId && (
            <Button type="button" variant="ghost" disabled={disabled} onClick={resetForm}>
              Отмена
            </Button>
          )}
          {savedFlash && (
            <span className="animate-in fade-in text-sm text-primary duration-500">
              Сохранено
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
