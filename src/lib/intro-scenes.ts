// Each situation has its own clarification and a separate prompt for the journal.
export const scenes = {
  "спокойно": {
    "title": ["Какую часть этого дня вам хотелось бы взять с собой в завтра?", "Which part of the day would you like to carry into tomorrow?"],
    "choices": [
      {
        "option": ["Его темп", "Its pace"],
        "clarify": ["Когда сегодня вам удалось двигаться в своём темпе?", "When did you get to move at your own pace?"],
        "prompt": ["Для чего вам хочется оставить время завтра?", "What would you like to make room for tomorrow?"]
      },
      {
        "option": ["Время с кем-то", "Time with someone"],
        "clarify": ["Что вы могли делать по-своему рядом с этим человеком?", "What felt easy to do together?"],
        "prompt": ["Что хочется сказать этому человеку об этом моменте?", "What would you like to tell that person about this moment?"]
      },
      {
        "option": ["Время наедине", "Time alone"],
        "clarify": ["Что вам особенно понравилось делать в одиночестве?", "What did you enjoy doing on your own?"],
        "prompt": ["Что в следующий раз хочется оставить только для себя?", "What would you keep just for yourself next time?"]
      },
      {
        "option": ["День целиком", "The whole day"],
        "clarify": ["По какой мелочи вы бы узнали именно этот день?", "Which small detail would tell you it was this day?"],
        "prompt": ["Как рассказать об этом дне себе через год?", "How would you describe this day to your future self?"]
      }
    ]
  },
  "радость": {
    "title": ["Что вам хочется сделать с этой радостью?", "What would you like to do with this joy?"],
    "choices": [
      {
        "option": ["Рассказать кому-то", "Tell someone"],
        "clarify": ["Какую часть этой истории вам особенно хочется рассказать?", "Which part of the story are you most excited to tell?"],
        "prompt": ["С каких слов началось бы ваше сообщение?", "How would your message begin?"]
      },
      {
        "option": ["Запомнить деталь", "Remember a detail"],
        "clarify": ["Что вы до сих пор видите или слышите, когда вспоминаете этот момент?", "What can you still see or hear when you think of it?"],
        "prompt": ["Чем вам дорога именно эта деталь?", "What makes that detail precious to you?"]
      },
      {
        "option": ["Повторить", "Do it again"],
        "clarify": ["Что из этого вы могли бы устроить для себя ещё раз?", "Which part could you arrange for yourself again?"],
        "prompt": ["Что хочется попробовать в следующий раз?", "What would you like to try next time?"]
      },
      {
        "option": ["Просто порадоваться", "Just enjoy it"],
        "clarify": ["В какой момент вам стало особенно хорошо?", "At what moment did it feel especially good?"],
        "prompt": ["Как хочется назвать эту минуту?", "What would you call this moment?"]
      }
    ]
  },
  "тревожно": {
    "title": ["Если у этой тревоги есть тема, какая ближе?", "What is closest to what’s on your mind?"],
    "choices": [
      {
        "option": ["Жду решения или ответа", "Waiting for a decision or reply"],
        "clarify": ["Что вам сейчас труднее всего в самом ожидании?", "What feels hardest about waiting?"],
        "prompt": ["Что помогло бы вам прожить сегодняшний день, пока ответа нет?", "What would help you get on with today while the answer is still unknown?"]
      },
      {
        "option": ["Что-то предстоит", "Something coming up"],
        "clarify": ["Когда вы представляете это событие, на каком моменте задерживаетесь?", "Which moment do you picture most clearly?"],
        "prompt": ["Какая поддержка вам пригодилась бы в этот момент?", "What would you like to have on your side in that moment?"]
      },
      {
        "option": ["Возвращаюсь к случившемуся", "Replaying something that happened"],
        "clarify": ["Какой вопрос у вас остался после случившегося?", "What question has stayed with you?"],
        "prompt": ["Когда вы вспоминаете эту ситуацию, какой момент первым приходит в голову?", "When you think back to that situation, which moment comes to mind first?"]
      },
      {
        "option": ["Не вижу конкретной темы", "No particular subject"],
        "clarify": ["Что вы делали, когда заметили тревогу?", "What were you doing when you noticed the anxiety?"],
        "prompt": ["Чего вам хочется в ближайшие несколько минут?", "What might feel manageable in the next few minutes?"]
      }
    ]
  },
  "злость": {
    "title": ["Когда вы заметили злость, что вам захотелось сделать?", "When you noticed the anger, what did you want to do?"],
    "choices": [
      {
        "option": ["Сказать, что меня задело", "Say what hurt"],
        "clarify": ["Какие слова или действия вас тогда задели?", "Which words or actions got to you?"],
        "prompt": ["Как бы вы сказали об этом своими словами?", "How would you say that in your own words?"]
      },
      {
        "option": ["Отказаться от чего-то", "Say no"],
        "clarify": ["В какой момент вам захотелось сказать «нет»?", "When did you want to say no?"],
        "prompt": ["Что вам хотелось бы объяснить о своём отказе?", "What would you like the other person to understand?"]
      },
      {
        "option": ["Взять паузу", "Take a pause"],
        "clarify": ["Что происходило, когда вам впервые захотелось остановиться?", "What was happening when you wanted to stop?"],
        "prompt": ["Как вы поймёте, что готовы к этому вернуться?", "What would tell you that you’re ready to come back to it?"]
      },
      {
        "option": ["Пока ничего не делать", "Do nothing for now"],
        "clarify": ["Что в этой ситуации всё-таки важно для вас, даже если вы решите ничего не делать?", "What still matters to you about this situation?"],
        "prompt": ["О чём хочется помнить, если вы вернётесь к ситуации позже?", "What would you like to remember if you revisit this later?"]
      }
    ]
  },
  "грусть": {
    "title": ["Что вам ближе в этот грустный момент?", "What feels closest to what you want in this sad moment?"],
    "choices": [
      {
        "option": ["Хочется, чтобы выслушали", "Someone to listen"],
        "clarify": ["Что вам особенно хочется донести до человека, который вас выслушает?", "What would you most like the listener to understand?"],
        "prompt": ["Какого отклика вам хотелось бы?", "What kind of response would feel welcome?"]
      },
      {
        "option": ["Хочется побыть одному", "Some time alone"],
        "clarify": ["Чего вам сейчас хочется от времени наедине с собой?", "What do you want from time on your own?"],
        "prompt": ["Как вам хотелось бы устроить это время для себя?", "What would make that time feel right for you?"]
      },
      {
        "option": ["Хочется что-то вспомнить", "To remember something"],
        "clarify": ["Что из того воспоминания до сих пор трогает вас?", "What still moves you about that memory?"],
        "prompt": ["Какой фрагмент вам хочется сохранить в дневнике?", "Which part would you like to keep in writing?"]
      },
      {
        "option": ["Пока не знаю, чего хочется", "I don’t know yet"],
        "clarify": ["Как вы поняли, что вам грустно?", "How did you notice you were sad?"],
        "prompt": ["Что об этом дне вам хочется оставить здесь?", "What would you like to leave here about today?"]
      }
    ]
  },
  "усталость": {
    "title": ["От чего сейчас особенно хочется отдохнуть?", "What would you most like a break from?"],
    "choices": [
      {
        "option": ["От решений", "Making decisions"],
        "clarify": ["На каком выборе вы почувствовали, что сил уже мало?", "Which choice made you notice your energy was low?"],
        "prompt": ["С каким решением можно немного подождать?", "Which decision could wait a little?"]
      },
      {
        "option": ["От общения", "Being around people"],
        "clarify": ["В какой момент общения вам захотелось тишины?", "At what point did you want some quiet?"],
        "prompt": ["Какая пауза между разговорами вам бы подошла?", "What would a good break between conversations look like?"]
      },
      {
        "option": ["От физической нагрузки", "Physical effort"],
        "clarify": ["По чему вы поняли, что телу нужна передышка?", "How did you notice your body needed a break?"],
        "prompt": ["Какой отдых вам был бы приятен?", "What kind of rest sounds good right now?"]
      },
      {
        "option": ["От всего понемногу", "A bit of everything"],
        "clarify": ["Когда за день вы впервые заметили, что сил стало меньше?", "When did you first notice your energy dipping?"],
        "prompt": ["Что одно вам хотелось бы сегодня с себя снять?", "Which small demand would you most like to take off your plate?"]
      }
    ]
  },
  "стыд": {
    "title": ["Что сильнее занимает ваши мысли в этот момент?", "Where does your attention go in this moment?"],
    "choices": [
      {
        "option": ["Что могли подумать другие", "What others might think"],
        "clarify": ["Что вы сами заметили в реакции окружающих?", "What did you actually notice in other people’s reactions?"],
        "prompt": ["Что в этой ситуации было известно только вам?", "What about this moment could only you have known?"]
      },
      {
        "option": ["Что я говорю себе", "What I say to myself"],
        "clarify": ["Какая фраза прозвучала у вас в голове, когда стало стыдно?", "Which words went through your mind?"],
        "prompt": ["Что бы вы сказали близкому человеку в такой ситуации?", "What would you say to a friend in the same situation?"]
      },
      {
        "option": ["Что хотелось бы исправить", "Something I’d like to put right"],
        "clarify": ["Какой небольшой шаг с вашей стороны сейчас имел бы смысл?", "Which small step would feel meaningful?"],
        "prompt": ["Что для вас изменилось бы после этого шага?", "What would doing that mean to you?"]
      },
      {
        "option": ["Не хочется вдаваться в это", "I’d rather keep this private"],
        "clarify": ["Что вам хочется сказать себе сейчас, оставив подробности за кадром?", "What would you like to say to yourself without sharing the details?"],
        "prompt": ["Какое короткое название подойдёт этой записи?", "What title would you give this private note?"]
      }
    ]
  },
  "пусто": {
    "title": ["Что вам сейчас легче всего заметить?", "What feels easiest to notice?"],
    "choices": [
      {
        "option": ["Что происходит вокруг", "My surroundings"],
        "clarify": ["Какой звук вы замечаете вокруг себя?", "What sound do you notice around you?"],
        "prompt": ["Какая деталь завтра напомнит вам, где вы были?", "Which detail would place you back here tomorrow?"]
      },
      {
        "option": ["Что я делаю", "What I’m doing"],
        "clarify": ["Что вы делали прямо перед тем, как заметили пустоту?", "What were you doing just before you noticed the emptiness?"],
        "prompt": ["Что об этой минуте хочется запомнить?", "What do you want to remember about that moment?"]
      },
      {
        "option": ["Чего хочется хотя бы немного", "Something I want a little"],
        "clarify": ["Что вам захотелось бы сделать в ближайшие пять минут?", "What would you like to do in the next five minutes?"],
        "prompt": ["С чего можно было бы начать?", "What is the smallest version you could try?"]
      },
      {
        "option": ["Пока ничего", "Nothing yet"],
        "clarify": ["Каким словом вы бы подписали эту минуту?", "What word would you give this minute?"],
        "prompt": ["Какими словами вы могли бы оставить след об этой минуте?", "What could you jot down just to mark being here?"]
      }
    ]
  },
  "напряжение": {
    "title": ["По чему вы замечаете напряжение?", "How do you notice tension?"],
    "choices": [
      {
        "option": ["По ощущениям в теле", "In my body"],
        "clarify": ["Где в теле вы чувствуете это особенно отчётливо?", "Where do you feel it most clearly?"],
        "prompt": ["На что похоже это ощущение?", "How would you describe that sensation in your own words?"]
      },
      {
        "option": ["По мыслям", "In my thoughts"],
        "clarify": ["Как звучит мысль, по которой вы узнаёте напряжение?", "What does the thought sound like?"],
        "prompt": ["Что происходило, когда появилась эта мысль?", "What was happening when that thought came up?"]
      },
      {
        "option": ["По тому, как я действую", "In what I do"],
        "clarify": ["Что именно вы делаете иначе, когда напряжены?", "What do you do differently when you feel tense?"],
        "prompt": ["Что в следующий раз хочется заметить чуть раньше?", "What would you like to notice a little earlier next time?"]
      },
      {
        "option": ["Замечаю уже потом", "Only afterwards"],
        "clarify": ["Что помогло вам понять задним числом, что вы были напряжены?", "What helped you recognise it afterwards?"],
        "prompt": ["Какую подсказку об этом моменте хочется оставить себе?", "Which detail might help you recognise it again?"]
      }
    ]
  },
  "unknown": {
    "title": ["Что из сегодняшнего дня легче всего вспомнить прямо сейчас?", "What part of today is easiest to recall?"],
    "choices": [
      {
        "option": ["Разговор", "A conversation"],
        "clarify": ["Что из этого разговора вам хотелось бы обдумать ещё немного?", "Which part would you like to think about a little longer?"],
        "prompt": ["Что ещё вам хотелось бы сказать?", "What did you leave unsaid?"]
      },
      {
        "option": ["Одно занятие", "Something I did"],
        "clarify": ["Какая деталь помогла бы вам завтра вспомнить это занятие?", "Which detail would help you remember it tomorrow?"],
        "prompt": ["Что в этом занятии было для вас важно?", "What mattered to you about doing it?"]
      },
      {
        "option": ["Место или деталь вокруг", "A place or detail"],
        "clarify": ["Что именно притянуло ваш взгляд?", "What caught your eye?"],
        "prompt": ["Как бы вы описали это тому, кого там не было?", "How would you describe it to someone who wasn’t there?"]
      },
      {
        "option": ["Просто смотрю, как устроен дневник", "Just looking around the journal"],
        "clarify": ["Что из сегодняшнего дня вам было бы интересно перечитать через неделю?", "What about today might you enjoy rereading in a week?"],
        "prompt": ["С чего началась бы первая строка?", "How would the first line begin?"]
      }
    ]
  }
} as const;

