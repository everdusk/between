"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { FieldSelect } from "./ui/field-select";
import { useI18n } from "./locale-provider";
import { formatDayLabel, formatTime, parseDateKey, weekKey } from "@/lib/dates";
import { feelingFill } from "@/lib/spectrum";
import { requestBrief } from "@/lib/journal-api";
import { entriesForTheme, modelRequestStamp, visibleTopic } from "@/lib/themes";
import {
  readReview,
  reviewFacts,
  type ReviewEvent,
} from "@/lib/theme-review";
import type { JournalEntry, SessionTheme, ThemeLink } from "@/lib/types";

export type SaveReview = (id: string, event: ReviewEvent) => boolean;

function Sources({ notes }: { notes: JournalEntry[] }) {
  const { locale } = useI18n();
  return notes.map((n) => (
    <details key={n.id} className="mt-2 text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        {formatDayLabel(n.date, locale)} · {n.body.slice(0, 55)}
      </summary>
      <p className="diary-quote mt-2 whitespace-pre-wrap">{n.body}</p>
      {n.reflection && (
        <p className="mt-2 whitespace-pre-wrap">
          {[n.reflection.answer, n.reflection.insight]
            .filter(Boolean)
            .join("\n")}
        </p>
      )}
    </details>
  ));
}

