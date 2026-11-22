"use client";

import { useState } from "react";
import { useI18n } from "./locale-provider";
import { Button } from "./ui/button";
import { FieldSelect } from "./ui/field-select";
import { feelingFill } from "@/lib/spectrum";
import { Textarea } from "./ui/textarea";
import { formatDayLabel } from "@/lib/dates";
import { entriesForTheme } from "@/lib/themes";
import {
  PICKER_FEELINGS,
  type Feeling,
  type JournalEntry,
  type TherapyStore,
} from "@/lib/types";

export function reflectionQuestion(feeling: Feeling | "unsure") {
  switch (feeling) {
    case "злость":
      return "reflectAnger";
    case "спокойно":
      return "reflectCalm";
    case "радость":
      return "reflectJoy";
    case "тревожно":
      return "reflectWorry";
    case "стыд":
      return "reflectShame";
    case "грусть":
      return "reflectSad";
    case "напряжение":
      return "reflectTense";
    case "усталость":
      return "reflectTired";
    case "пусто":
      return "reflectEmpty";
    default:
      return "reflectPrompt";
  }
}

export function Connections({
  store,
  onReflect,
  onFeedback,
  onTopic,
}: {
  store: TherapyStore;
  onReflect: (id: string) => void;
  onFeedback: (id: string, response?: "familiar" | "hidden") => void;
  onTopic: (id: string) => void;
}) {
  const { t, feeling, locale, count } = useI18n();
  const groups = store.themes
    .filter((theme) => !theme.dismissed)
    .map((theme) => ({
      theme,
      notes: entriesForTheme(theme, store.entries, store.themeLinks).filter(
        (note) => note.body.trim(),
      ),
    }))
    .filter((group) => new Set(group.notes.map((note) => note.date)).size >= 2);
  if (!groups.length)
    return <p className="glass rounded-3xl p-6">{t("patternThin")}</p>;
  return (
    <div className="space-y-4">
      {groups.map(({ theme, notes }) => {
        if (theme.observation === "hidden")
          return (
            <Button
              key={theme.id}
              variant="ghost"
              onClick={() => onFeedback(theme.id)}
            >
              {t("undoChange")} · {theme.title}
            </Button>
          );
        const feelings = [...new Set(notes.flatMap((note) => note.feelings))];
        const lanes = feelings.map((emotion) => ({
          label: feeling(emotion),
          notes: notes.filter((note) => note.feelings.includes(emotion)),
        }));
        const unmarked = notes.filter((note) => !note.feelings.length);
        if (unmarked.length)
          lanes.push({ label: t("noteNoFeeling"), notes: unmarked });
        return (
          <section key={theme.id} className="glass space-y-4 rounded-3xl p-5">
            <p className="eyebrow">
              {t("backlogFromNotes")} · {count(notes.length, "note")}
            </p>
            <h2 className="font-display text-xl">{theme.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {lanes.map((lane) => (
                <details
                  key={lane.label}
                  open={lanes.length === 1 || undefined}
                  className="min-w-0 rounded-2xl border border-border bg-background/40 p-3"
                >
                  <summary className="cursor-pointer font-medium">
                    {lane.label} · {count(lane.notes.length, "note")}
                  </summary>
                  {lane.notes.map((note) => (
                    <article
                      key={note.id}
                      className="mt-2 border-t border-border pt-3"
                    >
                      <small>
                        {formatDayLabel(note.date, locale)} ·{" "}
                        {note.feelings.map(feeling).join(", ")}
                      </small>
                      <p className="my-2 whitespace-pre-wrap break-words">
                        {note.body}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onReflect(note.id)}
                      >
                        {t("deskReflection")}
                      </Button>
                    </article>
                  ))}
                </details>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={
                  theme.observation === "familiar" ? "secondary" : "outline"
                }
                aria-pressed={theme.observation === "familiar"}
                onClick={() =>
                  onFeedback(
                    theme.id,
                    theme.observation === "familiar" ? undefined : "familiar",
                  )
                }
              >
                {t("familiar")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => onFeedback(theme.id, "hidden")}
              >
                {t("hideObservation")}
              </Button>
              <Button variant="outline" onClick={() => onTopic(theme.id)}>
                {t(
                  store.profile?.therapy === false
                    ? "deskPersonal"
                    : "deskTherapy",
                )}
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

type Reflection = NonNullable<JournalEntry["reflection"]>;
export function ReflectionForm({
  entry,
  nearby,
  personal,
  onSave,
}: {
  entry: JournalEntry;
  nearby?: Feeling;
  personal: boolean;
  onSave: (id: string, reflection: Reflection, topic: boolean) => boolean;
}) {
  const { t, feeling } = useI18n();
  const linkedFeeling = entry.reflection?.feeling ?? entry.feelings[0] ?? nearby;
  const [picked, setPicked] = useState<Reflection["feeling"] | "">("");
  const emotion = linkedFeeling ?? picked;
  const [answer, setAnswer] = useState(entry.reflection?.answer ?? "");
  const previousInsight = entry.reflection?.insight ?? "";
  const [choose, setChoose] = useState(false);
  const [saved, setSaved] = useState(false);
  function save(topic: boolean) {
    if (
      emotion &&
      answer.trim() &&
      onSave(
        entry.id,
        { feeling: emotion, answer: answer.trim(), insight: previousInsight },
        topic,
      )
    ) {
      setChoose(false);
      setSaved(true);
    }
  }
  return (
    <form
      className="glass space-y-5 rounded-3xl p-5"
      onChange={() => setSaved(false)}
      onSubmit={(e) => {
        e.preventDefault();
        setChoose(true);
      }}
    >
      <p className="diary-quote whitespace-pre-wrap break-words">
        {entry.body}
      </p>
      {linkedFeeling ? (
        <p className="text-sm text-muted-foreground">
          {linkedFeeling === "unsure" ? t("unsure") : feeling(linkedFeeling)}
        </p>
      ) : <div>
        <FieldSelect<Reflection["feeling"] | ""> label={t("feelingsGroup")} showLabel required value={emotion} onChange={setPicked}
          options={[{ value: "", label: "—" }, ...[...new Set<Feeling>([...PICKER_FEELINGS, ...entry.feelings])].map(f => ({
            value: f, label: feeling(f), color: feelingFill(f),
          })), { value: "unsure", label: t("unsure") }]} />
      </div>}
      {emotion && (
        <>
          <label className="block font-medium">
            {t(reflectionQuestion(emotion))}
            <Textarea
              required
              className="mt-2"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </label>
          {previousInsight && (
            <details className="text-sm">
              <summary>{t("insights")}</summary>
              <p className="mt-2 whitespace-pre-wrap">{previousInsight}</p>
            </details>
          )}
          <Button type="submit" disabled={!answer.trim() || saved}>
            {saved ? t("saved") : t("saveEntry")}
          </Button>
        </>
      )}
      {choose && (
        <dialog
          ref={(d) => {
            if (d && !d.open) d.showModal();
          }}
          onCancel={() => setChoose(false)}
          className="m-auto max-w-[90vw] space-y-4 rounded-3xl border border-border bg-popover p-6 text-foreground backdrop:bg-black/50"
        >
          <h2 className="font-display">
            {t(personal ? "deskPersonal" : "deskTherapy")}?
          </h2>
          <div className="flex gap-2">
            <Button data-confirm="" type="button" onClick={() => save(true)}>
              {t("backlogAdd")}
            </Button>
            <Button data-confirm="" type="button" onClick={() => save(false)}>
              {t("saveEntry")}
            </Button>
          </div>
        </dialog>
      )}
    </form>
  );
}

export function ReflectionPanel({
  store,
  selected,
  onSelect,
  onSave,
}: {
  store: TherapyStore;
  selected: string;
  onSelect: (id: string) => void;
  onSave: (id: string, reflection: Reflection, topic: boolean) => boolean;
}) {
  const { t, locale } = useI18n();
  const notes = store.entries
    .filter((n) => n.body.trim())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const entry = notes.find((n) => n.id === selected) ?? notes[0];
  if (!entry) return <p className="glass rounded-3xl p-5">{t("dayEmpty")}</p>;
  const at = Date.parse(entry.createdAt);
  const distance = (n: JournalEntry) => Math.abs(Date.parse(n.createdAt) - at);
  const close = store.entries
    .filter(
      (n) =>
        n.id !== entry.id &&
        !n.body.trim() &&
        n.date === entry.date &&
        n.feelings.length &&
        distance(n) <= 30 * 60000,
    )
    .sort((a, b) => distance(a) - distance(b));
  const nearby = new Set(
    close
      .filter((n) => distance(n) === distance(close[0]))
      .flatMap((n) => n.feelings),
  );
  return (
    <div className="space-y-4">
      <FieldSelect label={t("note")} triggerClassName="field-select-trigger w-full" value={entry.id} onChange={onSelect}
        options={notes.map(n => ({ value: n.id, label: `${formatDayLabel(n.date, locale)} · ${n.body.slice(0, 64)}` }))} />
      <ReflectionForm
        key={entry.id}
        entry={entry}
        nearby={nearby.size === 1 ? [...nearby][0] : undefined}
        personal={store.profile?.therapy === false}
        onSave={onSave}
      />
    </div>
  );
}
