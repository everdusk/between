"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  briefStamp,
  buildRuleBacklog,
  buildRuleBrief,
  formatBacklogHandoff,
  mergeBacklog,
  parseModelBacklog,
  type BacklogDraft,
} from "@/lib/brief";
import { formatDayLabel } from "@/lib/dates";
import { requestBrief } from "@/lib/journal-api";
import type { BacklogItem, BacklogPriority, BacklogSource, JournalEntry, WeekPrep } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER: BacklogPriority[] = ["high", "mid", "low"];

interface SessionBacklogProps {
  weekKey: string;
  weekEntries: JournalEntry[];
  prevEntries: JournalEntry[];
  talkNotes: string;
  savedTalk: string;
  todayKey: string;
  prep?: WeekPrep;
  initData?: string;
  disabled?: boolean;
  onSave: (
    weekKey: string,
    backlog: BacklogItem[],
    backlogStamp: string,
    backlogSource: BacklogSource,
  ) => boolean;
}

function previousDone(
  backlog: BacklogItem[] | undefined,
  overrides: Record<string, boolean> | undefined,
): { text: string; done: boolean }[] {
  const rows = (backlog ?? []).map((item) => ({
    text: item.text,
    done: overrides?.[item.text.trim().toLowerCase()] ?? item.done,
  }));
  for (const [text, done] of Object.entries(overrides ?? {})) {
    rows.push({ text, done });
  }
  return rows;
}

