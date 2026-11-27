"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, LockKeyhole, Pencil, Trash2, X } from "lucide-react";
import { DateNavigation } from "@/components/date-navigation";
import { EntryCalendar } from "@/components/entry-calendar";
import { FeelingPicker } from "@/components/feeling-picker";
import { FeelingStripe } from "@/components/feeling-stripe";
import { useI18n } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trackAnalytics } from "@/lib/analytics-client";
import { addDays, formatDayLabel, formatTime, toDateKey } from "@/lib/dates";
import { feelingFill } from "@/lib/spectrum";
import { shownEntryTags, splitTags } from "@/lib/tags";
import type { Feeling, JournalEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

import { introEntryBody, introTranscript, type LegacyIntroRecord, type IntroRecord } from "@/lib/intro-record";

interface JournalPanelProps {
  inMessenger?: boolean;
  pilotTopics?: {themes: import("@/lib/types").SessionTheme[]; links: import("@/lib/types").ThemeLink[]; open:(id:string)=>void};
  initialDate?: string;
  introductions?: IntroRecord[];
  firstRecord?: LegacyIntroRecord | null;
  onFirstSaved?: () => void;
  hint?: React.ReactNode;
  guest?: boolean;
  onReflect?: (id: string) => void;
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
  initData?: string;
  webFirst?: boolean;
  composeRequest?: number;
}

/** The stored day, plus the local day the note was actually written. */
function daysOf(entry: JournalEntry): string[] {
  const days = [entry.date];
  const time = Date.parse(entry.createdAt);
  if (Number.isFinite(time)) {
    const local = toDateKey(new Date(time));
    if (local !== entry.date) days.push(local);
  }
  return days;
}

/** First feeling of the day, or null when the notes carry no feeling. */
function dayMarks(entries: JournalEntry[]): Map<string, Feeling | null> {
  const marks = new Map<string, Feeling | null>();
  const sorted = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const entry of sorted) {
    const feeling = entry.feelings[0] ?? null;
    for (const day of daysOf(entry)) {
      const current = marks.get(day);
      if (current === undefined) marks.set(day, feeling);
      else if (current === null && feeling) marks.set(day, feeling);
    }
  }
  return marks;
}

