"use client";

import { useState } from "react";
import { ArrowRight, Check, Moon, Sun, Sunrise } from "lucide-react";
import { useI18n } from "./locale-provider";
import {
  branchQuestions,
  observations,
  questions,
  type SurveyFeeling,
} from "@/lib/intro-questions";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  PICKER_FEELINGS,
  type CheckinSlot,
  type TherapyStore,
} from "@/lib/types";

const slots = ["morning", "day", "evening"] as const;
const periodIcons = { morning: Sunrise, day: Sun, evening: Moon };
type DayAnswers = Record<
  CheckinSlot,
  (SurveyFeeling | "varies" | "unnoticed")[]
>;
type Exploration = {
  feeling: SurveyFeeling;
  choices: number[];
};
export type IntroAnswers = {
  id: string;
  name: string;
  therapy: boolean;
  day: DayAnswers;
  explorations: Exploration[];
  thought: string;
};

function firstNote(f: SurveyFeeling | undefined, en: boolean) {
  const prompts = {
    злость: [
      "Вспомните последний такой момент. Что хотелось сказать или сделать?",
      "Think of the last time this happened. What did you want to say or do?",
    ],
    тревожно: [
      "Какая мысль возвращалась в последний раз, когда вы тревожились?",
      "Which thought kept returning the last time you felt anxious?",
    ],
    усталость: [
      "Когда в последний раз вы заметили, что пора отдохнуть? Что сделали дальше?",
      "When did you last notice you needed a break? What did you do next?",
    ],
    грусть: [
      "Вспомните один грустный момент. Чего тогда хотелось?",
      "Think of one sad moment. What did you want then?",
    ],
    стыд: [
      "Что из последнего такого эпизода осталось с вами?",
      "What stayed with you after the last moment like this?",
    ],
    пусто: [
      "Когда ощущение пустоты в последний раз хоть немного изменилось?",
      "When did that empty feeling last shift, even a little?",
    ],
    напряжение: [
      "Когда вы в последний раз заметили напряжение? Что происходило вокруг?",
      "When did you last notice tension? What was going on around you?",
    ],
    спокойно: [
      "Какой спокойный момент этой недели хочется запомнить?",
      "Which calm moment from this week would you like to remember?",
    ],
    радость: [
      "Что произошло в один из радостных моментов этой недели?",
      "What happened in one of this week's joyful moments?",
    ],
  };
  return f
    ? prompts[f][en ? 1 : 0]
    : en
      ? "Which moment from this week would you like to remember?"
      : "Какой момент этой недели вам хочется запомнить?";
}

