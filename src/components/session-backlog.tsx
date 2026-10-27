"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  appendBacklogItem,
  backlogContext,
  backlogPassages,
  briefStamp,
  fillBacklog,
  parseModelBacklog,
  topicsOverlap,
} from "@/lib/brief";
import { formatDayLabel } from "@/lib/dates";
import { requestBrief } from "@/lib/journal-api";
import type {
  BacklogItem,
  BacklogPriority,
  BacklogSource,
  JournalEntry,
  WeekPrep,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER: BacklogPriority[] = ["high", "mid", "low"];

interface SessionBacklogProps {
  weekKey: string;
  weekEntries: JournalEntry[];
  prevEntries: JournalEntry[];
  talkNotes: string;
  todayKey: string;
  prep?: WeekPrep;
  initData?: string;
  disabled?: boolean;
  onSave: (
    weekKey: string,
    backlog: BacklogItem[],
    backlogStamp: string,
    backlogSource: BacklogSource,
    backlogHidden: string[],
  ) => boolean;
}

export function SessionBacklog({
  weekKey,
  weekEntries,
  prevEntries,
  talkNotes,
  todayKey,
  prep,
  initData,
  disabled,
  onSave,
}: SessionBacklogProps) {
  const { t, locale, feeling } = useI18n();
  const [draft, setDraft] = useState("");
  const day = useCallback((key: string) => formatDayLabel(key, locale), [locale]);
  const passages = useMemo(
    () => backlogPassages({ weekEntries, talkNotes, day }),
    [weekEntries, talkNotes, day],
  );
  const context = useMemo(
    () =>
      backlogContext({
        weekEntries,
        prevEntries,
        talkNotes,
        todayKey,
        today: t("briefToday"),
        feeling,
        day,
      }),
    [weekEntries, prevEntries, talkNotes, todayKey, t, feeling, day],
  );
  const modelStamp = `b3:${briefStamp(weekEntries, talkNotes)}:${locale}`;
  const settled =
    prep?.backlogStamp === modelStamp &&
    (prep.backlogSource === "model" || prep.backlogSource === "rules");
  const usingModel = settled && prep?.backlogSource === "model";
  const handwritten = prep?.backlogSource === "user" && !settled;
  const hidden = prep?.backlogHidden;
  const generated = useMemo(
    () =>
      settled
        ? (prep?.backlog ?? []).filter((item) => item.origin !== "user")
        : passages,
    [settled, prep?.backlog, passages],
  );
  const items = useMemo(
    () =>
      fillBacklog({
        generated,
        previous: prep?.backlog,
        hidden,
        handwritten,
      }),
    [generated, prep?.backlog, hidden, handwritten],
  );
  const hasNotes =
    weekEntries.some((entry) => entry.body.trim().length > 0) || talkNotes.trim().length > 0;

  const passagesRef = useRef(passages);
  const previousRef = useRef(prep?.backlog);
  const hiddenRef = useRef(hidden ?? []);
  const handwrittenRef = useRef(handwritten);
  const contextRef = useRef(context);
  useLayoutEffect(() => {
    passagesRef.current = passages;
    previousRef.current = prep?.backlog;
    hiddenRef.current = hidden ?? [];
    handwrittenRef.current = handwritten;
    contextRef.current = context;
  }, [passages, prep?.backlog, hidden, handwritten, context]);

  const attemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (settled || !initData || !context.trim()) return;
    if (attemptRef.current === modelStamp) return;
    attemptRef.current = modelStamp;
    let cancelled = false;
    void (async () => {
      const result = await requestBrief(
        initData,
        contextRef.current,
        modelStamp,
        locale,
        "backlog",
      );
      if (cancelled) return;
      const ranked =
        result.ok && result.text != null ? parseModelBacklog(result.text) : null;
      const next = fillBacklog({
        generated: ranked ?? passagesRef.current,
        previous: previousRef.current,
        hidden: hiddenRef.current,
        handwritten: handwrittenRef.current,
      });
      onSave(
        weekKey,
        next,
        modelStamp,
        ranked !== null ? "model" : "rules",
        hiddenRef.current,
      );
    })();
    return () => {
      cancelled = true;
      if (attemptRef.current === modelStamp) attemptRef.current = null;
    };
  }, [settled, initData, context, modelStamp, locale, weekKey, onSave]);

  const hiddenList = hidden ?? [];

  function persist(
    next: BacklogItem[],
    nextHidden: string[],
    source: BacklogSource = usingModel ? "model" : prep?.backlogSource === "user" ? "user" : "rules",
    stamp: string = usingModel ? modelStamp : (prep?.backlogStamp ?? ""),
  ) {
    onSave(weekKey, next, stamp, source, nextHidden);
  }

  function add(text: string) {
    const next = appendBacklogItem(items, text);
    if (!next) return;
    persist(next, hiddenList);
    setDraft("");
  }

  function remove(item: BacklogItem) {
    const nextHidden =
      item.origin === "user" || hiddenList.some((text) => topicsOverlap(text, item.text))
        ? hiddenList
        : [...hiddenList, item.text];
    persist(
      items.filter((row) => row.id !== item.id),
      nextHidden,
    );
  }

  const labels: Record<BacklogPriority, string> = {
    high: t("backlogHigh"),
    mid: t("backlogMid"),
    low: t("backlogLow"),
  };
  const refreshing = Boolean(initData && !settled && context.trim());
  const groups = usingModel
    ? ORDER.map((priority) => ({
        key: priority,
        label: labels[priority],
        rows: items.filter((item) => item.priority === priority),
      })).filter((group) => group.rows.length > 0)
    : [{ key: "notes", label: null as string | null, rows: items }];

  const openCount = items.filter((item) => !item.done).length;

  return (
    <section
      className="glass rounded-3xl p-5 sm:p-6"
      aria-labelledby="session-backlog-title"
    >
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
        {items.length > 0 && (
          <span className="tabular inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] px-2 text-xs font-medium text-foreground">
            {openCount}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-[color:var(--glass-border)] px-4 py-5 text-center text-sm text-muted-foreground">
          {usingModel && hasNotes ? t("backlogNone") : t("backlogEmpty")}
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map((group) => (
            <div key={group.key} className="space-y-1">
              {group.label ? (
                <p className="eyebrow mb-2 text-muted-foreground">{group.label}</p>
              ) : null}
              <ul className="divide-y divide-[color:var(--glass-border)]">
                {group.rows.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <label
                      className={cn(
                        "group/row flex min-w-0 flex-1 cursor-pointer items-start gap-3",
                        disabled && "cursor-not-allowed",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={item.done}
                        disabled={disabled}
                        onChange={() =>
                          persist(
                            items.map((row) =>
                              row.id === item.id ? { ...row, done: !row.done } : row,
                            ),
                            hiddenList,
                          )
                        }
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                          "peer-focus-visible:ring-4 peer-focus-visible:ring-ring/25",
                          item.done
                            ? "border-transparent bg-primary text-primary-foreground"
                            : "border-foreground/25 bg-background/40 group-hover/row:border-foreground/45",
                        )}
                      >
                        <Check
                          className={cn("size-3", item.done ? "opacity-100" : "opacity-0")}
                          strokeWidth={3}
                        />
                      </span>
                      <span
                        className={cn(
                          "text-sm leading-relaxed text-foreground/90 transition-colors",
                          item.done && "text-muted-foreground line-through decoration-foreground/30",
                        )}
                      >
                        {item.text}
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="-me-2 -mt-1 shrink-0"
                      disabled={disabled}
                      aria-label={t("backlogRemove")}
                      onClick={() => remove(item)}
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
