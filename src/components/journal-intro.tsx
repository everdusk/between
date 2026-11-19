"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useI18n } from "./locale-provider";
import { reflectionQuestion } from "./journal-explore";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  PICKER_FEELINGS,
  type CheckinSlot,
  type Feeling,
  type TherapyStore,
} from "@/lib/types";

export type IntroAnswers = {
  name: string;
  therapy: boolean;
  emotion: Feeling;
  when: CheckinSlot;
  thought: string;
};

export function ProfileEditor({
  profile,
  onSave,
}: {
  profile: TherapyStore["profile"];
  onSave: (name: string, therapy: boolean) => boolean;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(profile?.name ?? "");
  const [therapy, setTherapy] = useState(profile?.therapy ?? true);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(name, therapy);
      }}
    >
      <label className="block">
        {t("nameQuestion")}
        <Input
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block">
        {t("therapyQuestion")}
        <select
          className="mt-1 block w-full rounded-xl border border-input bg-background p-2"
          value={therapy ? "yes" : "no"}
          onChange={(e) => setTherapy(e.target.value === "yes")}
        >
          <option value="yes">{t("answerYes")}</option>
          <option value="no">{t("answerNo")}</option>
        </select>
      </label>
      <Button size="sm" type="submit">
        {t("saveSchedule")}
      </Button>
    </form>
  );
}

export function JournalIntro({
  onFinish,
  onLogin,
}: {
  onFinish: (answers: IntroAnswers) => void;
  onLogin: () => void;
}) {
  const { t, feeling, slot } = useI18n();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [therapy, setTherapy] = useState(false);
  const [emotion, setEmotion] = useState<Feeling>("спокойно");
  const [when, setWhen] = useState<CheckinSlot>("day");
  const [thought, setThought] = useState("");
  return (
    <section className="glass space-y-5 rounded-3xl p-6">
      <small>Between · {step + 1}/4</small>
      {step === 0 && (
        <>
          <h1 className="font-display text-2xl">{t("nameQuestion")}</h1>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setStep(1);
            }}
          >
            <Input
              aria-label={t("nameQuestion")}
              autoComplete="given-name"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              type="submit"
              disabled={!name.trim()}
              aria-label={t("feelingDone")}
            >
              <ArrowRight />
            </Button>
          </form>
        </>
      )}
      {step === 1 && (
        <>
          <h2 className="font-display text-xl">{t("therapyQuestion")}</h2>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <Button
                key={String(v)}
                variant="outline"
                onClick={() => {
                  setTherapy(v);
                  setStep(2);
                }}
              >
                {t(v ? "answerYes" : "answerNo")}
              </Button>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h2 className="font-display text-xl">{t("commonFeeling")}</h2>
          <div className="flex flex-wrap gap-2">
            {PICKER_FEELINGS.map((f) => (
              <Button
                key={f}
                variant={emotion === f ? "default" : "outline"}
                aria-pressed={emotion === f}
                onClick={() => setEmotion(f)}
              >
                {feeling(f)}
              </Button>
            ))}
          </div>
          <p>{t("usualTime")}</p>
          <div className="flex flex-wrap gap-2">
            {(["morning", "day", "evening"] as const).map((s) => (
              <Button
                key={s}
                aria-pressed={when === s}
                variant={when === s ? "secondary" : "outline"}
                onClick={() => setWhen(s)}
              >
                {slot(s)}
              </Button>
            ))}
          </div>
          <Button onClick={() => setStep(3)}>{t("feelingDone")}</Button>
        </>
      )}
      {step === 3 && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onFinish({ name, therapy, emotion, when, thought });
          }}
        >
          <label className="block font-medium">
            {t(reflectionQuestion(emotion))}
            <Textarea
              className="mt-3"
              value={thought}
              onChange={(e) => setThought(e.target.value)}
              maxLength={4000}
            />
          </label>
          <Button type="submit">{t("webCreate")}</Button>
        </form>
      )}
      <div className="flex justify-between">
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            ←
          </Button>
        )}
        <Button variant="ghost" onClick={onLogin}>
          {t("webEnter")}
        </Button>
      </div>
    </section>
  );
}

export function IntroResult({
  answers,
  onDone,
}: {
  answers: IntroAnswers;
  onDone: () => void;
}) {
  const { t, feeling, slot } = useI18n();
  return (
    <section className="glass mb-5 space-y-3 rounded-3xl p-5">
      <h2 className="font-display">
        {answers.name} · {slot(answers.when)} · {feeling(answers.emotion)}
      </h2>
      <p>{t(reflectionQuestion(answers.emotion))}</p>
      {answers.thought && (
        <blockquote className="border-s-2 border-primary ps-3">
          {answers.thought}
        </blockquote>
      )}
      <Button onClick={onDone}>{t("feelingDone")}</Button>
    </section>
  );
}
