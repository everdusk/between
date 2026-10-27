"use client";

import { useMemo, useRef, useState } from "react";
import { Bot, Check, Pencil, Trash2, X } from "lucide-react";
import { EntryCalendar } from "@/components/entry-calendar";
import { FeelingPicker } from "@/components/feeling-picker";
import { useI18n } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addDays, formatDayLabel, formatTime, toDateKey } from "@/lib/dates";
import { feelingFill } from "@/lib/spectrum";
import { isTherapyTheme, sanitizeTags, shownEntryTags, splitTags } from "@/lib/tags";
import type { Feeling, JournalEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface JournalPanelProps {
  entries: JournalEntry[];
  onSave: (input: {
    id?: string;
    date: string;
    body: string;
    feelings: Feeling[];
    tags: string[];
    themeHidden?: string[];
  }) => boolean;
  onDelete: (id: string) => boolean;
  disabled?: boolean;
}

/** First feeling of the day, or null when the notes carry no feeling. */
function dayMarks(entries: JournalEntry[]): Map<string, Feeling | null> {
  const marks = new Map<string, Feeling | null>();
  const sorted = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const entry of sorted) {
    const feeling = entry.feelings[0] ?? null;
    const current = marks.get(entry.date);
    if (current === undefined) marks.set(entry.date, feeling);
    else if (current === null && feeling) marks.set(entry.date, feeling);
  }
  return marks;
}

