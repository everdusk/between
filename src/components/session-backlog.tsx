"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus, Undo2, X } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDayLabel } from "@/lib/dates";
import { discussedDateKey, entriesForTheme, visibleTopic } from "@/lib/themes";
import { visibleDiscussedTopic } from "@/lib/theme-review";
import type { JournalEntry, SessionTheme, ThemeLink } from "@/lib/types";
import { reflectionQuestion } from "./journal-explore";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";

interface SessionBacklogProps {
  inMessenger?: boolean;
  reviewPilot?: boolean;
  themes: SessionTheme[];
  entries: JournalEntry[];
  links: ThemeLink[];
  refreshing?: boolean;
  disabled?: boolean;
  personal?: boolean;
  onRestore?: (id: string, status: SessionTheme["status"]) => void;
  onDiscuss: (id: string, discussed: boolean, outcome?: string) => void;
  onDismiss: (id: string) => void;
  onAdd: (title: string) => void;
  onOpenNote?: (date: string) => void;
}

function ThemeRow({
  theme,
  said,
  when,
  open,
  notes,
  disabled,
  saidLabel,
  emptyLabel,
  removeLabel,
  noteCount,
  locale,
  feelingLabel,
  onToggle,
  onExpand,
  onDismiss,
  onOpenNote,
}: {
  theme: SessionTheme;
  said: boolean;
  when: string;
  open: boolean;
  notes: JournalEntry[];
  disabled?: boolean;
  saidLabel: string;
  emptyLabel: string;
  removeLabel: string;
  noteCount: string;
  locale: string;
  feelingLabel: (feeling: JournalEntry["feelings"][number]) => string;
  onToggle: () => void;
  onExpand: () => void;
  onDismiss: () => void;
  onOpenNote?: (date: string) => void;
}) {
  const { t } = useI18n();
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 py-3 first:pt-0 last:pb-0">
        <button
          type="button"
          className={cn("topic-row-trigger flex w-full items-center gap-2 rounded-2xl ps-3 pe-2 py-2 text-start", said && "col-span-2")}
          aria-expanded={open}
          onClick={onExpand}
        >
          <span className="min-w-0 flex-1">
            <span className={cn("block text-sm leading-relaxed", said ? "text-muted-foreground" : "text-foreground/90")}>
              {theme.title}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5">×{noteCount}</span>
              <span>{when}</span>
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
        {!said && <Button type="button" size="icon-sm" variant="ghost" disabled={disabled}
          aria-label={saidLabel} onClick={onToggle}>
          <Check aria-hidden />
        </Button>}
        <Button type="button" size="icon-sm" variant="ghost" disabled={disabled} aria-label={removeLabel} onClick={onDismiss}>
          <X aria-hidden />
        </Button>
        {said && <Button type="button" size="sm" variant="outline" disabled={disabled}
          className="col-span-full ms-3 mt-1 justify-self-start" onClick={onToggle}>
          <Undo2 aria-hidden className="rtl:scale-x-[-1]" />{t("backlogRestoreActive")}
        </Button>}
        {open && theme.review?.filter(e=>e.text && e.text!==theme.outcome).map(e=>
          <div key={e.id} className="col-span-full text-sm"><p className="text-muted-foreground">{e.question || formatDayLabel(e.at.slice(0,10),locale)}</p><p className="whitespace-pre-wrap">{e.text}</p></div>)}
        {open && theme.outcome && <p className="col-span-full whitespace-pre-wrap text-sm">{theme.outcome}</p>}
        {open && (
          <ul className="col-span-full space-y-2 pt-2">
            {notes.length === 0 ? (
              <li className="text-sm text-muted-foreground">{emptyLabel}</li>
            ) : (
              notes.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="block w-full rounded-2xl bg-foreground/[0.04] px-3 py-2 text-start"
                    onClick={() => {
                      onOpenNote?.(entry.date);
                      document.getElementById(`week-day-${entry.date}`)?.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                      });
                    }}
                  >
                    <span className="text-xs text-muted-foreground">
                      {formatDayLabel(entry.date, locale)}
                      {entry.feelings.length > 0
                        ? ` · ${entry.feelings.map((item) => feelingLabel(item)).join(", ")}`
                        : ""}
                    </span>
                    {entry.body.trim() && (
                      <span className="mt-1 block whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                        {entry.body}
                      </span>
                    )}
                  </button>
                  {entry.reflection && (
                    <div className="mt-2 space-y-1 rounded-xl border border-border p-3 text-sm">
                      {(entry.reflection.feeling === "unsure" || entry.feelings.includes(entry.reflection.feeling)) && (
                        <p>{t(reflectionQuestion(entry.reflection.feeling))}</p>
                      )}
                      <p className="whitespace-pre-wrap">{entry.reflection.answer}</p>
                      <p className="whitespace-pre-wrap">{entry.reflection.insight}</p>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
    </li>
  );
}

export function SessionBacklog({
  inMessenger,
  personal, onRestore, reviewPilot,
  themes,
  entries,
  links,
  refreshing,
  disabled,
  onDiscuss,
  onDismiss,
  onAdd,
  onOpenNote,
}: SessionBacklogProps) {
  const { t, locale, count, feeling } = useI18n();
  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const live = themes.filter(theme => theme.status === "active" && !theme.dismissed && visibleTopic(theme));
  const archive = themes
    .filter(theme => visibleDiscussedTopic(theme, reviewPilot))
    .sort((a, b) => Number(a.status === "archived") - Number(b.status === "archived"));
  const [removed, setRemoved] = useState<SessionTheme | null>(null);
  const [closing,setClosing]=useState<string | null>(null);
  const [outcome,setOutcome]=useState("");
  function remove(theme: SessionTheme) {
    onDismiss(theme.id);
    if (onRestore) setRemoved(theme);
  }

  function add(text: string) {
    const clean = text.trim();
    if (!clean) return;
    onAdd(clean);
    setDraft("");
  }

  return (
    <section className="glass min-w-0 rounded-3xl p-5 [overflow-wrap:anywhere] sm:p-6" aria-labelledby="session-backlog-title">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h3
            id="session-backlog-title"
            className="font-display text-xl tracking-tight text-foreground"
          >
            {t(inMessenger ? "themes" : personal ? "deskPersonal" : "deskTherapy")}
          </h3>

        </div>
        {live.length > 0 && (
          <span className="tabular inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] px-2 text-xs font-medium text-foreground">
            {live.length}
          </span>
        )}
      </div>

      {live.length === 0 && archive.length === 0 && refreshing ? (
        <div className="mt-5 space-y-3" role="status" aria-label={t("backlogRefreshing")}>
          <div className="skeleton h-4 w-full rounded-full" />
          <div className="skeleton h-4 w-3/4 rounded-full" />
          <div className="skeleton h-4 w-1/2 rounded-full" />
        </div>
      ) : live.length === 0 && archive.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-[color:var(--glass-border)] px-4 py-5 text-center text-sm text-muted-foreground">
          {t("backlogEmpty")}
        </p>
      ) : live.length === 0 ? null : (
        <ul className="mt-5 divide-y divide-[color:var(--glass-border)]">
          {live.map((theme) => (
            <ThemeRow
              key={theme.id}
              theme={theme}
              said={false}
              when={formatDayLabel(theme.lastSeen, locale)}
              open={openId === theme.id}
              notes={entriesForTheme(theme, entries, links)}
              disabled={disabled}
              saidLabel={t("backlogSaid")}
              emptyLabel={t("backlogNoNotes")}
              removeLabel={t("backlogRemove")}
              noteCount={count(theme.count, "note")}
              locale={locale}
              feelingLabel={feeling}
              onToggle={() => {setClosing(theme.id); setOutcome(theme.outcome ?? "")}}
              onExpand={() => setOpenId(openId === theme.id ? null : theme.id)}
              onDismiss={() => remove(theme)}
              onOpenNote={onOpenNote}
            />
          ))}
        </ul>
      )}

      {archive.length > 0 && (
        <div className="mt-5 border-t border-[color:var(--glass-border)] pt-4">
          <button
            type="button"
            className="topic-row-trigger flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-start"
            aria-expanded={archiveOpen}
            onClick={() => setArchiveOpen((open) => !open)}
          >
            <span className="text-sm text-muted-foreground">{t(personal ? "feelingDone" : "backlogArchive")}</span>
            <span className="tabular text-xs text-muted-foreground">{archive.length}</span>
            <ChevronDown
              aria-hidden
              className={cn(
                "ms-auto size-4 shrink-0 text-muted-foreground transition-transform",
                archiveOpen && "rotate-180",
              )}
            />
          </button>
          {archiveOpen && (
            <>

              <ul className="mt-2 divide-y divide-[color:var(--glass-border)]">
                {archive.map((theme) => (
                  <ThemeRow
                    key={theme.id}
                    theme={theme}
                    said
                    when={formatDayLabel(discussedDateKey(theme), locale)}
                    open={openId === theme.id}
                    notes={entriesForTheme(theme, entries, links)}
                    disabled={disabled}
                    saidLabel={t("backlogSaid")}
                    emptyLabel={t("backlogNoNotes")}
                    removeLabel={t("backlogRemove")}
                    noteCount={count(theme.count, "note")}
                    locale={locale}
                    feelingLabel={feeling}
                    onToggle={() => theme.dismissed ? onRestore?.(theme.id,"active") : onDiscuss(theme.id,false)}
                    onExpand={() => setOpenId(openId === theme.id ? null : theme.id)}
                    onDismiss={() => remove(theme)}
                    onOpenNote={onOpenNote}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {closing && (
        <dialog
          ref={node => { if (node && !node.open) node.showModal(); }}
          onCancel={() => setClosing(null)}
          aria-labelledby="topic-outcome-title"
          className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[min(28rem,calc(100%_-_2rem))] max-w-none overflow-y-auto rounded-3xl border border-[color:var(--glass-border)] bg-background bg-[linear-gradient(var(--card),var(--card))] p-5 text-foreground shadow-2xl backdrop:bg-black/55 sm:p-6"
        >
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t(personal ? "deskPersonal" : "deskTherapy")}</p>
              <h2 id="topic-outcome-title" className="mt-2 font-display text-xl leading-tight">{t("topicOutcomeTitle")}</h2>
            </div>
            <Button autoFocus variant="ghost" size="icon" aria-label={t("cancel")} onClick={() => setClosing(null)}><X /></Button>
          </header>
          <p className="diary-quote my-4 break-words text-sm">{live.find(theme => theme.id === closing)?.title}</p>
          <Textarea aria-labelledby="topic-outcome-title" className="min-h-28 max-h-52 resize-y" value={outcome} placeholder={t("insightsPlaceholder")} onChange={event => setOutcome(event.target.value)} />
          <Button className="topic-save mt-4 h-auto min-h-11 w-full whitespace-normal" onClick={() => {
            onDiscuss(closing, true, outcome.trim());
            setClosing(null);
          }}>{t(outcome.trim() ? "saveSession" : "topicFinishEmpty")}</Button>
        </dialog>
      )}
      {onRestore && removed && (
        <Button
          className="mt-2"
          variant="outline"
          aria-label={`${t("undoChange")} — ${removed.title}`}
          onClick={() => {
            onRestore(removed.id, removed.status);
            setRemoved(null);
          }}
        >
          {t("undoChange")}
        </Button>
      )}
      <form
        data-field-surface
        className="mt-5 flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-background/55 p-1 ps-4 transition-[box-shadow,border-color] has-[:focus-visible]:border-ring/40 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/12"
        onSubmit={(event) => {
          event.preventDefault();
          add(draft);
        }}
      >
        <label className="sr-only" htmlFor="backlog-draft">
          {t(personal ? "deskPersonal" : "backlogPlaceholder")}
        </label>
        <Input
          id="backlog-draft"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t(personal ? "deskPersonal" : "backlogPlaceholder")}
          className="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 focus-visible:border-transparent focus-visible:bg-transparent focus-visible:ring-0"
        />
        <Button
          type="submit"
          size="icon"
          variant="ink"
          disabled={disabled}
          className="shrink-0"
          aria-label={t("backlogAdd")}
          onClick={(event) => {
            event.preventDefault();
            add(draft);
          }}
        >
          <Plus aria-hidden />
        </Button>
      </form>

      {refreshing && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50" />
            <span className="relative inline-flex size-2 rounded-full bg-primary/70" />
          </span>
          {t("backlogRefreshing")}
        </p>
      )}
    </section>
  );
}