export function JournalPanel({
  inMessenger,
  hint, onReflect, guest, pilotTopics,
  entries,
  onSave,
  onDelete,
  disabled,
  initData = "",
  webFirst = false,
  introductions, firstRecord, onFirstSaved, initialDate,
  composeRequest = 0,
}: JournalPanelProps) {
  const { t, locale, feeling: feelingLabel, slot } = useI18n();
  const today = toDateKey();
  const latestDay = entries.reduce((latest, entry) =>
    entry.date <= today && entry.date > latest ? entry.date : latest, "");
  // Follow the imported or latest entry until the reader chooses another day.
  const [pickedDay, setDate] = useState<string | null>(null);
  const date = pickedDay ?? (initialDate || latestDay || today);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feelings, setFeelings] = useState<Feeling[]>([]);
  const [body, setBody] = useState("");
  const [manual, setManual] = useState<string[]>([]);
  const composerOpen = Boolean(editingId || firstRecord);
  const [hidden, setHidden] = useState<string[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const composerRef = useRef<HTMLElement | null>(null);
  const [lastComposeRequest, setLastComposeRequest] = useState(0);
  if (composeRequest !== lastComposeRequest) {
    setLastComposeRequest(composeRequest);
    if (editingId) {
      setEditingId(null);
      setManual([]);
      setHidden([]);
      setFeelings([]);
      setBody("");
    }
    if (!firstRecord && (editingId || (!body.trim() && !feelings.length))) setDate(today);
  }
  // On an auth return the splash can still hide the editor when it mounts.
  useEffect(() => {
    const field = composerRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    if (!composeRequest || disabled || !field) return;
    function focusWhenVisible() {
      if (!field?.getClientRects().length) return;
      observer.disconnect();
      field.focus({preventScroll:true});
      field.scrollIntoView({block:"nearest"});
    }
    const observer = new ResizeObserver(focusWhenVisible);
    observer.observe(field);
    focusWhenVisible();
    return () => observer.disconnect();
  }, [composeRequest,composerOpen,disabled]);

  const dayEntries = useMemo(
    () =>
      entries
        .filter((entry) => daysOf(entry).includes(date))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [entries, date],
  );
  const marks = useMemo(() => dayMarks(entries), [entries]);

  function resetForm() {
    onFirstSaved?.();
    setEditingId(null);
    setFeelings([]);
    setBody("");
    setManual([]);

    setHidden([]);
  }

  function startEdit(entry: JournalEntry) {
    onFirstSaved?.();
    const parts = splitTags(entry);
    setEditingId(entry.id);
    setFeelings(entry.feelings);
    setBody(entry.body);
    setManual(parts.user);

    setDate(entry.date);
    setHidden(parts.hidden);
    requestAnimationFrame(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() && (firstRecord || feelings.length === 0)) return;
    const ok = onSave({
      id: editingId ?? (firstRecord ? "intro-answer-"+firstRecord.attempt : undefined),
      date,
      body: firstRecord && !editingId ? introEntryBody(firstRecord, body.trim()) : body.trim(),
      feelings,
      tags: manual,
      themeHidden: hidden,
    });
    if (ok) {
      if (!editingId && !guest) trackAnalytics("note", initData);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
      resetForm();
    }
  }

  function changeDate(next: string) {
    setDate(next);
    setSavedFlash(false);
    resetForm();
  }

  const canSave = Boolean(body.trim() || (!firstRecord && feelings.length > 0));
  function saveOnCtrlEnter(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || !event.ctrlKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!event.repeat && !disabled && canSave) event.currentTarget.form?.requestSubmit();
  }

  const isToday = date === today;
  const dayNavigation = (
    <DateNavigation
      previous={{ label: t("journalPrevDay"), disabled, onClick: () => changeDate(addDays(date, -1)) }}
      next={{ label: t("journalNextDay"), disabled: disabled || isToday, onClick: () => changeDate(addDays(date, 1)) }}
      action={<EntryCalendar id="journal-date" value={date} max={today} marks={marks} disabled={disabled} onChange={changeDate} />}
    >
      <time dateTime={date}>{isToday ? t("todayTitle") : formatDayLabel(date, locale)}</time>
    </DateNavigation>
  );
  return (
    <div className="journal-board flex flex-col gap-4">
      <header className={inMessenger ? "sr-only" : undefined}>
        <h1 className="mb-4 font-display text-2xl leading-[1.15] tracking-[-.035em] sm:text-3xl">{t("deskEntries")}</h1>
        {!inMessenger && dayNavigation}
      </header>
      <span className="sr-only" role="status">{savedFlash ? t("saved") : ""}</span>

      {!composerOpen && <GlassPanel ref={composerRef} className="space-y-3 p-4">
        <form onSubmit={handleSubmit}>
          <FeelingPicker value={feelings} onChange={setFeelings} disabled={disabled}>
            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] text-base *:col-start-1 *:row-start-1 *:border *:p-3 *:whitespace-pre-wrap *:[overflow-wrap:anywhere]">
              {/* Size older WebViews by the wrapped text, including a trailing newline. */}
              <span aria-hidden="true" className="invisible pointer-events-none supports-[field-sizing:content]:hidden">{body}{"\u200b"}</span>
              <textarea
                rows={1}
                className="field-sizing-content w-full min-w-0 resize-none overflow-hidden rounded-xl border-input bg-background"
                aria-label={t("newEntry")}
                placeholder={t("notePlaceholder")}
                value={body}
                onChange={event => setBody(event.target.value)}
                onKeyDown={saveOnCtrlEnter}
                disabled={disabled}
              />
            </div>
            <Button type="submit" size="icon" aria-label={t("saveEntry")} disabled={disabled || !canSave}><Check/></Button>
          </FeelingPicker>
        </form>
      </GlassPanel>}
      {composerOpen && <GlassPanel ref={composerRef} className="scroll-mt-4 p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl tracking-tight text-foreground">
              {editingId ? t("editEntry") : t("newEntry")}
            </h3>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={resetForm}>
              <X aria-hidden />
              {t("cancel")}
            </Button>
          </div>

          <div className="space-y-3">
            {firstRecord && <p className="text-sm">{firstRecord.observation}</p>}
            <Label htmlFor="journal-body" className={firstRecord ? "font-normal leading-relaxed" : undefined}>{firstRecord?.prompt ?? t("note")}</Label>
            <FeelingPicker value={feelings} onChange={setFeelings} disabled={disabled}>
            <Textarea
              id="journal-body"
              autoFocus={!webFirst}
              value={body}
              disabled={disabled}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={saveOnCtrlEnter}
              placeholder={t("notePlaceholder")}
              className="min-h-28 min-w-0 flex-1 resize-none text-[0.9375rem]"
            />
            </FeelingPicker>
          </div>


          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" size="lg" className="flex-1" disabled={disabled || !canSave}>
              {editingId ? t("updateEntry") : t("saveEntry")}
            </Button>
          </div>
        </form>
      </GlassPanel>}

      {hint}
      {inMessenger && dayNavigation}
      <section className="px-1">
        {dayEntries.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-[color:var(--glass-border)] px-5 py-6 text-center text-sm text-muted-foreground">
            {t("dayEmpty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {dayEntries.map((entry) => {
              const linked = pilotTopics?.themes.filter(theme=>theme.quotes.some(q=>q.entryId===entry.id) ||
                pilotTopics.links.some(l=>l.entryId===entry.id && l.themeId===theme.id)) ?? [];
              const checkin = !entry.body.trim();
              const tone = entry.feelings[0];
              const themes = shownEntryTags(entry);
              const intro = introductions?.find(r => entry.id === "intro-answer-"+r.attempt);
              const transcript = intro && intro.kind !== "checkin" && introTranscript(intro);
              const divider = transcript ? "\n\n"+transcript.history+"\n\n" : "";
              const cut = divider ? entry.body.lastIndexOf(divider) : -1;
              const visibleBody = cut < 0 ? entry.body : entry.body.slice(0, cut);
              return (
                <li
                  key={entry.id}
                  className={cn(
                    "glass relative overflow-hidden rounded-3xl px-6 py-5 transition-shadow",
                    editingId === entry.id && "ring-2 ring-primary/30",
                    savedFlash && entry.id === dayEntries[0]?.id && "entry-arrive",
                    checkin && "border-s-4 !bg-secondary/60 !py-3",
                  )}
                >
                  {tone && <FeelingStripe feeling={tone} className="inset-y-5" />}
                  <div className="flex items-center justify-between gap-3">
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
                    <div className="flex shrink-0 items-center gap-1.5">
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
                  {!checkin && entry.body.trim() && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-foreground/90">
                      {visibleBody}
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
                  {linked.map(theme=><Button key={theme.id} className="mt-2 max-w-full whitespace-normal" variant="ghost" size="sm" onClick={()=>pilotTopics?.open(theme.id)}>{theme.title}</Button>)}
                  {!linked.length && !checkin && entry.body.trim() && onReflect && <Button className="mt-2" variant="ghost" size="sm" onClick={()=>onReflect(entry.id)}>{guest && <LockKeyhole aria-hidden />}{t("deskReflection")}</Button>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