export function SessionBacklog({
  weekKey,
  weekEntries,
  prevEntries,
  talkNotes,
  savedTalk,
  todayKey,
  prep,
  initData,
  disabled,
  onSave,
}: SessionBacklogProps) {
  const { t, locale, feeling } = useI18n();
  const briefCopy = {
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
    day: (key: string) => formatDayLabel(key, locale),
  };

  const day = (key: string) => formatDayLabel(key, locale);
  const backlogCopy = {
    own: t("backlogOwn"),
    carried: t("backlogCarried"),
    feeling,
  };
  const savedRules = buildRuleBacklog({
    weekEntries,
    prevEntries,
    talkNotes: savedTalk,
    day,
    copy: backlogCopy,
  });
  const liveRules = buildRuleBacklog({
    weekEntries,
    prevEntries,
    talkNotes,
    day,
    copy: backlogCopy,
  });
  const modelStamp = `b3:${briefStamp(weekEntries, savedTalk)}:${locale}`;
  const draftDirty = talkNotes.trim() !== savedTalk.trim();
  const stored =
    prep?.backlogStamp === modelStamp && prep.backlog && prep.backlog.length > 0
      ? prep.backlog
      : null;
  const savedList = !draftDirty ? stored : null;
  const savedSignature = savedRules.map((item) => `${item.priority}\t${item.text}`).join("\n");
  const facts = buildRuleBrief({
    weekEntries,
    prevEntries,
    talkNotes: savedTalk,
    todayKey,
    copy: briefCopy,
  });

  const savedRulesRef = useRef(savedRules);
  const factsRef = useRef(facts);
  const prepBacklogRef = useRef(prep?.backlog);
  useLayoutEffect(() => {
    savedRulesRef.current = savedRules;
    factsRef.current = facts;
    prepBacklogRef.current = prep?.backlog;
  }, [savedRules, facts, prep?.backlog]);

  const [doneByStamp, setDoneByStamp] = useState<Record<string, Record<string, boolean>>>({});
  const doneRef = useRef(doneByStamp);
  useEffect(() => {
    doneRef.current = doneByStamp;
  }, [doneByStamp]);

  const attemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!savedSignature || draftDirty) return;
    const settled =
      prep?.backlogStamp === modelStamp &&
      (prep.backlogSource === "model" || prep.backlogSource === "rules");
    if (settled) return;

    if (!initData) {
      onSave(
        weekKey,
        mergeBacklog(
          savedRulesRef.current,
          previousDone(prepBacklogRef.current, doneRef.current[modelStamp]),
        ),
        modelStamp,
        "rules",
      );
      return;
    }

    if (attemptRef.current === modelStamp) return;
    attemptRef.current = modelStamp;
    let cancelled = false;
    void (async () => {
      const result = await requestBrief(initData, factsRef.current, modelStamp, locale, "backlog");
      if (cancelled) return;
      const parsed: BacklogDraft[] | null =
        result.ok && result.text ? parseModelBacklog(result.text) : null;
      const incoming = parsed ?? savedRulesRef.current;
      onSave(
        weekKey,
        mergeBacklog(
          incoming,
          previousDone(prepBacklogRef.current, doneRef.current[modelStamp]),
        ),
        modelStamp,
        parsed ? "model" : "rules",
      );
    })();
    return () => {
      cancelled = true;
      if (attemptRef.current === modelStamp) attemptRef.current = null;
    };
  }, [
    savedSignature,
    draftDirty,
    prep?.backlogStamp,
    prep?.backlogSource,
    initData,
    modelStamp,
    weekKey,
    locale,
    onSave,
  ]);

  const base = savedList ?? liveRules;
  const overrides = doneByStamp[modelStamp] ?? {};
  const items = base.map((item) => ({
    ...item,
    done: overrides[item.text.trim().toLowerCase()] ?? item.done,
  }));
  const refreshing = Boolean(
    initData &&
      !draftDirty &&
      savedSignature &&
      !(prep?.backlogStamp === modelStamp && prep.backlogSource),
  );

  const labels: Record<BacklogPriority, string> = {
    high: t("backlogHigh"),
    mid: t("backlogMid"),
    low: t("backlogLow"),
  };
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  function toggle(item: BacklogItem) {
    if (disabled) return;
    const key = item.text.trim().toLowerCase();
    const nextDone = !(overrides[key] ?? item.done);
    const nextMap = { ...(doneByStamp[modelStamp] ?? {}), [key]: nextDone };
    const nextDoneByStamp = { ...doneByStamp, [modelStamp]: nextMap };
    doneRef.current = nextDoneByStamp;
    setDoneByStamp(nextDoneByStamp);
    if (!draftDirty && stored) {
      onSave(
        weekKey,
        stored.map((row) =>
          row.text.trim().toLowerCase() === key ? { ...row, done: nextDone } : row,
        ),
        modelStamp,
        prep?.backlogSource ?? "rules",
      );
    }
  }

  async function handleCopy() {
    const text = formatBacklogHandoff(items, labels, t("backlogHandoffTitle"));
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setCopyState(ok ? "ok" : "fail");
    window.setTimeout(() => setCopyState("idle"), 2000);
  }

  return (
    <section className="space-y-3" aria-labelledby="session-backlog-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 id="session-backlog-title" className="font-display text-lg text-foreground">
            {t("backlogTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("backlogLead")}</p>
        </div>
        {items.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-w-[12.5rem]"
            onClick={() => void handleCopy()}
            aria-live="polite"
          >
            {copyState === "ok"
              ? t("copied")
              : copyState === "fail"
                ? t("copyFail")
                : t("copyForTherapist")}
          </Button>
        )}
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
                    <li key={item.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 bg-card/70 px-3 py-2.5",
                          item.done && "opacity-60",
                          disabled && "cursor-not-allowed",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 accent-primary"
                          checked={item.done}
                          disabled={disabled}
                          onChange={() => toggle(item)}
                        />
                        <span className="min-w-0 space-y-1">
                          <span
                            className={cn(
                              "block text-sm leading-relaxed text-foreground/90",
                              item.done && "text-muted-foreground line-through",
                            )}
                          >
                            {item.text}
                          </span>
                          {item.detail && (
                            <span
                              className={cn(
                                "block text-sm leading-relaxed text-muted-foreground",
                                item.done && "line-through",
                              )}
                            >
                              {item.detail}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {refreshing && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("backlogRefreshing")}
        </p>
      )}
    </section>
  );
}
