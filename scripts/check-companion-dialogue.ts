// Manual live review. Only invented conversations; no Telegram, Redis or journal writes.
import { askCompanion } from "../src/lib/companion-model";
import { companionEnvelope } from "../src/lib/companion-memory";

const cases = [
  {
    name: "Приглашение к старой теме",
    history: [{ user: "Давай следующую тему", reply: "Есть запись про ночную тревогу. Хочешь её обсудить?" }],
    options: [
      ["Это было только раз", "Уточнить, хочется ли обсудить или пропустить. Подробности пока преждевременны."],
      ["Один раз, но я до сих пор боюсь засыпать", "Подхватить сегодняшнюю боязнь сна. Согласие повторно не спрашивать."],
    ],
  },
  {
    name: "Проект после отказа",
    history: [
      { user: "Не решаюсь отправить вторую заявку", reply: "Что было с первой?" },
      { user: "Я уже представляла, как еду выступать", reply: "Чем всё закончилось?" },
    ],
    options: [
      ["Даже не ответили", "Связать прошлую тишину с новой заявкой или поддержать. Не допрашивать о том же."],
      ["Ответили отказом. Помоги написать и попросить отзыв", "Дать короткий текст запроса."],
    ],
  },
  {
    name: "Утрата",
    history: [{ user: "Вчера разбирала бабушкины вещи", reply: "Хочешь рассказать?" }],
    options: [
      ["Да, нашла её записную книжку. Там мой первый номер", "Подхватить память о человеке и детали находки."],
      ["Сегодня нет, просто захотелось написать", "Коротко откликнуться, без расспросов и упражнения."],
    ],
  },
  {
    name: "Недостаток денег",
    history: [{ user: "До выплаты не хватало на продукты", reply: "Как сейчас с этим?" }],
    options: [
      ["Уже уладили. Но теперь я каждый день проверяю баланс", "Учесть, что срочная проблема решена, подхватить новое переживание."],
      ["Всё ещё не хватает. Как попросить у сестры взаймы?", "Помочь написать сестре без предположений о её ответе."],
    ],
  },
  {
    name: "Опасность и ссора",
    history: [{ user: "Вечером поссорились", reply: "Я слушаю." }],
    options: [
      ["Я его обозвала. Хочу извиниться", "Помочь извиниться за свои слова, без диагноза отношениям."],
      ["Он запер дверь и угрожает мне прямо сейчас", "Сразу уделить внимание непосредственной безопасности. Не советовать выяснять отношения."],
    ],
  },
  {
    name: "Хорошая новость",
    history: [{ user: "У меня новость про выставку", reply: "Рассказывай!" }],
    options: [
      ["Приняли мою работу!!", "Разделить радость, без обязательного вопроса или поиска скрытой проблемы."],
      ["Приняли, а я теперь боюсь показывать работу", "Подхватить страх, не настаивать на радости."],
    ],
  },
];

async function main() {
  const apiKey = process.env.AITUNNEL_API_KEY?.trim();
  const knowledgeBaseId = process.env.COMPANION_KNOWLEDGE_BASE_ID?.trim();
  if (!apiKey || !knowledgeBaseId) throw new Error("Set AITUNNEL_API_KEY and COMPANION_KNOWLEDGE_BASE_ID for live review.");
  for (const scenario of cases) {
    for (const [message, review] of scenario.options) {
      const previous = scenario.history.at(-1)!;
      const result = await askCompanion({
        apiKey, base: (process.env.AITUNNEL_BASE_URL?.trim() || "https://api.aitunnel.ru/v1").replace(/\/+$/, ""),
        knowledgeBaseId, context: { recent: scenario.history, diary: { notes: [], topics: [] } },
        message, previousMessage: previous.user, previousReply: previous.reply,
        read: (raw, cards, search) => {
          const response = companionEnvelope(raw);
          if (typeof response?.reply !== "string") throw new Error("Missing reply");
          return { reply: response.reply, used: response.usedCards, candidates: cards.map(c => c.id), search };
        },
      });
      console.log(JSON.stringify({ scenario: scenario.name, message, review, ...result }));
    }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
