"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, Pencil, Trash2, X, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { EntryCalendar } from "@/components/entry-calendar";
import { FeelingPicker } from "@/components/feeling-picker";
import { useI18n } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trackAnalytics } from "@/lib/analytics-client";
import { addDays, formatTime, toDateKey } from "@/lib/dates";
import { feelingFill } from "@/lib/spectrum";
import { shownEntryTags, splitTags } from "@/lib/tags";
import { PICKER_FEELINGS, type Feeling, type JournalEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface JournalPanelProps {
  hint?: React.ReactNode;
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

export function MoodDialog({onSave,onClose}:{onSave:JournalPanelProps["onSave"];onClose:()=>void}) {
  const {t}=useI18n();
  const [selected,setSelected]=useState<Feeling[]>([]);
  const [body,setBody]=useState("");
  return <dialog ref={el=>{if(el&&!el.open)el.showModal()}} aria-label={t("howFeel")} onCancel={onClose} className="m-auto w-[min(92vw,30rem)] max-h-[85dvh] rounded-3xl border border-border bg-popover p-5 text-foreground backdrop:bg-black/50">
    <form className="space-y-4" onSubmit={e=>{e.preventDefault();if(selected.length && onSave({date:toDateKey(),feelings:selected,body:body.trim(),tags:[]}))onClose()}}>
      <div className="flex items-center justify-between"><h2 className="font-display text-xl">{t("howFeel")}</h2><Button type="button" variant="ghost" size="icon" aria-label={t("cancel")} onClick={onClose}><X/></Button></div>
      <FeelingPicker initiallyOpen value={selected} onChange={setSelected}/>
      <label className="block">{t("note")}<Textarea value={body} placeholder={t("notePlaceholder")} onChange={e=>setBody(e.target.value)}/></label>
      <Button type="submit" disabled={!selected.length}>{t("feelingDone")}</Button>
    </form></dialog>;
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
  hint, onReflect,
  entries,
  onSave,
  onDelete,
  disabled,
  initData = "",
  webFirst = false,
  composeRequest = 0,
}: JournalPanelProps) {
  const { t, locale, count, feeling: feelingLabel, slot } = useI18n();
  const today = toDateKey();
  const [date, setDate] = useState(today);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query,setQuery]=useState("");
  const [allDates,setAllDates]=useState(false);
  const [filter,setFilter]=useState("");
  const [feelings, setFeelings] = useState<Feeling[]>([]);
  const [body, setBody] = useState("");
  const [manual, setManual] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(webFirst);
  const [hidden, setHidden] = useState<string[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const composerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!composeRequest) return;
    // Keep any draft intact when the global action brings the editor back.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComposerOpen(true);
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true });
    });
  }, [composeRequest]);

  const dayEntries = useMemo(
    () =>
      entries
        .filter((entry) => (allDates || daysOf(entry).includes(date)) &&
          (!filter || entry.feelings.some(f=>f===filter)) &&
          (!query.trim() || [entry.body,...entry.tags,...entry.feelings.map(feelingLabel)].join(" ").toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale))))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [entries, date, allDates, filter, query, feelingLabel, locale],
  );
  const marks = useMemo(() => dayMarks(entries), [entries]);

  function resetForm() {
    setEditingId(null);
    setFeelings([]);
    setBody("");
    setManual([]);
    setComposerOpen(webFirst);
    setHidden([]);
  }

  function startEdit(entry: JournalEntry) {
    const parts = splitTags(entry);
    setEditingId(entry.id);
    setFeelings(entry.feelings);
    setBody(entry.body);
    setManual(parts.user);
    setComposerOpen(true);
    setDate(entry.date);
    setHidden(parts.hidden);
    requestAnimationFrame(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
      if (!editingId) trackAnalytics("note", initData);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
      resetForm();
    }
  }

  function changeDate(next: string) {
    setAllDates(false);
    setDate(next);
    setSavedFlash(false);
    resetForm();
  }

  const canSave = Boolean(body.trim() || feelings.length > 0);
  const isToday = date === today;
  function quickSave(emotion?: Feeling) {
    const text = emotion ? "" : body.trim();
    if ((!emotion && !text) || !onSave({ date, body: text, feelings: emotion ? [emotion] : [], tags: [] })) return;
    if (!emotion) setBody("");
    trackAnalytics("note", initData);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  }

  return (
    <div className="journal-board flex flex-col gap-4">
      <section className="glass-strong rounded-3xl px-4 py-4 sm:px-5">
        <div className="flex min-h-7 items-center justify-between px-1">
          <p className="eyebrow text-section-header">{isToday ? t("todayTitle") : t("journalTitle")}</p>
          {!isToday && <Button type="button" variant="ghost" size="xs" disabled={disabled} onClick={() => changeDate(today)}>{t("todayTitle")}</Button>}
        </div>
        <div className="mt-1 flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label={t("journalPrevDay")} disabled={disabled} onClick={() => changeDate(addDays(date, -1))}>
            <ChevronLeft aria-hidden className="rtl:scale-x-[-1]" />
          </Button>
          <EntryCalendar id="journal-date" value={date} max={today} marks={marks} disabled={disabled} compact onChange={changeDate} />
          <Button type="button" variant="ghost" size="icon" aria-label={t("journalNextDay")} disabled={disabled || isToday} onClick={() => changeDate(addDays(date, 1))}>
            <ChevronRight aria-hidden className="rtl:scale-x-[-1]" />
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[color:var(--glass-border)] px-1 pt-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {savedFlash ? <span className="inline-flex items-center gap-1.5 text-primary"><Check aria-hidden className="size-3.5" />{t("saved")}</span> : count(dayEntries.length, "note")}
          </span>
          {!composerOpen && <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => { resetForm(); setComposerOpen(true); }}><Plus aria-hidden />{t("newEntry")}</Button>}
        </div>
      </section>

      {!composerOpen && <section className="glass space-y-3 rounded-3xl p-4">
        <form className="flex items-center gap-2" onSubmit={e=>{e.preventDefault();quickSave()}}>
          <input className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-3 text-base" aria-label={t("newEntry")} placeholder={t("notePlaceholder")} value={body} onChange={e=>setBody(e.target.value)} disabled={disabled}/>
          <Button type="submit" size="icon" aria-label={t("saveEntry")} disabled={disabled || !body.trim()}><Check/></Button>
        </form>
        <FeelingPicker value={[]} immediate onChange={v=>quickSave(v[0])} disabled={disabled}/>
      </section>}
      {composerOpen && <section ref={composerRef} className="glass scroll-mt-4 rounded-3xl p-5 sm:p-6">
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
            <Label htmlFor="journal-body">{t("note")}</Label>
            <Textarea
              id="journal-body"
              autoFocus={!webFirst}
              value={body}
              disabled={disabled}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("notePlaceholder")}
              className="min-h-28 resize-none text-[0.9375rem]"
            />
          </div>

          <FeelingPicker value={feelings} onChange={setFeelings} disabled={disabled} />

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" size="lg" className="flex-1" disabled={disabled || !canSave}>
              {editingId ? t("updateEntry") : t("saveEntry")}
            </Button>
          </div>
        </form>
      </section>}

      {hint}
      <section className="space-y-3 px-1 pt-2">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h3 className="font-display text-xl tracking-tight text-foreground">{t(allDates?"allDates":"thisDay")}</h3>
          <Button variant="outline" size="sm" aria-pressed={allDates} onClick={()=>setAllDates(!allDates)}>{t(allDates?"thisDay":"allDates")}</Button>
        </div>
        <div className="flex flex-wrap gap-2"><input type="search" aria-label={t("searchEntries")} placeholder={t("searchEntries")} className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2" value={query} onChange={e=>setQuery(e.target.value)}/>
          <select aria-label={t("feelingsGroup")} className="max-w-full rounded-xl border border-input bg-background px-2" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">{t("feelingsGroup")}</option>{PICKER_FEELINGS.map(f=><option key={f} value={f}>{feelingLabel(f)}</option>)}</select></div>
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
                    savedFlash && entry.id === dayEntries[0]?.id && "entry-arrive",
                    checkin && "border-s-4 !bg-secondary/60 !py-3",
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
                      {allDates && <time dateTime={entry.date}>{entry.date}</time>}
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
                  {!checkin && entry.body.trim() && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-foreground/90">
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
                  {!checkin && entry.body.trim() && onReflect && <Button className="mt-2" variant="ghost" size="sm" onClick={()=>onReflect(entry.id)}>{t("deskReflection")}</Button>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
