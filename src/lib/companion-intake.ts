import type { CompanionState } from "./companion-memory";

export type Intake = {
  step: "name" | "topic" | "rating" | "choice" | "done";
  topic?: string;
  rating?: number;
};

export type IntakeReply = {
  text: string;
  rows?: { text: string; data: string }[][];
};

const topics = [
  ["anxiety", "Тревога"],
  ["sleep", "Сон"],
  ["relationships", "Отношения"],
  ["work", "Работа"],
  ["vent", "Выговориться"],
] as const;
const topicButtons = topics.map(([id, text]) => ({
  text,
  data: "ci:topic:" + id,
}));
const ratingButtons = Array.from({ length: 10 }, (_, i) => ({
  text: String(i + 1),
  data: "ci:rating:" + (i + 1),
}));
const choiceButtons = [
  { text: "Сейчас", data: "ci:choice:now" },
  { text: "Зайду вечером", data: "ci:choice:later" },
];

function topicQuestion(name?: string): IntakeReply {
  return {
    text:
      (name ? "Приятно, " + name + ". " : "") +
      "Что привело тебя сюда? Можно своими словами или выбрать ниже.",
    rows: [topicButtons.slice(0, 3), topicButtons.slice(3)],
  };
}

function choiceQuestion(intake: Intake): IntakeReply {
  return {
    text:
      intake.rating +
      " из 10. " +
      plan(intake.topic ?? "") +
      "\n\nПродолжим сейчас или зайдёшь вечером?",
    rows: [choiceButtons],
  };
}

function ratingQuestion(): IntakeReply {
  return {
    text: "Давай начнём с малого. Как ты сейчас по шкале от 1 до 10? 1 — очень тяжело, 10 — хорошо.",
    rows: [ratingButtons.slice(0, 5), ratingButtons.slice(5)],
  };
}

const sleepTopic = /(?:^|[^а-я])(?:сон|сна|сплю|спать|высыпа|бессон|недосып)/iu;
const workTopic = /работ/iu;

function plan(topic: string) {
  if (sleepTopic.test(topic) && workTopic.test(topic)) {
    return "Можем начать с того, что на работе забирает больше всего сил, и поискать, что помогло бы спокойно закончить день.";
  }
  if (sleepTopic.test(topic)) {
    return "Можем поговорить о том, как проходят твои вечера, и выбрать что-то одно, что захочется попробовать перед сном.";
  }
  if (/выговор/iu.test(topic))
    return "Можно просто выговориться. Я буду слушать.";
  return "Можем взять один недавний момент и вместе подумать, что могло бы тебе помочь.";
}

export function advanceCompanionIntake(
  state: CompanionState,
  { text, start, action }: { text: string; start?: boolean; action?: string },
): IntakeReply | null {
  if (
    action !== undefined &&
    (!state.intake || !action.startsWith("ci:" + state.intake.step + ":"))
  ) {
    return { text: "" };
  }
  // Existing companion chats begin the new intake when they re-open it or write again.
  if (!state.intake) {
    state.intake = { step: "name" };
    start = true;
  }
  if (state.intake.step === "done")
    return start ? { text: "Привет 🤍 Я на связи." } : null;
  const intake = state.intake;
  switch (intake.step) {
    case "name": {
      if (start)
        return {
          text: "Привет 🤍 Я ИИ-компаньон. Можно выговориться или вместе подумать над чем-то. Это приватный чат, и для ответа я передаю модели нужный контекст. Как мне к тебе обращаться?",
        };
      const name = text.trim();
      if (!name || name.length > 50)
        return {
          text: "Как мне к тебе обращаться? Можно написать имя или ник.",
        };
      state.name = name;
      intake.step = "topic";
      return topicQuestion(name);
    }
    case "topic": {
      if (start) return topicQuestion(state.name);
      const selected = topics.find(([id]) => action === "ci:topic:" + id)?.[1];
      if (action !== undefined && !selected) return { text: "" };
      intake.topic = selected ?? text.trim().slice(0, 1500);
      intake.step = "rating";
      const question = ratingQuestion();
      const acknowledged =
        sleepTopic.test(intake.topic) && workTopic.test(intake.topic)
          ? "Слышу, что сейчас тяжело с работой и сном."
          : selected
            ? "Хорошо, начнём с этого."
            : "Спасибо, что делишься.";
      return { ...question, text: acknowledged + "\n\n" + question.text };
    }
    case "rating": {
      if (start) return ratingQuestion();
      const raw =
        action !== undefined ? action.slice("ci:rating:".length) : text.trim();
      const score = /^(10|[1-9])(?:\s*(?:из|\/)\s*10)?[.!]?$/u.exec(raw);
      if (!score) return action !== undefined ? { text: "" } : ratingQuestion();
      intake.rating = Number(score[1]);
      intake.step = "choice";
      return choiceQuestion(intake);
    }
    case "choice": {
      if (start) return choiceQuestion(intake);
      if (
        action === "ci:choice:later" ||
        /^(?:позже|вечером|зайду вечером)[.!]?$/iu.test(text.trim())
      ) {
        intake.step = "done";
        return { text: "Хорошо. Напиши вечером, когда будет удобно 🤍" };
      }
      if (action !== undefined && action !== "ci:choice:now")
        return { text: "" };
      intake.step = "done";
      if (
        action ||
        /^(?:давай|сейчас|давай сейчас|начн[ёе]м)[.!]?$/iu.test(text.trim())
      ) {
        return {
          text: "Давай. Расскажи, с чего хочется начать. Можно с одного недавнего момента.",
        };
      }
      return null;
    }
  }
  return null;
}
