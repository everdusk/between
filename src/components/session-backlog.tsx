"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDayLabel } from "@/lib/dates";
import type { SessionTheme } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SessionBacklogProps {
  themes: SessionTheme[];
  refreshing?: boolean;
  disabled?: boolean;
  onDiscuss: (id: string, discussed: boolean) => void;
  onDismiss: (id: string) => void;
  onAdd: (title: string) => void;
}

export function SessionBacklog({
  themes,
  refreshing,
  disabled,
  onDiscuss,
  onDismiss,
  onAdd,
}: SessionBacklogProps) {
  const { t, locale, count } = useI18n();
  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

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
        {themes.length > 0 && (
          <span className="tabular inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] px-2 text-xs font-medium text-foreground">
            {themes.length}
          </span>
        )}
      </div>

      {themes.length === 0 && !refreshing ? (
        <p className="mt-5 rounded-2xl border border-dashed border-[color:var(--glass-border)] px-4 py-5 text-center text-sm text-muted-foreground">
          {t("backlogEmpty")}
        </p>
      ) : themes.length === 0 ? null : (
        <ul className="mt-5 divide-y divide-[color:var(--glass-border)]">
          {themes.map((theme) => {
            const said = theme.status === "discussed";
            const open = openId === theme.id;
            return (
            <li key={theme.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <button
                type="button"
                disabled={disabled}
                aria-pressed={said}
                aria-label={t("backlogSaid")}
                onClick={() => onDiscuss(theme.id, !said)}
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
                  className="block w-full text-start"
                  onClick={() => setOpenId(open ? null : theme.id)}
                >
                  <span className={cn("block text-sm leading-relaxed", said ? "text-muted-foreground" : "text-foreground/90")}>
                    {theme.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5">
                      ×{count(theme.count, "note")}
                    </span>
                    <span>{formatDayLabel(theme.lastSeen, locale)}</span>
                  </span>
                </button>
                {open && theme.quotes.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {theme.quotes.map((quote) => (
                      <button
                        key={`${quote.entryId}:${quote.text}`}
                        type="button"
                        className="block text-start text-sm text-foreground/80 underline-offset-4 hover:underline"
                        onClick={() => {
                          document.getElementById(`week-day-${quote.date}`)?.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                          });
                        }}
                      >
                        {formatDayLabel(quote.date, locale)}: {quote.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="-me-2 -mt-1 shrink-0"
                disabled={disabled}
                aria-label={t("backlogRemove")}
                onClick={() => onDismiss(theme.id)}
              >
                <X aria-hidden />
              </Button>
            </li>
            );
          })}
        </ul>
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
