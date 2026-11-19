import type { PICKER_FEELINGS } from "./types";

export type SurveyFeeling = (typeof PICKER_FEELINGS)[number];
export const questions = {
  anger: {
    title: [
      "Когда вы злитесь, что чаще всего этому предшествует?",
      "What tends to happen just before you feel angry?",
    ],
    options: [
      [
        "Со мной неприятно разговаривают",
        "Someone speaks to me in a hurtful way",
      ],
      [
        "От меня требуют больше, чем я готов дать",
        "Someone asks more of me than I want to give",
      ],
      ["Не могу повлиять на ситуацию", "Something is out of my control"],
      ["Я недоволен собой", "I'm unhappy with myself"],
      ["Пока не вижу общего", "I haven't noticed a pattern"],
    ],
  },
  angerPeople: {
    title: [
      "Что вы обычно делаете в этот момент?",
      "How do you usually respond?",
    ],
    options: [
      ["Говорю, что меня не устраивает", "I say what bothers me"],
      [
        "Молчу или соглашаюсь, хотя злюсь",
        "I stay quiet or agree even though I'm angry",
      ],
      ["Отвечаю резче, чем хотелось", "I speak more sharply than I wanted to"],
      [
        "Беру паузу, чтобы вернуться к разговору",
        "I take a break and return to the conversation",
      ],
      ["Каждый раз по-разному", "It varies"],
    ],
  },
  angerSelf: {
    title: [
      "За что вы чаще себя упрекаете?",
      "What do you tend to fault yourself for?",
    ],
    options: [
      ["Отложил то, что собирался сделать", "Putting something off"],
      [
        "Ошибся или не справился",
        "Making a mistake or struggling with something",
      ],
      ["Не смог постоять за себя", "Not standing up for myself"],
      ["Сравниваю себя с другими", "Comparing myself with others"],
      ["За что-то другое", "Something else"],
    ],
  },
  angerEnd: {
    title: [
      "Что остаётся, когда злость проходит?",
      "What tends to linger after the anger fades?",
    ],
    options: [
      ["Облегчение", "Relief"],
      [
        "Яснее вижу, что хочу изменить",
        "A clearer sense of what I want to change",
      ],
      ["Вина за свою реакцию", "Guilt about how I reacted"],
      ["Усталость", "Tiredness"],
      ["Мысленно возвращаюсь к случившемуся", "I keep replaying what happened"],
      ["По-разному", "It varies"],
    ],
  },
  worry: {
    title: [
      "О какой тревоге вам хочется поговорить сейчас?",
      "Which worry would you like to explore now?",
    ],
    options: [
      ["О будущем", "The future"],
      ["О том, что уже произошло", "Something that already happened"],
      ["Об отношениях с людьми", "My relationships"],
      ["О своих решениях и ошибках", "My decisions or mistakes"],
      ["Нет понятной темы", "There is no clear theme"],
    ],
  },
  future: {
    title: ["Что в этом для вас труднее всего?", "Which part feels hardest?"],
    options: [
      ["Ждать", "Waiting"],
      ["Не знать, как всё получится", "Not knowing how things will turn out"],
      ["Решиться действовать", "Deciding to act"],
      ["Пока трудно сказать", "It's hard to tell"],
    ],
  },
  past: {
    title: [
      "Когда возвращаетесь к событию, что вы ищете?",
      "What are you looking for when you revisit it?",
    ],
    options: [
      ["Объяснение произошедшему", "An explanation"],
      [
        "Другой вариант своего ответа",
        "Something I could have said differently",
      ],
      ["Подтверждение, что всё в порядке", "Reassurance that things are okay"],
      ["Пока не понимаю", "I'm not sure"],
    ],
  },
  relationships: {
    title: [
      "Какая мысль чаще возвращается после общения?",
      "What thought keeps coming back after an interaction?",
    ],
    options: [
      ["Как прозвучали мои слова", "How my words came across"],
      ["Что человек обо мне подумал", "What they thought of me"],
      ["Что будет между нами дальше", "What happens next between us"],
      ["По-разному", "It varies"],
    ],
  },
  decisions: {
    title: [
      "Что вы делаете, когда сомневаетесь в решении?",
      "What do you do when you doubt a decision?",
    ],
    options: [
      ["Снова сравниваю варианты", "I compare the options again"],
      ["Спрашиваю мнение другого человека", "I ask someone what they think"],
      ["Проверяю, можно ли что-то изменить", "I check what I can still change"],
      ["По-разному", "It varies"],
    ],
  },
  notice: {
    title: [
      "Как вы впервые замечаете это чувство?",
      "How do you first notice the feeling?",
    ],
    options: [
      ["По мыслям", "Through my thoughts"],
      ["По ощущениям в теле", "Through sensations in my body"],
      ["По своему поведению", "Through something I do"],
      ["Замечаю уже потом", "Only in hindsight"],
    ],
  },
  worryEnd: {
    title: ["Вспомните последний раз, когда вы тревожились. Что стало с тревогой чуть позже?","Think of the last time you felt anxious. How did the anxiety feel a little later?"],
    options: [
      ["Стала слабее","Less intense"],
      ["Осталась примерно такой же","About the same"],
      ["Усилилась","More intense"],
      ["Не помню","I don’t remember"],
    ],
  },
  sad: {
    title: [
      "С чем чаще соседствует грусть?",
      "What tends to come with sadness?",
    ],
    options: [
      ["Мне кого-то или чего-то не хватает", "I miss someone or something"],
      [
        "Что-то сложилось не так, как хотелось",
        "Something didn't turn out as I hoped",
      ],
      ["Чувствую одиночество", "I feel lonely"],
      ["Вспоминаю прошлое", "I think about the past"],
      ["Понятной причины нет", "There is no obvious reason"],
    ],
  },
  sadNeed: {
    title: [
      "Чего хочется в такие моменты?",
      "What do you feel like doing then?",
    ],
    options: [
      ["Поговорить с кем-то", "Talking to someone"],
      ["Побыть одному", "Spending time alone"],
      ["Поплакать или дать чувствам выход", "Crying or expressing how I feel"],
      ["Отвлечься", "Doing something distracting"],
      ["Трудно понять", "It's hard to tell"],
    ],
  },
  sadEnd: {
    title: ["В последний раз получилось сделать то, чего хотелось?","Did you get to do what you wanted the last time this happened?"],
    options: [
      ["Да","Yes"],
      ["Нет","No"],
      ["Не помню","I don’t remember"],
    ],
  },
  tired: {
    title: [
      "Какую усталость вы чаще замечаете?",
      "What kind of tiredness do you notice most?",
    ],
    options: [
      [
        "Хочется спать или физически отдохнуть",
        "I need sleep or physical rest",
      ],
      [
        "Трудно думать и принимать решения",
        "Thinking or making decisions feels hard",
      ],
      ["Не хочется общаться", "I don't want to talk to anyone"],
      ["Даже приятное требует усилий", "Even things I enjoy take effort"],
      ["Смешанную", "A mixture"],
    ],
  },
  tiredDo: {
    title: ["Что вы сделали первым, когда в последний раз устали?","What did you do first the last time you felt tired?"],
    options: [
      ["Сделал паузу","Took a break"],
      ["Переключился на дело попроще","Switched to an easier task"],
      ["Продолжил прежнее дело","Kept doing the same thing"],
      ["Что-то другое","Something else"],
      ["Не помню","I don’t remember"],
    ],
  },
  tiredEnd: {
    title: ["Что меняется после отдыха?", "What changes after you rest?"],
    options: [
      ["Сил становится больше", "I have more energy"],
      [
        "Телу легче, но мысли не отпускают",
        "My body feels better but my mind keeps going",
      ],
      ["Почти ничего", "Very little"],
      ["Отдохнуть обычно не получается", "I rarely get to rest"],
      ["По-разному", "It varies"],
    ],
  },
  shame: {
    title: ["В какие моменты стыд заметнее?", "When do you notice shame most?"],
    options: [
      ["После ошибки", "After a mistake"],
      ["Когда меня оценивают", "When I feel judged"],
      [
        "Когда выражаю чувства или потребности",
        "When I express a feeling or need",
      ],
      ["Когда сравниваю себя с другими", "When I compare myself with others"],
      ["Пока не понимаю", "I'm not sure yet"],
    ],
  },
  shameDo: {
    title: [
      "Что хочется сделать в этот момент?",
      "What do you feel like doing then?",
    ],
    options: [
      [
        "Спрятаться или закончить разговор",
        "Hiding or ending the conversation",
      ],
      ["Оправдаться", "Explaining myself"],
      ["Исправить ситуацию", "Putting things right"],
      ["Рассказать тому, кому доверяю", "Talking to someone I trust"],
      ["Сделать вид, что ничего не произошло", "Pretending nothing happened"],
      ["Ничего из этого", "None of these"],
    ],
  },
  shameEnd: {
    title: [
      "К чему вы возвращаетесь позже?",
      "What do you return to afterward?",
    ],
    options: [
      ["К самому событию", "What happened"],
      ["К мыслям о себе", "Thoughts about myself"],
      ["И к тому, и к другому", "Both"],
      ["Обычно отпускаю", "I usually let it go"],
      ["Сложно сказать", "It's hard to tell"],
    ],
  },
  empty: {
    title: [
      "Что ближе всего к этому ощущению?",
      "What best describes that emptiness?",
    ],
    options: [
      ["Почти ничего не чувствую", "I feel very little"],
      ["Не понимаю, чего хочется", "I can't tell what I want"],
      ["Всё кажется безразличным", "I feel indifferent to things"],
      ["Чувства есть, но трудно их назвать", "There are feelings I can't name"],
      ["Для меня это другое", "Something else"],
    ],
  },
  emptyWhen: {
    title: [
      "Бывают ли моменты, когда это меняется?",
      "When does it feel different, if ever?",
    ],
    options: [
      ["Рядом с кем-то", "When I'm with someone"],
      ["За определённым занятием", "During a particular activity"],
      ["После отдыха", "After rest"],
      [
        "Иногда, без ясной закономерности",
        "Sometimes, without a clear pattern",
      ],
      ["Пока не замечал", "I haven't noticed"],
    ],
  },
  emptyShift: {
    title: [
      "Что именно в эти моменты меняется?",
      "What shifts in those moments?",
    ],
    options: [
      ["Появляются чувства", "I begin to feel things"],
      ["Возвращается интерес", "I feel interested again"],
      ["Прибавляется сил", "I have more energy"],
      ["Чувствую близость", "I feel more connected"],
      ["Пока трудно назвать", "It's hard to name"],
    ],
  },
  emptyEnd: {
    title: [
      "Что было бы легче заметить в следующий раз?",
      "What might be easiest to notice next time?",
    ],
    options: [
      ["Где я и кто рядом", "Where I am and who's there"],
      ["Чем занимаюсь", "What I'm doing"],
      ["Какие ощущения в теле", "How my body feels"],
      ["Пока не знаю", "I'm not sure yet"],
    ],
  },
  tense: {
    title: [
      "Как вы обычно замечаете напряжение?",
      "How do you usually notice tension?",
    ],
    options: [
      ["По ощущениям в теле", "In my body"],
      ["По раздражительности", "I become irritable"],
      ["Всё время готов что-то делать", "I feel constantly ready to act"],
      ["Не получается расслабиться", "I find it hard to relax"],
      ["Иначе", "In another way"],
    ],
  },
  tenseWhen: {
    title: [
      "В каких обстоятельствах оно заметнее?",
      "When is it most noticeable?",
    ],
    options: [
      ["Когда много задач", "When there's too much to do"],
      ["Рядом с определёнными людьми", "Around certain people"],
      ["Когда жду решения или ответа", "While waiting for a decision or reply"],
      ["Даже в свободное время", "Even in my free time"],
      ["Не вижу общего", "I haven't noticed a pattern"],
    ],
  },
  tenseEnd: {
    title: ["Когда эта ситуация в последний раз закончилась, что стало с напряжением?","The last time that situation ended, what happened to the tension?"],
    options: [
      ["Стало слабее","It eased"],
      ["Осталось примерно таким же","It stayed about the same"],
      ["Усилилось","It intensified"],
      ["Не помню","I don’t remember"],
    ],
  },
  positive: {
    title: [
      "В какие моменты это чувство заметнее?",
      "When do you notice this feeling most?",
    ],
    options: [
      ["Наедине с собой", "When I'm on my own"],
      ["С близкими", "With people I care about"],
      ["За интересным занятием", "When I'm doing something I enjoy"],
      ["Когда есть ясность и порядок", "When things feel clear and settled"],
      ["Без особых обстоятельств", "In no particular situation"],
    ],
  },
  positiveDo: {
    title: [
      "Что вы замечаете в себе тогда?",
      "What do you notice about yourself then?",
    ],
    options: [
      ["Легче сосредоточиться", "It's easier to focus"],
      ["Больше сил и интереса", "I have more energy and curiosity"],
      ["Легче общаться", "Connecting with others is easier"],
      ["Меньше спешки", "I feel less rushed"],
      ["Просто хорошо", "I simply feel good"],
    ],
  },
  sadTalk: {
    title: ["В последний раз получилось с кем-нибудь поговорить?","Did you get to talk to someone the last time this happened?"],
    options: [
      ["Да","Yes"],
      ["Нет","No"],
      ["Не помню","I don’t remember"],
    ],
  },
  tenseFree: {
    title: ["Вспомните свободный вечер, когда чувствовалось напряжение. Каким оно было к концу вечера?","Think of a free evening when you felt tense. How did the tension feel by the end?"],
    options: [
      ["Стало слабее","It eased"],
      ["Осталось примерно таким же","It stayed about the same"],
      ["Усилилось","It intensified"],
      ["Не помню","I don’t remember"],
    ],
  },
  angerSelfEnd: {
    title: ["В последний раз, когда вы злились на себя, что было потом?","The last time you felt angry with yourself, what happened afterward?"],
    options: [
      ["Продолжал себя ругать","I kept blaming myself"],
      ["Решил, что попробую иначе","I decided what to try differently"],
      ["Переключился на другое","I moved on to something else"],
      ["Не помню","I don’t remember"],
    ],
  },
} as const;

