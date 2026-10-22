"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  appendBacklogItem,
  briefStamp,
  buildRuleBacklog,
  buildRuleBrief,
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
  const day = (key: string) => formatDayLabel(key, locale);
  const rules = useMemo(
    () =>
      buildRuleBacklog({
        weekEntries,
        prevEntries,
        talkNotes,
        day: (key) => formatDayLabel(key, locale),
      }),
    [weekEntries, prevEntries, talkNotes, locale],
  );
  const modelStamp = `b2:${briefStamp(weekEntries, talkNotes)}:${locale}`;
  const settled =
    prep?.backlogStamp === modelStamp &&
    (prep.backlogSource === "model" || prep.backlogSource === "rules");
  const usingModel = settled && prep?.backlogSource === "model";
  const handwritten = prep?.backlogSource === "user" && !settled;
  const hidden = prep?.backlogHidden;
  const generated = useMemo(
    () =>
      usingModel ? (prep?.backlog ?? []).filter((item) => item.origin !== "user") : rules,
    [usingModel, prep?.backlog, rules],
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

  const rulesRef = useRef(rules);
  const previousRef = useRef(prep?.backlog);
  const hiddenRef = useRef(hidden ?? []);
  const handwrittenRef = useRef(handwritten);
  const factsRef = useRef("");
  const facts = buildRuleBrief({
    weekEntries,
    prevEntries,
    talkNotes,
    todayKey,
    copy: {
      empty: t("briefEmpty"),
      most: t("briefMost"),
      mostPast: t("briefMostPast"),
      past: t("briefPast"),
      themes: t("briefThemes"),
      carried: t("briefCarriedLine"),
      entries: t("briefEntries"),
      today: t("briefToday"),
      say: t("briefSay"),
      talkEmpty: t("briefTalkEmpty"),
      feeling,
      day,
    },
  });
  useLayoutEffect(() => {
    rulesRef.current = rules;
    previousRef.current = prep?.backlog;
    hiddenRef.current = hidden ?? [];
    handwrittenRef.current = handwritten;
    factsRef.current = facts;
  }, [rules, prep?.backlog, hidden, handwritten, facts]);

  const attemptRef = useRef<string | null>(null);
  const rulesSignature = rules.map((item) => item.text).join("\n");

  useEffect(() => {
    if (settled || !initData || !rulesSignature) return;
    if (attemptRef.current === modelStamp) return;
    attemptRef.current = modelStamp;
    let cancelled = false;
    void (async () => {
      const result = await requestBrief(initData, factsRef.current, modelStamp, locale, "backlog");
      if (cancelled) return;
      const parsed = result.ok && result.text ? parseModelBacklog(result.text) : null;
      const next = fillBacklog({
        generated: parsed ?? rulesRef.current,
        previous: previousRef.current,
        hidden: hiddenRef.current,
        handwritten: handwrittenRef.current,
      });
      onSave(weekKey, next, modelStamp, parsed ? "model" : "rules", hiddenRef.current);
    })();
    return () => {
      cancelled = true;
      if (attemptRef.current === modelStamp) attemptRef.current = null;
    };
  }, [settled, initData, rulesSignature, modelStamp, locale, weekKey, onSave]);

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
  const refreshing = Boolean(initData && !settled && rulesSignature);

  return (
    <section className="space-y-3" aria-labelledby="session-backlog-title">
      <div className="space-y-1">
        <h3 id="session-backlog-title" className="font-display text-lg text-foreground">
          {t("backlogTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("backlogLead")}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("backlogEmpty")}</p>
      ) : (
        <div className="space-y-4">
          {ORDER.map((priority) => {
            const group = items.filter((item) => item.priority === priority);
            if (group.length === 0) return null;
            return (
              <div key={priority} className="space-y-2">
                <p className="text-xs text-muted-foreground">{labels[priority]}</p>
                <ul className="space-y-2">
                  {group.map((item) => (
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
            );
          })}
        </div>
      )}

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

      {refreshing && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("backlogRefreshing")}
        </p>
      )}
    </section>
  );
}
