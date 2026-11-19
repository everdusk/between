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
      ["Продолжаю мысленно спорить", "I keep arguing in my head"],
      ["По-разному", "It varies"],
    ],
  },
  worry: {
    title: [
      "Когда вы тревожитесь, о чём чаще ваши мысли?",
      "What is usually on your mind when you feel anxious?",
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
    title: [
      "Когда вы пытаетесь разобраться, что обычно происходит?",
      "What happens when you try to work through it?",
    ],
    options: [
      ["Становится яснее", "Things become clearer"],
      ["Становится спокойнее", "I feel calmer"],
      ["Легче ненадолго", "I feel better for a little while"],
      ["Мыслей становится больше", "I have even more thoughts"],
      ["Пока не замечал", "I haven't noticed yet"],
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
    title: [
      "Получается ли дать себе то, чего хочется?",
      "Are you able to give yourself what you need?",
    ],
    options: [
      ["Чаще да", "Usually"],
      ["Иногда", "Sometimes"],
      ["Обычно откладываю свои потребности", "I tend to put my needs off"],
      ["Пока не знаю, что помогает", "I don't yet know what helps"],
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
    title: [
      "Что происходит, когда вы замечаете усталость?",
      "What do you do when you notice you're tired?",
    ],
    options: [
      ["Делаю паузу", "I take a break"],
      ["Продолжаю, пока не закончу", "I keep going until I finish"],
      ["Берусь за более простые дела", "I switch to an easier task"],
      ["Откладываю всё", "I put everything off"],
      [
        "Замечаю, когда сил совсем не осталось",
        "I only notice once I'm exhausted",
      ],
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
    title: [
      "Что с напряжением, когда ситуация заканчивается?",
      "What happens to the tension when the situation ends?",
    ],
    options: [
      ["Уходит", "It goes away"],
      ["Снижается постепенно", "It eases gradually"],
      ["Держится ещё долго", "It lingers"],
      ["По-разному", "It varies"],
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
  positiveEnd: {
    title: [
      "Получается ли оставлять место для таких моментов?",
      "Do you get to make room for moments like these?",
    ],
    options: [
      ["Да", "Yes"],
      ["Иногда", "Sometimes"],
      [
        "Они первыми уступают делам",
        "They're the first thing I give up when things get busy",
      ],
      ["Пока не задумывался", "I haven't really thought about it"],
    ],
  },
} as const;

export type QuestionId = keyof typeof questions;

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
        "angerEnd",
      ];
    case "тревожно":
      return [
        "worry",
        (["future", "past", "relationships", "decisions", "notice"] as const)[
          first ?? 4
        ],
        "worryEnd",
      ];
    case "грусть":
      return ["sad", "sadNeed", "sadEnd"];
    case "усталость":
      return ["tired", "tiredDo", "tiredEnd"];
    case "стыд":
      return ["shame", "shameDo", "shameEnd"];
    case "пусто":
      return ["empty", "emptyWhen", second === 4 ? "emptyEnd" : "emptyShift"];
    case "напряжение":
      return ["tense", "tenseWhen", "tenseEnd"];
    case "спокойно":
    case "радость":
      return ["positive", "positiveDo", "positiveEnd"];
  }
}

/** Observations describe only the outcome the person reported. */
export const observations: Partial<Record<QuestionId, readonly (readonly [string, string])[]>> = {
  angerEnd: [
    ["Когда злость проходит, вы замечаете облегчение.","You notice relief once the anger passes."],
    ["После злости становится яснее, что хочется изменить.","After the anger passes, what you want to change becomes clearer."],
    ["Позже внимание переключается на вашу собственную реакцию: вы чувствуете вину за неё.","Later your attention shifts to your own reaction, and you feel guilty about it."],
    ["После злости вы чаще замечаете усталость.","You tend to feel tired after the anger passes."],
    ["Разговор уже закончился, а мысленный спор ещё продолжается.","The conversation ends, but the argument continues in your head."],
  ],
  worryEnd: [
    ["Когда вы разбираете тревожную мысль, ситуация становится понятнее.","Working through the worry helps you understand the situation."],
    ["Разобрав тревожную мысль, вы обычно чувствуете себя спокойнее.","You usually feel calmer after working through a worry."],
    ["Вы замечаете облегчение, но ненадолго. Можно проследить, в какой момент мысль возвращается.","You notice some relief, but it is brief. The moment the thought returns may be worth noticing."],
    ["Пытаясь разобраться с тревогой, вы замечаете, что мыслей становится больше.","When you try to work through the worry, you notice more thoughts coming up."],
  ],
  sadEnd: [
    ["В моменты грусти вам чаще удаётся уделить внимание тому, чего хочется.","When you feel sad, you can usually make room for what you need."],
    ["Иногда удаётся дать себе то, чего хочется в момент грусти. Что отличает такие дни?","Sometimes you can make room for what you need when you're sad. What is different on those days?"],
    ["Вы замечаете, чего хочется в момент грусти, но обычно откладываете это на потом.","When you're sad, you notice a need but usually set it aside."],
  ],
  tiredEnd: [
    ["После отдыха вы замечаете, что сил становится больше.","You notice your energy returning after rest."],
    ["Отдых помогает телу, а мысли продолжают занимать внимание. Для вас это два разных признака восстановления.","Your body feels better after rest, while your thoughts stay busy. Those are two different signs of recovery for you."],
    ["Даже после отдыха вы пока замечаете мало изменений в самочувствии.","So far, you notice little change in how you feel after resting."],
    ["Вы замечаете усталость, но до самого отдыха дело доходит редко.","You notice you're tired, yet rarely get to take a break."],
  ],
  shameEnd: [
    ["Позже вы возвращаетесь мыслями к тому, что произошло.","Afterward, you tend to revisit what happened."],
    ["После эпизода внимание смещается с самого события на мысли о себе.","Afterward, your attention shifts from the event to thoughts about yourself."],
    ["Вы возвращаетесь и к событию, и к мыслям о себе. Можно понаблюдать, когда внимание переключается.","You revisit both the event and thoughts about yourself. You might notice when your attention shifts."],
    ["Обычно удаётся отпустить случившееся.","You can usually let the event go."],
  ],
  tenseEnd: [
    ["Когда ситуация заканчивается, вы замечаете, как уходит напряжение.","When the situation ends, you notice the tension lift."],
    ["Ситуация уже закончилась, а напряжению нужно немного времени, чтобы спасть.","The situation ends before the tension has fully eased."],
    ["Напряжение остаётся надолго даже после того, как ситуация закончилась.","The tension stays with you long after the situation ends."],
  ],
  positiveEnd: [
    ["В обычной неделе вы находите место для таких моментов.","You make room for these moments during an ordinary week."],
    ["Иногда для таких моментов находится место. Чем отличаются дни, когда это удаётся?","Sometimes you make room for those moments. What is different on the days when that happens?"],
    ["Когда прибавляются дела, эти моменты первыми исчезают из недели.","When life gets busy, these moments are the first to slip out of your week."],
  ],
  emptyShift: [
    ["В такие моменты вы снова начинаете что-то чувствовать.","In those moments, you notice feelings returning."],
    ["Перемена для вас заметна по тому, что возвращается интерес.","Returning interest is how you recognise a shift."],
    ["Первым заметным изменением для вас становится прилив сил.","Having more energy is how you notice a change."],
    ["В такие моменты появляется ощущение близости.","In those moments, you notice a sense of connection."],
  ],
  emptyEnd: [
    ["Вы пока не замечали, когда ощущение меняется. Начать наблюдение хочется с того, кто рядом и где вы находитесь.","You haven't noticed a shift yet. Where you are and who's nearby feels like a place to start."],
    ["Вы пока не замечали перемен, но готовы обратить внимание на то, чем заняты в этот момент.","You haven't noticed a shift yet, but what you're doing feels worth paying attention to."],
    ["Вы пока не замечали перемен. Телесные ощущения кажутся вам доступной точкой наблюдения.","You haven't noticed a shift yet. How your body feels seems like an accessible place to start."],
  ],
};

