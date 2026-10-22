"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

  return (
    <section className="space-y-3" aria-labelledby="session-backlog-title">
      <div className="space-y-1">
        <h3 id="session-backlog-title" className="font-display text-lg text-foreground">
          {t("backlogTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("backlogLead")}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {usingModel && hasNotes ? t("backlogNone") : t("backlogEmpty")}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
              <div key={group.key} className="space-y-2">
                {group.label ? (
                  <p className="text-xs text-muted-foreground">{group.label}</p>
                ) : null}
                <ul className="space-y-2">
                  {group.rows.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/70 px-3 py-2.5"
                    >
                      <label
                        className={cn(
                          "flex min-w-0 flex-1 cursor-pointer items-start gap-3",
                          disabled && "cursor-not-allowed",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 accent-primary"
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
                        onClick={() => remove(item)}
                      >
                        {t("backlogRemove")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
          ))}
        </div>
      )}

      <form
        className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/70 py-1.5 pr-1.5 pl-3"
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
          className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0"
        />
        <Button
          type="submit"
          disabled={disabled}
          className="shrink-0"
          onClick={(event) => {
            event.preventDefault();
            add(draft);
          }}
        >
          {t("backlogAdd")}
        </Button>
      </form>

      {refreshing && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("backlogRefreshing")}
        </p>
      )}
    </section>
  );
}