export type QuestionId = keyof typeof questions;

export const observationLabels: Record<QuestionId, readonly [string, string]> = {
  angerPeople: ["В такие моменты вы описываете свою реакцию так","You describe your response in those moments as"],
  angerSelf: ["В такие моменты вы упрекаете себя за следующее","What you tend to fault yourself for is"],
  notice: ["Вот как вы это замечаете","The first sign you notice is"],
  future: ["Самое трудное для вас в ожидании","The hardest part for you is"],
  past: ["Возвращаясь к событию, вы ищете","When you revisit the event, what you look for is"],
  relationships: ["После общения возвращается мысль","The thought you revisit after an interaction is"],
  decisions: ["Когда есть сомнения, ваша первая реакция","When you doubt a decision, you describe your response as"],
  sadNeed: ["В такие моменты вам ближе ответ","What comes closest to what you want then is"],
  tiredDo: ["В последний раз первым делом вы сделали вот что","The first thing you did last time was"],
  shameDo: ["Вот что вам хотелось сделать","What you felt like doing was"],
  emptyWhen: ["На вопрос о том, когда это ощущение меняется, вы ответили","Asked when this feeling shifts, you said"],
  tenseWhen: ["Так вы описали обстоятельства, в которых замечаете напряжение","You described the circumstances in which you notice tension as"],
  positiveDo: ["Вот что вы замечаете в себе в такие моменты","What you notice about yourself in those moments is"],
  angerEnd: ["После злости","After the anger fades"],
  angerSelfEnd: ["Что было потом в тот раз","What happened afterward that time"],
  worryEnd: ["Что стало с тревогой в тот раз","How the anxiety felt later that time"],
  sadEnd: ["Удалось ли сделать это в тот раз","Whether you got to do that last time"],
  sadTalk: ["Удалось ли в тот раз поговорить","Whether you got to talk that time"],
  tiredEnd: ["После отдыха","After rest"],
  shameEnd: ["К чему вы возвращаетесь позже","What you revisit afterward"],
  emptyEnd: ["За чем вам хочется понаблюдать","What you might like to notice"],
  emptyShift: ["По чему вы узнаёте перемену","How you recognise a change"],
  tenseEnd: ["Напряжение после ситуации в тот раз","Tension afterward that time"],
  tenseFree: ["Напряжение к концу того вечера","Tension by the end of that evening"],
  anger: ["Перед злостью вы замечаете","What you notice before feeling angry is"],
  worry: ["Вы выбрали тему для разговора","The worry you chose to explore was"],
  sad: ["Так вы описываете моменты грусти","You describe your sad moments this way"],
  tired: ["Ваша усталость ощущается так","You describe your tiredness as"],
  shame: ["Стыд для вас заметнее в такие моменты","You notice shame most in these moments"],
  empty: ["Вы описали это ощущение так","You described the feeling this way"],
  tense: ["Первый признак напряжения для вас","The sign of tension you notice is"],
  positive: ["Вы замечаете это чувство в такие моменты","You notice this feeling in these moments"],
};