export function ProfileEditor({
  profile,
  onSave,
}: {
  profile: TherapyStore["profile"];
  onSave: (name: string, therapy: boolean) => boolean;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"saved" | "storageWrite" | null>(
    null,
  );
  const name = draft ?? profile?.name ?? "";
  const therapy = profile?.therapy ?? true;
  function save(nextTherapy: boolean) {
    const saved = onSave(name, nextTherapy);
    if (saved) setDraft(null);
    setFeedback(saved ? "saved" : "storageWrite");
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save(therapy);
      }}
    >
      <label className="block">
        {t("nameQuestion")}
        <Input
          value={name}
          maxLength={60}
          onChange={(e) => {
            setDraft(e.target.value);
            setFeedback(null);
          }}
        />
      </label>
      <label className="block">
        {t("therapyQuestion")}
        <select
          className="mt-1 block w-full rounded-xl border border-input bg-background p-2"
          value={therapy ? "yes" : "no"}
          onChange={(e) => save(e.target.value === "yes")}
        >
          <option value="yes">{t("answerYes")}</option>
          <option value="no">{t("answerNo")}</option>
        </select>
      </label>
      <Button size="sm" type="submit" disabled={draft === null}>
        {t("saveSchedule")}
      </Button>
      <span
        role="status"
        className="ms-3 inline-flex items-center gap-1.5 text-sm font-medium"
      >
        {feedback === "saved" && (
          <Check aria-hidden className="size-4 text-primary" />
        )}
        {feedback && t(feedback)}
      </span>
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
  const { t, locale, feeling, slot } = useI18n();
  const en = locale === "en";
  const lang = en ? 1 : 0;
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [therapy, setTherapy] = useState(-1);
  const [age, setAge] = useState("");
  const [day, setDay] = useState<DayAnswers>({
    morning: [],
    day: [],
    evening: [],
  });
  const [focus, setFocus] = useState<SurveyFeeling>();
  const [choices, setChoices] = useState<number[]>([]);
  const [previous, setPrevious] = useState<Exploration>();
  const [thought, setThought] = useState("");
  const period = slots[step - 3];
  const picked = [...new Set(slots.flatMap((s) => day[s]))].filter(
    (f): f is SurveyFeeling => f !== "varies" && f !== "unnoticed",
  );
  const active = focus ? branchQuestions(focus, choices[0], choices[1]) : [];
  const branchIndex = step - 7;
  const question = questions[active[branchIndex]];
  const times = focus
    ? slots
        .filter((s) => day[s].includes(focus))
        .map(slot)
        .join(", ")
    : "";
  const current = focus ? { feeling: focus, choices } : undefined;
  function startBranch(f: SurveyFeeling) {
    setFocus(f);
    setChoices([]);
    setThought("");
    setStep(7);
  }
  function toggle(value: DayAnswers[CheckinSlot][number]) {
    const list = day[period];
    const moods = list.filter((v) => v !== "varies" && v !== "unnoticed");
    const next = list.includes(value)
      ? list.filter((v) => v !== value)
      : value === "varies" || value === "unnoticed"
        ? [value]
        : [...moods, value];
    setDay({ ...day, [period]: next });
    setFocus(undefined);
    setPrevious(undefined);
    setChoices([]);
    setThought("");
  }
  function back() {
    if (step === 11 && !focus) setStep(5);
    else if (step === 7 && previous) {
      setFocus(previous.feeling);
      setChoices(previous.choices);
      setPrevious(undefined);
      setStep(10);
    } else if (step === 11 && (previous || picked.length === 1)) setStep(9);
    else setStep(step - 1);
  }
  const nextButton = (action: () => void, disabled = false) => (
    <Button type="button" onClick={action} disabled={disabled}>
      {en ? "Continue" : "Дальше"}
    </Button>
  );
  const option = (
    label: string,
    selected: boolean,
    click: () => void,
    disabled = false,
  ) => (
    <Button
      key={label}
      type="button"
      className="h-auto min-h-10 max-w-full whitespace-normal text-start"
      variant={selected ? "default" : "outline"}
      aria-pressed={selected}
      onClick={click}
      disabled={disabled}
    >
      {label}
    </Button>
  );
  const heading = (text: string) => (
    <h2 className="font-display text-xl">{text}</h2>
  );
  return (
    <section className="glass space-y-5 rounded-3xl p-6">
      <small>
        Between ·{" "}
        {step < 3
          ? en
            ? "Getting to know you"
            : "Знакомство"
          : step < 6
            ? en
              ? "Your week"
              : "Ваша неделя"
            : en
              ? "A closer look"
              : "Подробнее о вас"}
      </small>
      {step === 0 && (
        <>
          <h1 className="font-display text-2xl">{t("nameQuestion")}</h1>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) setStep(1);
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
          {heading(t("therapyQuestion"))}
          <div className="flex flex-wrap gap-2">
            {(en
              ? ["Yes, regularly", "Just starting", "Taking a break", "No"]
              : ["Да, регулярно", "Только начинаю", "Сейчас на паузе", "Нет"]
            ).map((label, i) =>
              option(label, therapy === i, () => {
                setTherapy(i);
                setStep(2);
              }),
            )}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          {heading(en ? "How old are you?" : "Сколько вам лет?")}
          <div className="flex flex-wrap gap-2">
            {[
              "18–24",
              "25–34",
              "35–44",
              "45–54",
              "55–64",
              "65+",
              en ? "Skip" : "Пропустить",
            ].map((a) =>
              option(a, age === a, () => {
                setAge(a);
                setStep(3);
              }),
            )}
          </div>
        </>
      )}
      {period && (
        <>
          <ol className="grid grid-cols-3 gap-2" aria-label={en ? "Time of day" : "Время дня"}>
            {slots.map((s) => {
              const Icon = periodIcons[s];
              return (
                <li key={s} aria-current={s === period ? "step" : undefined}
                  className="flex items-center justify-center gap-1 border-b-2 border-border pb-2 text-xs capitalize text-muted-foreground aria-[current=step]:border-primary aria-[current=step]:font-bold aria-[current=step]:text-foreground">
                  <Icon aria-hidden="true" size={16} />{slot(s)}
                </li>
              );
            })}
          </ol>
          <div aria-live="polite" aria-atomic="true">
            <h2 className="font-display text-3xl capitalize">{slot(period)}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {en
              ? "Think back over the past seven days. Which feelings came up most often? Choose up to two."
              : "Вспомните последние семь дней. Какие чувства вы чаще замечали в это время? Выберите до двух."}
          </p>
          <div className="flex flex-wrap gap-2">
            {PICKER_FEELINGS.map((f) =>
              option(
                feeling(f),
                day[period].includes(f),
                () => toggle(f),
                day[period].length === 2 && !day[period].includes(f),
              ),
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {option(
              en ? "It varies from day to day" : "Каждый день по-разному",
              day[period].includes("varies"),
              () => toggle("varies"),
            )}
            {option(
              en ? "I haven't noticed" : "Пока не замечал",
              day[period].includes("unnoticed"),
              () => toggle("unnoticed"),
            )}
          </div>
          <Button type="button" disabled={!day[period].length}
            onClick={() => setStep(step === 5 && !picked.length ? 11 : step + 1)}>
            {period === "morning" ? (en ? "Next: afternoon" : "Дальше — день")
              : period === "day" ? (en ? "Next: evening" : "Дальше — вечер")
              : (en ? "Continue" : "Дальше")}
          </Button>
        </>
      )}
      {step === 6 && (
        <>
          {heading(
            en
              ? "Which feeling would you like to explore?"
              : "На каком чувстве хочется остановиться подробнее?",
          )}
          <div className="flex flex-wrap gap-2">
            {picked.map((f) =>
              option(feeling(f), focus === f, () => startBranch(f)),
            )}
          </div>
        </>
      )}
      {question && focus && (
        <>
          <p className="text-sm text-muted-foreground">
            {feeling(focus)} · {times}
          </p>
          {heading(question.title[lang])}
          <div className="flex flex-col items-start gap-2">
            {question.options.map((o, i) =>
              option(o[lang], choices[branchIndex] === i, () => {
                if (choices[branchIndex] !== i) {
                  setChoices([...choices.slice(0, branchIndex), i]);
                  setThought("");
                }
                setStep(step === 9 && (previous || picked.length === 1) ? 11 : step + 1);
              }),
            )}
          </div>
        </>
      )}
      {step === 10 && (
        <>
          {heading(
            en
              ? "Explore another feeling?"
              : "Хотите уточнить ещё одно чувство?",
          )}
          {!previous && (
            <div className="flex flex-wrap gap-2">
              {picked
                .filter((f) => f !== focus)
                .map((f) =>
                  option(feeling(f), false, () => {
                    setPrevious(current);
                    startBranch(f);
                  }),
                )}
            </div>
          )}
          {nextButton(() => setStep(11))}
        </>
      )}
      {step === 11 && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onFinish({
              id: crypto.randomUUID(),
              name: name.trim(),
              therapy: therapy === 0 || therapy === 1,
              day,
              explorations: [previous, current].filter(
                (x): x is Exploration => !!x,
              ),
              thought: thought.trim(),
            });
          }}
        >
          <label className="block font-medium">
            {firstNote(previous?.feeling ?? focus, en)}
            <Textarea
              className="mt-3"
              maxLength={4000}
              value={thought}
              onChange={(e) => setThought(e.target.value)}
            />
          </label>
          <p className="text-sm text-muted-foreground">
            {en
              ? "Writing here is optional. Sign up to see your first observation."
              : "Можно оставить поле пустым. После регистрации вы увидите своё первое наблюдение."}
          </p>
          <Button type="submit">{t("webCreate")}</Button>
        </form>
      )}
      <div className="flex justify-between">
        {step > 0 && (
          <Button
            variant="ghost"
            aria-label={en ? "Back" : "Назад"}
            onClick={back}
          >
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
  onSchedule,
  noteSaved,
  onSaveNote,
}: {
  answers: IntroAnswers;
  onDone: () => void;
  onSchedule: () => void;
  noteSaved: boolean;
  onSaveNote: () => void;
}) {
  const { t, locale, feeling, slot } = useI18n();
  const en = locale === "en";
  const lang = en ? 1 : 0;
  return (
    <section className="glass mb-5 space-y-4 rounded-3xl p-5">
      <h2 className="font-display text-xl">
        {answers.name},{" "}
        {en ? "your first observation" : "ваше первое наблюдение"}
      </h2>
      <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {slots.map((period) => (
          <div key={period}>
            <dt className="capitalize text-muted-foreground">{slot(period)}</dt>
            <dd>{answers.day[period].map((value) => {
              if (value === "varies") return en ? "It varies" : "По-разному";
              if (value === "unnoticed") return en ? "Haven’t noticed yet" : "Пока не замечаю";
              return feeling(value);
            }).join(", ")}</dd>
          </div>
        ))}
      </dl>
      {answers.explorations.length === 0 && (
        <p>
          {en
            ? "You haven't noticed a consistent rhythm yet. Your first check-ins can help you see how you feel at different times."
            : "Пока вы не отметили устойчивого ритма. Первые отметки помогут увидеть, как вы чувствуете себя в разное время."}
        </p>
      )}
      {answers.explorations.map((run) => {
        const periods = slots
          .filter((s) => answers.day[s].includes(run.feeling))
          .map(slot)
          .join(", ");
        const ids = branchQuestions(
          run.feeling,
          run.choices[0],
          run.choices[1],
        );
        const observation = observations[ids[2]]?.[run.choices[2]]?.[lang];
        return (
          <article key={run.feeling} className="space-y-2">
            <h3 className="font-medium">
              {feeling(run.feeling)} · {periods}
            </h3>
            {run.feeling === "злость" &&
            ids[1] === "angerPeople" &&
            run.choices[1] === 1 &&
            run.choices[2] === 4 ? (
              <p>
                {en
                  ? "You described staying quiet in the moment and carrying on the argument in your head afterward. The conversation has ended, but your response to it is still taking shape."
                  : "В момент разговора вы молчите или соглашаетесь, хотя злитесь, а позже продолжаете спор мысленно. Разговор уже закончился, а ваш ответ на него всё ещё складывается."}
              </p>
            ) : (
              <p>
                {observation ?? (en ? "You noticed the feeling, but what follows it is still an open question. A note about one specific moment is a place to start." : "Само чувство вы заметили. А что происходит дальше, пока остаётся открытым вопросом. Можно начать с записи об одном конкретном моменте.")}
              </p>
            )}
            <details><summary>{en ? "How you answered" : "Ваши ответы"}</summary>
              <dl className="mt-2 space-y-2">{ids.map((id,i) => <div key={id}><dt className="text-sm text-muted-foreground">{questions[id].title[lang]}</dt><dd>{questions[id].options[run.choices[i]][lang]}</dd></div>)}</dl>
            </details>
          </article>
        );
      })}
      {answers.thought && (
        <>
          <blockquote className="whitespace-pre-wrap border-s-2 border-primary ps-3">
            {answers.thought}
          </blockquote>
          <Button variant="outline" disabled={noteSaved} onClick={onSaveNote}>
            {t(noteSaved ? "saved" : "saveEntry")}
          </Button>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onDone}>{t("feelingDone")}</Button>
        {answers.therapy && (
          <Button variant="outline" onClick={onSchedule}>
            {t("botSessionSetup")}
          </Button>
        )}
      </div>
    </section>
  );
}
