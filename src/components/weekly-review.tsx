"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { FieldSelect } from "./ui/field-select";
import { useI18n } from "./locale-provider";
import { formatDayLabel, parseDateKey, weekKey } from "@/lib/dates";
import { requestBrief } from "@/lib/journal-api";
import { entriesForTheme, modelRequestStamp, visibleTopic } from "@/lib/themes";
import {
  checkInTopic,
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
  const answeredToday = themes.some((theme) =>
    theme.review?.some(
      (e) =>
        (e.kind === "still" || e.kind === "resolved") &&
        e.at.slice(0, 10) === today,
    ),
  );
  const due = live && !answeredToday ? checkInTopic(themes, today) : undefined;
  const facts = reviewFacts(entries, current, themes, links, due);
  const body = JSON.stringify(facts);
  const stamp = modelRequestStamp("review1", period + locale, 0, body);
  const [reply, setReply] = useState<{ stamp: string; text: string } | null>(
    null,
  );
  const [closing, setClosing] = useState("");
  const [retry, setRetry] = useState(0);
  const hasFacts = facts.notes.length > 0 || Boolean(due);
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
          (parsed.lines.length || parsed.changes.length || parsed.question)
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
  const checkQuestion =
    report?.question || (due ? t("reviewStill", { topic: due.title }) : "");
  return (
    <>
      {current.some((e) => e.body.trim()) && (
        <section className={section}>
          <h3 className="diary-card-title">{t("reviewWeek")}</h3>
          {report?.lines.map((row) => (
            <div key={row.entries.join() + row.text}>
              <p>{row.text}</p>
              <Sources notes={notes(row.entries)} />
            </div>
          ))}
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
      {due && (
        <section className={section}>
          <h3 className="diary-card-title">{t("reviewCheck")}</h3>
          <p>{checkQuestion}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                save(due.id, {
                  kind: "still",
                  id: crypto.randomUUID(),
                  at: new Date().toISOString(),
                })
              }
            >
              {t("answerYes")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-pressed={closing === due.id}
              onClick={() => setClosing(due.id)}
            >
              {t("answerNo")}
            </Button>
          </div>
          {closing === due.id && (
            <Answer
              key={due.id}
              question={t("reviewWhatChanged")}
              save={(text) =>
                save(due.id, {
                  id: crypto.randomUUID(),
                  kind: "resolved",
                  at: new Date().toISOString(),
                  question: checkQuestion,
                  text,
                })
              }
            />
          )}
        </section>
      )}
    </>
  );
}