function WeekObservation({ text, notes }: { text: string; notes: JournalEntry[] }) {
  const { count, locale, feeling } = useI18n();
  const moods = [...new Set(notes.flatMap(note => note.feelings))];
  return (
    <details className="group py-1">
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl px-2 py-3 text-start focus-visible:ring-4 focus-visible:ring-ring/25 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block leading-relaxed">{text}</span>
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {moods.length ? (
              <span className="inline-flex gap-0.5" title={moods.map(feeling).join(", ")}>
                {moods.map(f => (
                  <span key={f} aria-hidden className="h-2 w-1.5 rounded-full" style={{ backgroundColor: feelingFill(f) }} />
                ))}
              </span>
            ) : <BookOpen aria-hidden className="size-3.5" />}
            {count(notes.length, "note")}
          </span>
        </span>
        <ChevronDown aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground motion-safe:transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mx-2 mb-3 space-y-4 rounded-2xl bg-foreground/[0.04] p-4">
        {notes.map(note => (
          <li key={note.id} className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{formatDayLabel(note.date, locale)} · {formatTime(note.createdAt, locale)}</span>
              {note.feelings.map(f => (
                <span key={f} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: feelingFill(f) }} />
                  {feeling(f)}
                </span>
              ))}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.body}</p>
            {(note.reflection?.answer || note.reflection?.insight) && (
              <p className="diary-quote whitespace-pre-wrap text-sm">
                {[note.reflection.answer, note.reflection.insight].filter(Boolean).join("\n")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Answer({
  question,
  save,
}: {
  question: string;
  save: (text: string) => boolean;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() && save(text.trim())) setText("");
      }}
    >
      <label className="block space-y-2">
        <span>{question}</span>
        <Textarea
          value={text}
          maxLength={4000}
          required
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <Button type="submit" size="sm" disabled={!text.trim()}>
        {t("saveSession")}
      </Button>
    </form>
  );
}

export function ThemeReflection({
  themes,
  entries,
  links,
  selected,
  onSelect,
  save,
}: {
  themes: SessionTheme[];
  entries: JournalEntry[];
  links: ThemeLink[];
  selected: string;
  onSelect: (id: string) => void;
  save: SaveReview;
}) {
  const { t, locale } = useI18n();
  const topics = themes
    .filter(visibleTopic)
    .sort(
      (a, b) =>
        Number(a.dismissed) - Number(b.dismissed) ||
        b.lastSeen.localeCompare(a.lastSeen),
    );
  const theme = topics.find((t) => t.id === selected) ?? topics[0];
  if (!theme)
    return <p className="glass rounded-3xl p-5">{t("reviewNoTopics")}</p>;
  const question = t("reviewThought");
  return (
    <section className="glass space-y-4 rounded-3xl p-5 [overflow-wrap:anywhere]">
      <FieldSelect
        label={t("themes")}
        triggerClassName="field-select-trigger w-full"
        value={theme.id}
        onChange={onSelect}
        options={topics.map((row) => ({ value: row.id, label: row.title }))}
      />
      <Sources notes={entriesForTheme(theme, entries, links)} />
      {(theme.review ?? [])
        .filter((e) => e.text)
        .map((e) => (
          <div key={e.id} className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              {formatDayLabel(e.at.slice(0, 10), locale)} ·{" "}
              {e.question || theme.title}
            </p>
            <p className="whitespace-pre-wrap">{e.text}</p>
            {(e.entryId || e.beforeId) && (
              <Sources
                notes={entries.filter(
                  (n) => n.id === e.entryId || n.id === e.beforeId,
                )}
              />
            )}
          </div>
        ))}
      <Answer
        key={theme.id}
        question={question}
        save={(text) =>
          save(theme.id, {
            id: crypto.randomUUID(),
            kind: "note",
            at: new Date().toISOString(),
            question,
            text,
          })
        }
      />
    </section>
  );
}

type ReviewProps = {
  entries: JournalEntry[];
  current: JournalEntry[];
  themes: SessionTheme[];
  links: ThemeLink[];
  saved?: { stamp: string; text: string };
  saveSummary: (
    key: string,
    text: string,
    stamp: string,
    pilot: boolean,
  ) => boolean;
  today: string;
  live: boolean;
  initData: string;
  maxInitData: string;
  save: SaveReview;
  period: string;
};

export function WeeklyReview({
  entries,
  current,
  themes,
  links,
  today,
  live,
  initData,
  maxInitData,
  save,
  period,
  saved,
  saveSummary,
}: ReviewProps) {
  const { locale, t } = useI18n();
  const facts = reviewFacts(entries, current, themes, links);
  const body = JSON.stringify(facts);
  const stamp = modelRequestStamp("review1", period + locale, 0, body);
  const [reply, setReply] = useState<{ stamp: string; text: string } | null>(
    null,
  );
  const [retry, setRetry] = useState(0);
  const hasFacts = facts.notes.length > 0;
  useEffect(() => {
    if (!hasFacts || saved?.stamp === stamp) return;
    let alive = true;
    const timer = setTimeout(() => {
      void requestBrief(
        initData,
        body,
        stamp,
        locale,
        "review",
        maxInitData,
      ).then((result) => {
        if (!alive) return;
        const text = result.ok ? (result.text ?? "") : "";
        const parsed = readReview(text, JSON.parse(body));
        if (
          parsed &&
          (parsed.lines.length || parsed.changes.length)
        ) {
          saveSummary(period, JSON.stringify(parsed), stamp, true);
        }
        setReply({ stamp, text });
      });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [
    body,
    stamp,
    hasFacts,
    initData,
    locale,
    maxInitData,
    retry,
    period,
    saveSummary,
    saved?.stamp,
  ]);
  const resultText =
    saved?.stamp === stamp
      ? saved.text
      : reply?.stamp === stamp
        ? reply.text
        : null;
  const settled = resultText !== null;
  const report = settled ? readReview(resultText, facts) : null;
  const notes = (ids: string[]) =>
    ids.flatMap((id) => entries.find((n) => n.id === id) ?? []);
  const section = "glass space-y-3 rounded-3xl p-5 [overflow-wrap:anywhere]";
  const savedChanges = themes.flatMap((theme) =>
    (theme.review ?? [])
      .filter(
        (e) =>
          e.kind === "observed" &&
          e.beforeId &&
          e.entryId &&
          current.some((n) => n.id === e.entryId),
      )
      .map((e) => ({
        theme: theme.id,
        before: e.beforeId!,
        after: e.entryId!,
        text: e.text!,
        question: e.question!,
      })),
  );
  const changes = [
    ...new Map(
      [...savedChanges, ...(report?.changes ?? [])].map((c) => [
        c.theme + ":" + c.before + ":" + c.after,
        c,
      ]),
    ).values(),
  ].filter((c) => {
    const after = entries.find((e) => e.id === c.after);
    return (
      after &&
      entries.some((e) => e.id === c.before) &&
      (!live ||
        weekKey(parseDateKey(after.date)) === weekKey(parseDateKey(today)))
    );
  });
  useEffect(() => {
    if (!resultText) return;
    const observed = readReview(resultText, JSON.parse(body))?.changes ?? [];
    for (const c of observed) {
      const id = "observed:" + c.before + ":" + c.after;
      if (
        themes.find((t) => t.id === c.theme)?.review?.some((e) => e.id === id)
      )
        continue;
      save(c.theme, {
        id,
        kind: "observed",
        at: new Date().toISOString(),
        entryId: c.after,
        beforeId: c.before,
        question: c.question,
        text: c.text,
      });
    }
  }, [resultText, body, save, themes]);
  const returned = themes.flatMap((theme) =>
    (theme.review ?? [])
      .filter(
        (e) => e.kind === "returned" && current.some((n) => n.id === e.entryId),
      )
      .map((event) => ({ theme, event })),
  );
  return (
    <>
      {current.some((e) => e.body.trim()) && (
        <section className={section}>
          <h3 className="diary-card-title">{t("reviewWeek")}</h3>
          {report && report.lines.length > 0 && (
            <div className="divide-y divide-[color:var(--glass-border)] border-t border-[color:var(--glass-border)]">
              {report.lines.map(row => (
                <WeekObservation key={row.entries.join() + row.text} text={row.text} notes={notes(row.entries)} />
              ))}
            </div>
          )}
          {!settled && <p role="status">{t("formulating")}</p>}
          {settled && !report?.lines.length && (
            <Button variant="ghost" onClick={() => setRetry((n) => n + 1)}>
              {t("accessRetry")}
            </Button>
          )}
        </section>
      )}
      {changes.map((c) => {
        const theme = themes.find((t) => t.id === c.theme);
        const id = "change:" + c.before + ":" + c.after;
        if (!theme || theme.review?.some((e) => e.id === id)) return null;
        return (
          <section key={theme.id + id} className={section}>
            <header className="flex items-center justify-between">
              <h3 className="diary-card-title">{t("reviewChange")}</h3>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("reviewSeen")}
                onClick={() =>
                  save(theme.id, {
                    id,
                    kind: "seen",
                    at: new Date().toISOString(),
                    entryId: c.after,
                  })
                }
              >
                <Check />
              </Button>
            </header>
            <p>{c.text}</p>
            <Sources notes={notes([c.before, c.after])} />
            <Answer
              question={c.question}
              save={(text) =>
                save(theme.id, {
                  kind: "note",
                  id,
                  at: new Date().toISOString(),
                  entryId: c.after,
                  question: c.question,
                  text,
                })
              }
            />
          </section>
        );
      })}
      {returned.map(({ theme, event }) => (
        <section key={event.id} className={section}>
          <h3 className="diary-card-title">
            {t("reviewReturned", { topic: theme.title })}
          </h3>
          {event.text && (
            <>
              <p>{t("reviewPreviously")}</p>
              <p className="diary-quote">{event.text}</p>
            </>
          )}
          <Sources notes={notes(event.entryId ? [event.entryId] : [])} />
        </section>
      ))}
    </>
  );
}