/** Days in a row with at least one note, ending today or yesterday. */
function noteStreak(entries: JournalEntry[], todayKey: string): number {
  const days = new Set(entries.map((entry) => entry.date));
  let cursor = days.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let streak = 0;
  while (days.has(cursor) && streak < 400) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function JournalPanel({
  entries,
  onSave,
  onDelete,
  disabled,
}: JournalPanelProps) {
  const { t, locale, count, feeling: feelingLabel, slot } = useI18n();
  const today = toDateKey();
  const [date, setDate] = useState(today);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feelings, setFeelings] = useState<Feeling[]>([]);
  const [body, setBody] = useState("");
  const [manual, setManual] = useState<string[]>([]);
  const [auto, setAuto] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const composerRef = useRef<HTMLElement | null>(null);

  const dayEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.date === date)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [entries, date],
  );
  const streak = useMemo(() => noteStreak(entries, today), [entries, today]);
  const marks = useMemo(() => dayMarks(entries), [entries]);

  const tags = sanitizeTags([...auto, ...manual]);

  function resetForm() {
    setEditingId(null);
    setFeelings([]);
    setBody("");
    setManual([]);
    setAuto([]);
    setHidden([]);
    setTagDraft("");
  }

  function startEdit(entry: JournalEntry) {
    const parts = splitTags(entry);
    setEditingId(entry.id);
    setFeelings(entry.feelings);
    setBody(entry.body);
    setManual(parts.user);
    setAuto(parts.auto);
    setHidden(parts.hidden);
    setTagDraft("");
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function addManual(raw: string) {
    const [tag] = sanitizeTags([raw]);
    if (!tag) return;
    setManual((current) => (current.includes(tag) ? current : [...current, tag]));
    setHidden((current) => current.filter((item) => item !== tag));
    setTagDraft("");
  }

  function removeTag(tag: string) {
    if (isTherapyTheme(tag)) {
      setHidden((current) => (current.includes(tag) ? current : [...current, tag]));
    }
    setAuto((current) => current.filter((item) => item !== tag));
    setManual((current) => current.filter((item) => item !== tag));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() && feelings.length === 0) return;
    const ok = onSave({
      id: editingId ?? undefined,
      date,
      body: body.trim(),
      feelings,
      tags: manual,
      themeHidden: hidden,
    });
    if (ok) {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
      resetForm();
    }
  }

  const canSave = Boolean(body.trim() || feelings.length > 0);
  const isToday = date === today;

  return (
    <div className="space-y-4">
      <section className="glass-strong relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-muted-foreground">
              {isToday ? t("todayTitle") : t("journalTitle")}
            </p>
            <h2 className="mt-3 font-display text-[2.125rem] leading-[1.05] tracking-tight text-foreground sm:text-[2.5rem]">
              {formatDayLabel(date, locale)}
            </h2>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <EntryCalendar
            id="journal-date"
            value={date}
            max={today}
            marks={marks}
            disabled={disabled}
            onChange={(next) => {
              setDate(next);
              resetForm();
            }}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <MiniStat phrase={count(dayEntries.length, "note")} caption={t("thisDay")} />
          {streak > 0 && (
            <MiniStat phrase={count(streak, "day")} caption={t("streakCaption")} />
          )}
        </div>
      </section>

      <section ref={composerRef} className="glass scroll-mt-4 rounded-3xl p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl tracking-tight text-foreground">
              {editingId ? t("editEntry") : t("newEntry")}
            </h3>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={resetForm}>
                <X aria-hidden />
                {t("cancel")}
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <Label>{t("howFeel")}</Label>
            <FeelingPicker value={feelings} onChange={setFeelings} disabled={disabled} />
          </div>

          <div className="space-y-3">
            <Label htmlFor="journal-body">{t("note")}</Label>
            <Textarea
              id="journal-body"
              value={body}
              disabled={disabled}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("notePlaceholder")}
              className="min-h-36 resize-none text-[0.9375rem]"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="journal-tag">{t("themes")}</Label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    disabled={disabled}
                    onClick={() => removeTag(tag)}
                    aria-label={`${tag} — ${t("remove")}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-background/55 pr-2.5 pl-3 text-xs text-foreground transition-colors hover:bg-background/85"
                  >
                    {tag}
                    <X aria-hidden className="size-3 opacity-50" />
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
              placeholder={t("tagPlaceholder")}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" size="lg" className="flex-1" disabled={disabled || !canSave}>
              {editingId ? t("updateEntry") : t("saveEntry")}
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

      <section className="space-y-3 px-1 pt-2">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h3 className="font-display text-xl tracking-tight text-foreground">{t("thisDay")}</h3>
          {dayEntries.length > 0 && (
            <span className="text-xs text-muted-foreground">{count(dayEntries.length, "note")}</span>
          )}
        </div>
        {dayEntries.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-[color:var(--glass-border)] px-5 py-6 text-center text-sm text-muted-foreground">
            {t("dayEmpty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {dayEntries.map((entry) => {
              const checkin = entry.source === "checkin" || !entry.body.trim();
              const tone = entry.feelings[0];
              const themes = shownEntryTags(entry);
              return (
                <li
                  key={entry.id}
                  className={cn(
                    "glass relative overflow-hidden rounded-3xl p-5 pl-6 transition-shadow",
                    editingId === entry.id && "ring-2 ring-primary/30",
                  )}
                >
                  {tone && (
                    <span
                      aria-hidden
                      className="absolute inset-y-5 start-0 w-1 rounded-e-full"
                      style={{ background: feelingFill(tone) }}
                    />
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="tabular flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {formatTime(entry.createdAt, locale)}
                      </span>
                      {entry.slot && <span>· {slot(entry.slot)}</span>}
                      {entry.source === "bot" && (
                        <span className="inline-flex items-center gap-1">
                          <Bot aria-hidden className="size-3" />
                          {t("fromBot")}
                        </span>
                      )}
                      {checkin && entry.source === "checkin" && <span>· {t("checkinMark")}</span>}
                    </div>
                    <div className="-mt-1.5 -me-2 flex shrink-0 items-center">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={disabled}
                        aria-label={t("edit")}
                        onClick={() => startEdit(entry)}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={disabled}
                        aria-label={t("delete")}
                        onClick={() => {
                          if (editingId === entry.id) resetForm();
                          onDelete(entry.id);
                        }}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>

                  {entry.feelings.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {entry.feelings.map((feeling) => (
                        <Badge key={feeling} variant="secondary" className="font-normal">
                          <span
                            aria-hidden
                            className="size-1.5 rounded-full"
                            style={{ background: feelingFill(feeling) }}
                          />
                          {feelingLabel(feeling)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {entry.body.trim() && (
                    <p className="mt-3 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-foreground/90">
                      {entry.body}
                    </p>
                  )}
                  {themes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {themes.map((tag) => (
                        <Badge key={tag} variant="outline" className="font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** "3 записи" split into a large number and the noun beneath it. */
function MiniStat({ phrase, caption }: { phrase: string; caption: string }) {
  const space = phrase.indexOf(" ");
  const value = space > 0 ? phrase.slice(0, space) : phrase;
  const noun = space > 0 ? phrase.slice(space + 1) : "";
  return (
    <div className="rounded-2xl bg-foreground/[0.04] px-4 py-3.5">
      <p className="tabular font-display text-2xl leading-none text-foreground">
        {value}
        {noun && <span className="ms-1.5 font-sans text-sm text-muted-foreground">{noun}</span>}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}
