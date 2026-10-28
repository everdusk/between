"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeDateInput } from "@/components/theme-date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/locale-provider";
import { SessionRhythm } from "@/components/session-rhythm";
import { dateKeysBetween, formatDayLabel, formatLongDate, toDateKey } from "@/lib/dates";
import { clockLabel, nextWeeklyOccurrence, onceSessionDate } from "@/lib/session-plan";
import type { NotifyPrefs, SessionNote, SessionPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SessionsPanelProps {
  sessions: SessionNote[];
  plan: SessionPlan | null;
  notify: NotifyPrefs;
  onSave: (input: {
    id?: string;
    date: string;
    summary: string;
    insights: string;
    homework: string;
  }) => boolean;
  onDelete: (id: string) => boolean;
  onSavePlan: (plan: Omit<SessionPlan, "updatedAt">) => boolean;
  onSaveNotify: (prefs: Pick<NotifyPrefs, "moodPolls" | "eveningNudge">) => boolean;
  disabled?: boolean;
}

const emptyForm = () => ({
  date: toDateKey(),
  summary: "",
  insights: "",
  homework: "",
});

/** The next meeting that has not happened yet, or null. */
function upcomingSession(plan: SessionPlan | null, now: Date): Date | null {
  if (!plan) return null;
  if (plan.mode === "once") {
    const at = onceSessionDate(plan);
    return at && at.getTime() >= now.getTime() ? at : null;
  }
  return nextWeeklyOccurrence(plan, now);
}

export function SessionsPanel({
  sessions,
  plan,
  notify,
  onSave,
  onDelete,
  onSavePlan,
  onSaveNotify,
  disabled,
}: SessionsPanelProps) {
  const { t, locale, count } = useI18n();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [savedFlash, setSavedFlash] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(
    sessions[0]?.id ?? null,
  );

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const [now, setNow] = useState(() => new Date());
  const todayKey = toDateKey(now);
  const upcoming = upcomingSession(plan, now);
  const upcomingAt = upcoming?.getTime() ?? null;
  useEffect(() => {
    if (upcomingAt === null) return;
    const delay = upcomingAt - Date.now() + 1000;
    if (delay <= 0 || delay > 8 * 24 * 60 * 60 * 1000) return;
    const timer = window.setTimeout(() => setNow(new Date()), delay);
    return () => window.clearTimeout(timer);
  }, [upcomingAt]);
  const upcomingKey = upcoming ? toDateKey(upcoming) : null;
  const daysUntil = upcomingKey ? dateKeysBetween(todayKey, upcomingKey).length - 1 : null;

  function startNew() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function startEdit(session: SessionNote) {
    setEditingId(session.id);
    setForm({
      date: session.date,
      summary: session.summary,
      insights: session.insights,
      homework: session.homework,
    });
    document.getElementById("session-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = onSave({
      id: editingId ?? undefined,
      date: form.date,
      summary: form.summary.trim(),
      insights: form.insights.trim(),
      homework: form.homework.trim(),
    });
    if (ok) {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
      if (!editingId) startNew();
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 px-2 pt-1 pb-1">
        <p className="eyebrow text-section-header">{t("sessionsTitle")}</p>
      </div>

      <section className="ink relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -end-16 size-64 rounded-full bg-ink-foreground/[0.07] blur-2xl"
        />
        <div className="relative">
          <p className="eyebrow text-ink-muted">{t("nextSession")}</p>
          {upcoming && upcomingKey ? (
            <>
              <p className="mt-3 font-display text-[2.125rem] leading-[1.05] tracking-tight text-ink-foreground sm:text-[2.5rem]">
                {formatDayLabel(upcomingKey, locale)}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="tabular inline-flex h-8 items-center rounded-full bg-ink-foreground/12 px-3 text-sm font-medium text-ink-foreground">
                  {clockLabel(upcoming)}
                </span>
                <span className="inline-flex h-8 items-center rounded-full border border-ink-foreground/15 px-3 text-sm text-ink-muted">
                  {daysUntil === 0
                    ? t("todayTitle")
                    : t("inDays", { days: count(daysUntil ?? 0, "day") })}
                </span>
              </div>
            </>
          ) : (
            <p className="mt-3 font-display text-[1.75rem] leading-snug tracking-tight text-ink-foreground">
              {t("noSchedule")}
            </p>
          )}
        </div>
      </section>

      <SessionRhythm
        plan={plan}
        notify={notify}
        onSavePlan={onSavePlan}
        onSaveNotify={onSaveNotify}
        disabled={disabled}
      />

      <section id="session-form" className="glass scroll-mt-4 rounded-3xl p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl tracking-tight text-foreground">
              {editingId ? t("updateSession") : t("saveSession")}
            </h3>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={startNew}>
                <Plus aria-hidden />
                {t("newEntry")}
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <Label htmlFor="session-date">{t("sessionDate")}</Label>
            <ThemeDateInput
              id="session-date"
              type="date"
              display={formatLongDate(form.date, locale)}
              value={form.date}
              max={toDateKey()}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.value) setForm((f) => ({ ...f, date: e.target.value }));
              }}
              required
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="session-summary">{t("discussed")}</Label>
            <Textarea
              id="session-summary"
              value={form.summary}
              disabled={disabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, summary: e.target.value }))
              }
              placeholder={t("discussedPlaceholder")}
              className="min-h-28 resize-none"
              required
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="session-insights">{t("insights")}</Label>
            <Textarea
              id="session-insights"
              value={form.insights}
              disabled={disabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, insights: e.target.value }))
              }
              placeholder={t("insightsPlaceholder")}
              className="min-h-20 resize-none"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="session-homework">{t("homework")}</Label>
            <Textarea
              id="session-homework"
              value={form.homework}
              disabled={disabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, homework: e.target.value }))
              }
              placeholder={t("homeworkPlaceholder")}
              className="min-h-20 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="submit"
              size="lg"
              className="flex-1"
              disabled={disabled || !form.summary.trim()}
            >
              {editingId ? t("updateSession") : t("saveSession")}
            </Button>
            {savedFlash && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary animate-in fade-in zoom-in-95 duration-300">
                <Check aria-hidden className="size-4" />
                {t("saved")}
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-3 px-1 pt-2">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h3 className="font-display text-xl tracking-tight text-foreground">
            {t("pastSessions")}
          </h3>
          {sorted.length > 0 && (
            <span className="tabular text-xs text-muted-foreground">{sorted.length}</span>
          )}
        </div>
        {sorted.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-[color:var(--glass-border)] px-5 py-6 text-center text-sm text-muted-foreground">
            {t("noSessions")}
          </p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((session) => {
              const open = expandedId === session.id;
              return (
                <li
                  key={session.id}
                  className={cn(
                    "glass overflow-hidden rounded-3xl transition-shadow",
                    editingId === session.id && "ring-2 ring-primary/30",
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-foreground/[0.03] focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none focus-visible:ring-inset"
                    onClick={() =>
                      setExpandedId(open ? null : session.id)
                    }
                    aria-expanded={open}
                  >
                    <span className="font-display text-lg tracking-tight text-foreground">
                      {formatLongDate(session.date, locale)}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="hidden sm:inline">{open ? t("collapse") : t("expand")}</span>
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "size-4 transition-transform duration-300",
                          open && "rotate-180",
                        )}
                      />
                    </span>
                  </button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-300 ease-out",
                      open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-4 border-t border-[color:var(--glass-border)] px-5 py-5 text-sm leading-relaxed">
                        <div>
                          <p className="eyebrow mb-2 text-section-header">
                            {t("discussedShort")}
                          </p>
                          <p className="whitespace-pre-wrap break-words text-foreground/90">
                            {session.summary}
                          </p>
                        </div>
                        {session.insights && (
                          <div>
                            <p className="eyebrow mb-2 text-section-header">
                              {t("insightsShort")}
                            </p>
                            <p className="whitespace-pre-wrap break-words text-foreground/90">
                              {session.insights}
                            </p>
                          </div>
                        )}
                        {session.homework && (
                          <div className="rounded-2xl bg-primary/[0.07] px-4 py-3.5">
                            <p className="eyebrow mb-2 text-accent-text">
                              {t("nextShort")}
                            </p>
                            <p className="whitespace-pre-wrap break-words text-foreground/90">
                              {session.homework}
                            </p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={disabled}
                            onClick={() => startEdit(session)}
                          >
                            <Pencil aria-hidden />
                            {t("edit")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={disabled}
                            onClick={() => onDelete(session.id)}
                          >
                            <Trash2 aria-hidden />
                            {t("delete")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
