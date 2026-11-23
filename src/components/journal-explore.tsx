"use client";

import { useState } from "react";
import { useI18n } from "./locale-provider";
import { Button } from "./ui/button";
import { FieldSelect } from "./ui/field-select";
import { Textarea } from "./ui/textarea";
import { formatDayLabel } from "@/lib/dates";
import {
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

type Reflection = NonNullable<JournalEntry["reflection"]>;
export function ReflectionForm({
  entry,
  personal,
  onSave,
}: {
  entry: JournalEntry;
  personal: boolean;
  onSave: (id: string, reflection: Reflection, topic: boolean) => boolean;
}) {
  const { t, feeling } = useI18n();
  const emotion = entry.feelings[0] ?? "unsure";
  const [answer, setAnswer] = useState(entry.reflection?.answer ?? "");
  const previousInsight = entry.reflection?.insight ?? "";
  const [choose, setChoose] = useState(false);
  const [saved, setSaved] = useState(false);
  function save(topic: boolean) {
    if (
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
      {entry.feelings.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {entry.feelings.map(feeling).join(", ")}
        </p>
      )}
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
  return (
    <div className="space-y-4">
      <FieldSelect label={t("note")} triggerClassName="field-select-trigger w-full" value={entry.id} onChange={onSelect}
        options={notes.map(n => ({ value: n.id, label: `${formatDayLabel(n.date, locale)} · ${n.body.slice(0, 64)}` }))} />
      <ReflectionForm
        key={entry.id}
        entry={entry}
        personal={store.profile?.therapy === false}
        onSave={onSave}
      />
    </div>
  );
}