export function branchQuestions(
  feeling: SurveyFeeling,
  first?: number,
  second?: number,
): QuestionId[] {
  switch (feeling) {
    case "злость":
      return [
        "anger",
        first === 3
          ? "angerSelf"
          : first === 0 || first === 1
            ? "angerPeople"
            : "notice",
        first === 3 ? "angerSelfEnd" : "angerEnd",
      ];
    case "тревожно":
      if (first === 4) return ["worry", "notice"];
      return [
        "worry",
        (["future", "past", "relationships", "decisions", "notice"] as const)[
          first ?? 4
        ],
        "worryEnd",
      ];
    case "грусть":
      if (second === 4) return ["sad", "sadNeed"];
      return ["sad", "sadNeed", second === 0 ? "sadTalk" : "sadEnd"];
    case "усталость":
      return ["tired", "tiredDo", "tiredEnd"];
    case "стыд":
      return ["shame", "shameDo", "shameEnd"];
    case "пусто":
      return ["empty", "emptyWhen", second === 4 ? "emptyEnd" : "emptyShift"];
    case "напряжение":
      if (second === 4) return ["tense", "tenseWhen"];
      return ["tense", "tenseWhen", second === 3 ? "tenseFree" : "tenseEnd"];
    case "спокойно":
    case "радость":
      return ["positive", "positiveDo"];
  }
}

