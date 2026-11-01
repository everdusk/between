"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDayLabel } from "@/lib/dates";
import { discussedDateKey, splitBacklog } from "@/lib/themes";
import type { JournalEntry, SessionTheme, ThemeLink } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SessionBacklogProps {
  themes: SessionTheme[];
  entries: JournalEntry[];
  links: ThemeLink[];
  refreshing?: boolean;
  disabled?: boolean;
  onDiscuss: (id: string, discussed: boolean) => void;
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
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={said}
        aria-label={saidLabel}
        onClick={onToggle}
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-foreground/25 bg-background/40 transition-colors duration-200 focus-visible:ring-4 focus-visible:ring-ring/25",
          said && "border-foreground bg-foreground text-background",
        )}
      >
        <Check className={cn("size-3", said ? "opacity-100" : "opacity-0")} strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <button
          type="button"
          className="flex w-full items-start gap-2 text-start"
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
            className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
        {open && (
          <ul className="space-y-2 pt-2">
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
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="-me-2 -mt-1 shrink-0"
        disabled={disabled}
        aria-label={removeLabel}
        onClick={onDismiss}
      >
        <X aria-hidden />
      </Button>
    </li>
  );
}

function notesForTheme(theme: SessionTheme, entries: JournalEntry[], links: ThemeLink[]): JournalEntry[] {
  const ids = new Set<string>();
  for (const link of links) {
    if (link.themeId === theme.id) ids.add(link.entryId);
  }
  for (const quote of theme.quotes) ids.add(quote.entryId);
  return entries
    .filter((entry) => ids.has(entry.id))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function SessionBacklog({
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
  const { live, archive } = splitBacklog(themes);

  function add(text: string) {
    const clean = text.trim();
    if (!clean) return;
    onAdd(clean);
    setDraft("");
  }

  return (
    <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="session-backlog-title">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h3
            id="session-backlog-title"
            className="font-display text-xl tracking-tight text-foreground"
          >
            {t("backlogTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("backlogLead")}</p>
        </div>
        {live.length > 0 && (
          <span className="tabular inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] px-2 text-xs font-medium text-foreground">
            {live.length}
          </span>
        )}
      </div>

      {live.length === 0 && archive.length === 0 && !refreshing ? (
        <p className="mt-5 rounded-2xl border border-dashed border-[color:var(--glass-border)] px-4 py-5 text-center text-sm text-muted-foreground">
          {t("backlogEmpty")}
        </p>
      ) : live.length === 0 ? null : (
        <ul className="mt-5 divide-y divide-[color:var(--glass-border)]">
          {live.map((theme) => (
            <ThemeRow
              key={theme.id}
              theme={theme}
              said={theme.status === "discussed"}
              when={formatDayLabel(theme.lastSeen, locale)}
              open={openId === theme.id}
              notes={notesForTheme(theme, entries, links)}
              disabled={disabled}
              saidLabel={t("backlogSaid")}
              emptyLabel={t("backlogNoNotes")}
              removeLabel={t("backlogRemove")}
              noteCount={count(theme.count, "note")}
              locale={locale}
              feelingLabel={feeling}
              onToggle={() => onDiscuss(theme.id, theme.status !== "discussed")}
              onExpand={() => setOpenId(openId === theme.id ? null : theme.id)}
              onDismiss={() => onDismiss(theme.id)}
              onOpenNote={onOpenNote}
            />
          ))}
        </ul>
      )}

      {archive.length > 0 && (
        <div className="mt-5 border-t border-[color:var(--glass-border)] pt-4">
          <button
            type="button"
            className="flex w-full items-center gap-2 text-start"
            aria-expanded={archiveOpen}
            onClick={() => setArchiveOpen((open) => !open)}
          >
            <span className="text-sm text-muted-foreground">{t("backlogArchive")}</span>
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
              <p className="mt-1.5 text-xs text-muted-foreground">{t("backlogArchiveLead")}</p>
              <ul className="mt-2 divide-y divide-[color:var(--glass-border)]">
                {archive.map((theme) => (
                  <ThemeRow
                    key={theme.id}
                    theme={theme}
                    said
                    when={formatDayLabel(discussedDateKey(theme), locale)}
                    open={openId === theme.id}
                    notes={notesForTheme(theme, entries, links)}
                    disabled={disabled}
                    saidLabel={t("backlogSaid")}
                    emptyLabel={t("backlogNoNotes")}
                    removeLabel={t("backlogRemove")}
                    noteCount={count(theme.count, "note")}
                    locale={locale}
                    feelingLabel={feeling}
                    onToggle={() => onDiscuss(theme.id, false)}
                    onExpand={() => setOpenId(openId === theme.id ? null : theme.id)}
                    onDismiss={() => onDismiss(theme.id)}
                    onOpenNote={onOpenNote}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <form
        className="mt-5 flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-background/55 p-1 ps-4 transition-[box-shadow,border-color] has-[:focus-visible]:border-primary/40 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/12"
        onSubmit={(event) => {
          event.preventDefault();
          add(draft);
        }}
      >
        <label className="sr-only" htmlFor="backlog-draft">
          {t("backlogPlaceholder")}
        </label>
        <Input
          id="backlog-draft"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("backlogPlaceholder")}
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
