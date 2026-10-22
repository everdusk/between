"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  appendBacklogItem,
  backlogSuggestions,
  buildRuleBacklog,
  seedUserBacklog,
} from "@/lib/brief";
import { formatDayLabel } from "@/lib/dates";
import type { BacklogItem, BacklogSource, JournalEntry, WeekPrep } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SessionBacklogProps {
  weekKey: string;
  weekEntries: JournalEntry[];
  prevEntries: JournalEntry[];
  prep?: WeekPrep;
  disabled?: boolean;
  onSave: (
    weekKey: string,
    backlog: BacklogItem[],
    backlogStamp: string,
    backlogSource: BacklogSource,
  ) => boolean;
}

export function SessionBacklog({
  weekKey,
  weekEntries,
  prevEntries,
  prep,
  disabled,
  onSave,
}: SessionBacklogProps) {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState("");
  const seededKey = useRef<string | null>(null);
  const owned = prep?.backlogSource === "user";
  const seeded = useMemo(
    () =>
      seedUserBacklog({
        talkNotes: prep?.talkNotes ?? "",
        previous: prep?.backlog,
      }),
    [prep?.talkNotes, prep?.backlog],
  );
  const items = useMemo(
    () => (owned ? (prep?.backlog ?? []) : seeded),
    [owned, prep?.backlog, seeded],
  );

  useEffect(() => {
    if (owned) {
      seededKey.current = weekKey;
      return;
    }
    if (seededKey.current === weekKey) return;
    seededKey.current = weekKey;
    onSave(weekKey, seeded, "user", "user");
  }, [owned, weekKey, seeded, onSave]);

  const suggestions = useMemo(
    () =>
      backlogSuggestions(
        buildRuleBacklog({
          weekEntries,
          prevEntries,
          talkNotes: "",
          day: (key) => formatDayLabel(key, locale),
        }),
        items,
      ),
    [weekEntries, prevEntries, items, locale],
  );

  function commit(next: BacklogItem[]) {
    onSave(weekKey, next, "user", "user");
  }

  function add(text: string) {
    const next = appendBacklogItem(items, text);
    if (!next) return;
    commit(next);
    setDraft("");
  }

  return (
    <section className="space-y-3" aria-labelledby="session-backlog-title">
      <div className="space-y-1">
        <h3 id="session-backlog-title" className="font-display text-lg text-foreground">
          {t("backlogTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("backlogLead")}</p>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
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
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={disabled || draft.trim().length < 2}>
          {t("backlogAdd")}
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("backlogEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/70 px-3 py-2.5"
            >
              <label className={cn("flex min-w-0 flex-1 cursor-pointer items-start gap-3", disabled && "cursor-not-allowed")}>
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                  checked={item.done}
                  disabled={disabled}
                  onChange={() =>
                    commit(
                      items.map((row) =>
                        row.id === item.id ? { ...row, done: !row.done } : row,
                      ),
                    )
                  }
                />
                <span
                  className={cn(
                    "text-sm leading-relaxed text-foreground/90",
                    item.done && "text-muted-foreground line-through",
                  )}
                >
                  {item.text}
                </span>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => commit(items.filter((row) => row.id !== item.id))}
              >
                {t("backlogRemove")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("backlogFromNotes")}</p>
          <ul className="space-y-2">
            {suggestions.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3">
                <span className="text-sm leading-relaxed text-muted-foreground">{item.text}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={disabled}
                  onClick={() => add(item.text)}
                >
                  {t("backlogAdd")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
