import type { IntroMood } from "./intro-record";
import type { JournalEntry } from "./types";
import type { MessengerChoice } from "./intro-messengers";

type Language = "ru" | "en";
type Copy = readonly [ru: string, en: string];
type MoodCopy = {
  recentQuestion: Copy;
  currentQuestion: Copy;
  lately: Copy;
  now: Copy;
};

const moods: Record<IntroMood, MoodCopy> = {
  тревожно: {
    recentQuestion: ["Тревога может появляться и без явного повода. Есть ли понимание, что тревожит?", "Anxiety can show up without an obvious reason. Do you have a sense of what’s worrying you?"],
    currentQuestion: ["Какая мысль сейчас тревожит вас больше всего?", "What’s weighing on your mind right now?"],
    lately: ["В последнее время мне тревожно.", "I’ve been feeling anxious lately."],
    now: ["Сейчас мне тревожно.", "Right now I feel anxious."],
  },
  спокойно: {
    recentQuestion: ["Это очень хорошо. Вам обычно спокойно или в последнее время это связано с чем-то конкретным?", "That’s good to hear. Is calm familiar to you, or is there something in particular you connect it with lately?"],
    currentQuestion: ["Что вы замечаете вокруг себя в этот спокойный момент?", "What do you notice around you in this quiet moment?"],
    lately: ["В последнее время мне спокойно.", "I’ve been feeling calm lately."],
    now: ["Сейчас мне спокойно.", "Right now I feel calm."],
  },
  злость: {
    recentQuestion: ["Есть ли понимание, на кого или на что обращена злость?", "Do you have a sense of who or what your anger is directed at?"],
    currentQuestion: ["Что именно сейчас вас злит?", "What feels upsetting or unfair to you right now?"],
    lately: ["В последнее время я часто злюсь.", "I’ve been feeling angry lately."],
    now: ["Сейчас я злюсь.", "Right now I feel angry."],
  },
  грусть: {
    recentQuestion: ["Грусть связана с каким-то событием или это неясная меланхолия?", "Is the sadness connected to a particular event, or is it more of a vague melancholy?"],
    currentQuestion: ["О чём вы думаете, когда замечаете эту грусть?", "What comes to mind as you notice this sadness?"],
    lately: ["В последнее время мне грустно.", "I’ve been feeling sad lately."],
    now: ["Сейчас мне грустно.", "Right now I feel sad."],
  },
  радость: {
    recentQuestion: ["Очень приятно это слышать. Поделитесь, с чем связана радость?", "That’s lovely to hear. Would you share what’s bringing you joy?"],
    currentQuestion: ["Что вас сейчас радует?", "What’s bringing you joy right now?"],
    lately: ["В последнее время я часто чувствую радость.", "I’ve been feeling joyful lately."],
    now: ["Сейчас я чувствую радость.", "Right now I feel joyful."],
  },
  усталость: {
    recentQuestion: ["Усталость может быть физической и эмоциональной. Что вам ближе?", "Tiredness can be physical or emotional. Which feels closer to your experience?"],
    currentQuestion: ["Что вас сегодня утомило?", "What tired you out today?"],
    lately: ["В последнее время я чувствую усталость.", "I’ve been feeling tired lately."],
    now: ["Сейчас я чувствую усталость.", "Right now I feel tired."],
  },
  стыд: {
    recentQuestion: ["Поделитесь, что произошло?", "Would you share what happened?"],
    currentQuestion: ["Какой момент сейчас вспоминается в связи с этим чувством?", "What moment comes to mind with this feeling right now?"],
    lately: ["В последнее время мне бывает стыдно.", "I’ve been feeling ashamed lately."],
    now: ["Сейчас мне стыдно.", "Right now I feel ashamed."],
  },
  пусто: {
    recentQuestion: ["Что раньше наполняло эту пустоту? Есть ли понимание, почему в последнее время так?", "What used to fill that space? Do you have a sense of why it feels empty lately?"],
    currentQuestion: ["Как бы вы описали это ощущение пустоты сейчас?", "How would you describe this sense of emptiness right now?"],
    lately: ["В последнее время я ощущаю пустоту.", "I’ve been feeling empty lately."],
    now: ["Сейчас я ощущаю пустоту.", "Right now I feel empty."],
  },
  напряжение: {
    recentQuestion: ["Есть ли понимание, почему не получается расслабиться?", "Do you have a sense of what makes it hard to relax?"],
    currentQuestion: ["Как сейчас проявляется напряжение — в теле, в мыслях или как-то ещё?", "Where do you notice the tension right now — in your body, in your thoughts, or somewhere else?"],
    lately: ["В последнее время я чувствую напряжение.", "I’ve been feeling tense lately."],
    now: ["Сейчас я чувствую напряжение.", "Right now I feel tense."],
  },
  unknown: {
    recentQuestion: ["Как бы вы описали свои последние дни?", "How would you describe your past few days?"],
    currentQuestion: ["Если чувство трудно назвать, как бы вы описали своё состояние сейчас?", "If the feeling is hard to name, how would you describe this moment?"],
    lately: ["Мне трудно вспомнить, какое чувство было чаще.", "It’s hard to recall which feeling came up most often."],
    now: ["Сейчас мне трудно назвать своё чувство.", "It’s hard to name what I feel right now."],
  },
};

export type IntroCheckin = {
  kind: "checkin";
  attempt: string;
  language: Language;
  therapy: "yes" | "no";
  messengers?: MessengerChoice[];
  recent: IntroMood;
  recentReason: string;
  current: IntroMood;
  currentReason?: string;
  markedAt: string;
  date: string;
};

export function checkinQuestion(mood: IntroMood, when: "recentQuestion" | "currentQuestion", language: Language) {
  return moods[mood][when][language === "en" ? 1 : 0];
}

export function checkinEntry(record: IntroCheckin): JournalEntry {
  const i = record.language === "en" ? 1 : 0;
  const paragraphs = [moods[record.recent].lately[i] + " " + record.recentReason];
  if (record.current !== record.recent) paragraphs.push(moods[record.current].now[i] + " " + record.currentReason);
  return {
    id: "intro-answer-" + record.attempt, date: record.date,
    createdAt: record.markedAt, updatedAt: record.markedAt, source: "app",
    feelings: record.current === "unknown" ? [] : [record.current], tags: [], body: paragraphs.join("\n\n"),
  };
}
