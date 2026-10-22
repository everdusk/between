"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayLabel, formatLongDate } from "@/lib/dates";
import { isFeeling } from "@/lib/feelings";
import { buildPeriodSummary } from "@/lib/session-summary";
import type { Feeling, JournalEntry, SessionNote } from "@/lib/types";
import type { MessageKey } from "@/lib/messages";

interface SessionPrepSummaryProps {
  entries: JournalEntry[];
  sessions: SessionNote[];
}

export function SessionPrepSummary({
  entries,
  sessions,
}: SessionPrepSummaryProps) {
  const { t, locale, feeling } = useI18n();
  const summary = useMemo(
    () => buildPeriodSummary(entries, sessions),
    [entries, sessions],
  );
  const [open, setOpen] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  if (!summary) {
    return (
      <section className="space-y-2 border-b border-border/70 pb-6">
        <h3 className="font-display text-lg text-foreground">
          {t("sinceSession")}
        </h3>
        <p className="rounded-lg border border-dashed border-border/80 bg-background/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {t("noSessionsYet")}
        </p>
      </section>
    );
  }

  const sessionLabel = formatLongDate(summary.lastSession.date, locale);

  if (summary.entryCount === 0 && summary.feelings.length === 0) {
    return (
      <section className="space-y-2 border-b border-border/70 pb-6">
        <h3 className="font-display text-lg text-foreground">
          {t("sinceSession")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("afterSessionEmpty", { date: sessionLabel })}
        </p>
      </section>
    );
  }

  async function handleCopy() {
    if (!summary) return;
    const text = copyText(summary, sessionLabel, t, locale, feeling);
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
    <section className="space-y-3 border-b border-border/70 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-display text-lg text-foreground">
            {t("sinceSession")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("afterSessionLead", { date: sessionLabel })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? t("collapse") : t("expand")}
        </Button>
      </div>

      {open && (
        <div className="animate-in fade-in slide-in-from-top-1 space-y-4 duration-300">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span>
              {t("entriesCount")}{" "}
              <strong className="font-medium text-foreground">
                {summary.entryCount}
              </strong>
            </span>
            {summary.checkinCount > 0 && (
              <span>
                {t("checkinsCount")}{" "}
                <strong className="font-medium text-foreground">
                  {summary.checkinCount}
                </strong>
              </span>
            )}
          </div>

          {summary.feelings.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {summary.feelings.map((item) => (
                <Badge key={item.feeling} variant="secondary" className="font-normal">
                  {feeling(item.feeling)}
                  <span className="ml-1.5 text-muted-foreground">×{item.count}</span>
                </Badge>
              ))}
            </div>
          )}

          {summary.moodTrend === "up" && (
            <p className="text-sm text-foreground/90">
              {t("trendUp")}
            </p>
          )}
          {summary.moodTrend === "down" && (
            <p className="text-sm text-foreground/90">
              {t("trendDown")}
            </p>
          )}
          {summary.moodTrend === "flat" && (
            <p className="text-sm text-muted-foreground">
              {t("trendFlat")}
            </p>
          )}

          {summary.themes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("themes")}
              </p>
              <ul className="flex flex-wrap gap-2">
                {summary.themes.map(({ tag, count }) => (
                  <li key={tag}>
                    <Badge variant="outline" className="font-normal">
                      {tag}
                      {count > 1 && (
                        <span className="ml-1.5 text-muted-foreground">
                          ×{count}
                        </span>
                      )}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.highlights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("keyMoments")}
              </p>
              <ul className="space-y-0 divide-y divide-border/70">
                {summary.highlights.map((highlight) => (
                  <li key={highlight.id} className="space-y-1.5 py-3">
                    <p className="text-sm font-medium text-foreground">
                      {formatDayLabel(highlight.date, locale)}
                      {highlight.feelingsLabel && (
                        <span className="ml-2 font-normal text-muted-foreground">
                          {labelFeelings(highlight.feelingsLabel, feeling)}
                        </span>
                      )}
                    </p>
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {highlight.excerpt}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-w-[12.5rem]"
              onClick={handleCopy}
              aria-live="polite"
            >
              {copyState === "ok"
                ? t("copied")
                : copyState === "fail"
                  ? t("copyFail")
                  : t("copySummary")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function labelFeelings(label: string, feeling: (value: Feeling) => string): string {
  return label
    .split(", ")
    .map((item) => (isFeeling(item) ? feeling(item) : item))
    .join(", ");
}

function copyText(
  summary: NonNullable<ReturnType<typeof buildPeriodSummary>>,
  sessionLabel: string,
  t: (key: MessageKey, vars?: Record<string, string | number | undefined>) => string,
  locale: string,
  feeling: (value: Feeling) => string,
): string {
  const lines: string[] = [t("afterSessionLead", { date: sessionLabel })];
  lines.push(`${t("entriesCount")} ${summary.entryCount}`);
  if (summary.checkinCount > 0) lines.push(`${t("checkinsCount")} ${summary.checkinCount}`);
  if (summary.feelings.length > 0) {
    lines.push(
      summary.feelings.map((item) => `${feeling(item.feeling)} ×${item.count}`).join(", "),
    );
  }
  if (summary.moodTrend === "up") lines.push(t("trendUp"));
  if (summary.moodTrend === "down") lines.push(t("trendDown"));
  if (summary.moodTrend === "flat") lines.push(t("trendFlat"));
  if (summary.themes.length > 0) {
    lines.push(
      `${t("themes")}: ${summary.themes
        .map((item) => (item.count > 1 ? `${item.tag} ×${item.count}` : item.tag))
        .join(", ")}`,
    );
  }
  if (summary.entries.length > 0) {
    lines.push(t("briefEntries"));
    for (const entry of summary.entries) {
      const names =
        entry.feelings.length > 0
          ? ` — ${entry.feelings.map((item) => feeling(item)).join(", ")}`
          : "";
      lines.push(`• ${formatDayLabel(entry.date, locale)}${names}`);
      for (const line of entry.body.trim().split("\n")) lines.push(`  ${line}`);
    }
  }
  return lines.join("\n");
}
