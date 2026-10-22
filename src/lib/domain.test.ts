import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRuleBacklog, buildRuleBrief, mergeBacklog, parseModelBacklog } from "./brief";
import {
  localeFromTelegram,
  resolveAppGreetingLocale,
  resolveBotLocale,
  resolveGreetingLocale,
} from "./i18n";
import { catalogsShareKeys, countPhrase, feelingLabel, translate } from "./messages";
import { pollText } from "./digest";
import { feelingKeyboard, parseFeelingCallback } from "./telegram-bot";
import { buildWeekSpectrum, spectrumHeadline } from "./spectrum";
import { digestAction } from "./digest";
import { mergeStores } from "./journal-api";
import { normalizeStore } from "./migrate";
import { nextWeeklyOccurrence } from "./session-plan";
import { suggestTags } from "./tags";
import type { ThemeParams } from "@twa-dev/types";
import { applyTelegramTheme, panelColor } from "./telegram";
import { briefSystemPrompt, resolveGroqModel, textFromGeminiParts } from "../app/api/brief/route";
import { formatDayLabel } from "./dates";
import { buildPeriodSummary, therapyWindow } from "./session-summary";
import { emptyStore, type JournalEntry, type SessionNote } from "./types";
import {
  daysPhrase,
  describeWeekAccess,
  emptyWeekAccess,
  grantWeekPaidUntil,
  markWeekIntroSeen,
  openWeekAccess,
  starPriceFromEnv,
  TRIAL_MS,
} from "./week-access";

function note(partial: Partial<JournalEntry> & Pick<JournalEntry, "id" | "body">): JournalEntry {
  return {
    date: "2026-10-09",
    createdAt: "2026-10-09T10:00:00.000Z",
    updatedAt: "2026-10-09T10:00:00.000Z",
    feelings: [],
    tags: [],
    source: "app",
    ...partial,
  };
}

describe("migrate", () => {
  it("turns the old scale and the bot tag into feelings and a source", () => {
    const store = normalizeStore({
      version: 1,
      entries: [
        {
          id: "1",
          date: "2026-10-01",
          mood: 1,
          body: "день",
          tags: ["бот", "мама"],
          updatedAt: "2026-10-01T10:00:00.000Z",
        },
        {
          id: "2",
          date: "2026-10-02",
          mood: 5,
          body: "легче",
          tags: [],
          updatedAt: "2026-10-02T10:00:00.000Z",
        },
      ],
      sessions: [],
      weekPreps: [],
    });
    assert.ok(store);
    assert.equal(store.version, 2);
    assert.deepEqual(store.entries[0].feelings, ["тяжело"]);
    assert.deepEqual(store.entries[0].tags, ["мама"]);
    assert.equal(store.entries[0].source, "bot");
    assert.deepEqual(store.entries[1].feelings, ["радость"]);
    assert.equal(store.entries[1].source, "app");
    assert.equal(store.notify.moodPolls, true);
  });
});

describe("merge", () => {
  it("keeps two notes on the same day", () => {
    const left = emptyStore();
    left.entries = [note({ id: "a", body: "утро" })];
    const right = emptyStore();
    right.entries = [note({ id: "b", body: "вечер", createdAt: "2026-10-09T18:00:00.000Z" })];
    const merged = mergeStores(left, right);
    assert.equal(merged.entries.length, 2);
  });
});

describe("tags", () => {
  it("reads themes from the text and skips the bot label", () => {
    assert.deepEqual(
      suggestTags("Говорила с мамой про работу, опять бессонница"),
      ["мама", "работа", "сон"],
    );
    assert.deepEqual(suggestTags("просто другой день"), []);
    assert.deepEqual(suggestTags("бот"), []);
    assert.deepEqual(suggestTags("вкусно поела и радуюсь"), []);
    assert.deepEqual(suggestTags("пропал аппетит, вчера переела"), ["еда"]);
  });
});

describe("brief", () => {
  it("counts feelings and repeats a theme from last week", () => {
    const text = buildRuleBrief({
      weekEntries: [
        note({
          id: "1",
          body: "Снова мама и дедлайн на работе",
          feelings: ["тревожно", "тревожно"],
          tags: ["мама", "работа"],
        }),
      ],
      prevEntries: [
        note({
          id: "0",
          date: "2026-10-02",
          body: "мама",
          feelings: ["тревожно"],
          tags: ["мама"],
        }),
      ],
      talkNotes: "про дедлайн",
    });
    assert.match(text, /тревожно — 2/);
    assert.match(text, /С прошлой недели повторяется: мама/);
    assert.match(text, /про дедлайн/);
    assert.match(text, /Записи:\n/);
    assert.match(text, /Снова мама и дедлайн на работе/);
  });

  it("keeps today's notes when an older note already has the tag", () => {
    const text = buildRuleBrief({
      weekEntries: [
        note({
          id: "old",
          date: "2026-10-08",
          body: "[19:05] старая запись про маму",
          tags: ["мама"],
        }),
        note({
          id: "today",
          date: "2026-10-09",
          createdAt: "2026-10-09T16:00:00.000Z",
          body: "обида на подругу",
          tags: [],
        }),
      ],
      prevEntries: [],
      talkNotes: "",
      todayKey: "2026-10-09",
    });
    assert.match(text, /старая запись про маму/);
    assert.match(text, /сегодня: обида на подругу/);
    assert.doesNotMatch(text, /пока пустое/);
  });
});

describe("backlog", () => {
  it("puts a carried theme, a repeated heavy feeling, and a talk line first", () => {
    const items = buildRuleBacklog({
      weekEntries: [
        note({
          id: "1",
          body: "Снова мама и дедлайн на работе",
          feelings: ["тревожно"],
          tags: ["мама", "работа"],
        }),
        note({
          id: "2",
          date: "2026-10-10",
          body: "опять не сплю",
          feelings: ["тревожно", "радость"],
          tags: ["работа"],
        }),
      ],
      prevEntries: [
        note({
          id: "0",
          date: "2026-10-02",
          body: "мама",
          tags: ["мама"],
        }),
      ],
      talkNotes: "про дедлайн",
    });
    assert.deepEqual(
      items.map((item) => `${item.priority}:${item.text}`),
      [
        "high:про дедлайн",
        `high:${formatDayLabel("2026-10-10")}: опять не сплю`,
        `high:${formatDayLabel("2026-10-09")}: Снова мама и дедлайн на работе`,
      ],
    );
    assert.equal(items.some((item) => item.text.includes("радость")), false);
    assert.equal(items.some((item) => /— \d+$/.test(item.text)), false);
  });

  it("leaves a joyful meal off the list and keeps a hard episode", () => {
    const items = buildRuleBacklog({
      weekEntries: [
        note({
          id: "meal",
          body: "вкусно поела и радуюсь",
          feelings: ["радость"],
          tags: ["еда"],
        }),
        note({
          id: "meal2",
          date: "2026-10-10",
          body: "еще раз вкусно поела",
          feelings: ["радость"],
          tags: ["еда"],
        }),
        note({
          id: "hard",
          body: "стыдно, что переела за ужином",
          feelings: ["стыд"],
          tags: ["еда"],
        }),
      ],
      prevEntries: [],
      talkNotes: "",
    });
    assert.deepEqual(
      items.map((item) => item.text),
      [`${formatDayLabel("2026-10-09")}: стыдно, что переела за ужином`],
    );
    assert.equal(items[0].priority, "mid");
  });

  it("strips a json fence and drops a bad priority", () => {
    const parsed = parseModelBacklog(
      '```json\n[{"text":"разговор с мамой","priority":"mid"},{"text":"мимо","priority":"urgent"}]\n```',
    );
    assert.deepEqual(parsed, [{ text: "разговор с мамой", priority: "mid" }]);
    assert.equal(parseModelBacklog('[{"text":"мимо","priority":"urgent"}]'), null);
    assert.equal(parseModelBacklog('[{"text":"еда — 2","priority":"mid"}]'), null);
    assert.deepEqual(
      parseModelBacklog(
        '[{"text":"вкусно поела","priority":"high"},{"text":"разговор с мамой про дедлайн","priority":"mid"}]',
      ),
      [{ text: "разговор с мамой про дедлайн", priority: "mid" }],
    );
  });

  it("keeps a checked item when the text matches", () => {
    const merged = mergeBacklog(
      [
        { text: "Про дедлайн", priority: "high" },
        { text: "работа — 2", priority: "mid" },
      ],
      [{ text: "про дедлайн", done: true }],
    );
    assert.equal(merged[0].done, true);
    assert.equal(merged[0].priority, "high");
    assert.equal(merged[1].done, false);
  });

  it("keeps a stored checklist and drops one without a stamp", () => {
    const kept = normalizeStore({
      version: 2,
      entries: [],
      sessions: [],
      weekPreps: [
        {
          weekKey: "since:2026-10-08",
          talkNotes: "про дедлайн",
          updatedAt: "2026-10-14T00:00:00.000Z",
          briefText: "— тревожно — 2",
          briefStamp: "abc:ru",
          backlog: [
            { id: "x", text: "про дедлайн", priority: "high", done: true },
            { text: "плохо", priority: "urgent", done: true },
          ],
          backlogStamp: "b:abc:ru",
          backlogSource: "model",
        },
      ],
    });
    assert.ok(kept);
    assert.equal(kept.weekPreps[0].talkNotes, "про дедлайн");
    assert.equal(kept.weekPreps[0].briefText, "— тревожно — 2");
    assert.equal(kept.weekPreps[0].backlogSource, "model");
    assert.deepEqual(kept.weekPreps[0].backlog, [
      { id: "x", text: "про дедлайн", priority: "high", done: true },
    ]);

    const dropped = normalizeStore({
      version: 2,
      entries: [],
      sessions: [],
      weekPreps: [
        {
          weekKey: "since:2026-10-08",
          talkNotes: "",
          updatedAt: "2026-10-14T00:00:00.000Z",
          backlog: [{ id: "x", text: "про дедлайн", priority: "high", done: false }],
        },
      ],
    });
    assert.ok(dropped);
    assert.equal(dropped.weekPreps[0].backlog, undefined);
  });

  it("asks the model for dated facts and a json checklist", () => {
    const brief = briefSystemPrompt("ru", "brief");
    assert.equal(brief.includes("три коротких"), false);
    assert.match(brief, /датой или числом повторов/);
    assert.match(briefSystemPrompt("ru", "backlog"), /вкусно поела/);
    assert.match(briefSystemPrompt("en", "backlog"), /JSON/);
  });
});

describe("spectrum", () => {
  const days = [
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-10",
    "2026-10-11",
  ];

  it("orders the week from lighter feelings toward heavier ones", () => {
    const spectrum = buildWeekSpectrum(days, [
      note({
        id: "mon",
        date: "2026-10-05",
        createdAt: "2026-10-05T08:00:00.000Z",
        body: "злость с утра",
        feelings: ["злость"],
      }),
      note({
        id: "tue",
        date: "2026-10-06",
        createdAt: "2026-10-06T09:00:00.000Z",
        body: "легче",
        feelings: ["радость", "спокойно"],
      }),
      note({
        id: "wed-am",
        date: "2026-10-07",
        createdAt: "2026-10-07T07:00:00.000Z",
        body: "утро",
        feelings: ["тревожно"],
      }),
      note({
        id: "wed-pm",
        date: "2026-10-07",
        createdAt: "2026-10-07T19:00:00.000Z",
        body: "вечер",
        feelings: ["тревожно", "усталость"],
      }),
    ]);

    assert.deepEqual(
      spectrum.shares.map((share) => share.feeling),
      ["радость", "спокойно", "усталость", "тревожно", "злость"],
    );
    assert.deepEqual(spectrum.top, ["тревожно"]);
    assert.equal(spectrumHeadline(spectrum, 4), "Чаще всего — тревожно.");
    const wednesday = spectrum.days[2];
    assert.deepEqual(
      wednesday.slices.map((slice) => slice.feelings),
      [["тревожно"], ["тревожно", "усталость"]],
    );
    assert.equal(spectrum.days[6].slices.length, 0);
  });

  it("names a tie and an empty week", () => {
    const tied = buildWeekSpectrum(days, [
      note({
        id: "a",
        date: "2026-10-05",
        body: "радость",
        feelings: ["радость"],
      }),
      note({
        id: "b",
        date: "2026-10-06",
        body: "грусть",
        feelings: ["грусть"],
      }),
    ]);
    assert.equal(
      spectrumHeadline(tied, 2),
      "Одинаково часто — радость и грусть.",
    );
    const empty = buildWeekSpectrum(days, []);
    assert.equal(
      spectrumHeadline(empty, 0),
      "Неделя ещё пустая. Отметка самочувствия станет здесь цветной полосой.",
    );
  });
});

describe("session plan", () => {
  it("rolls a Thursday session to next week after 17:00", () => {
    const next = nextWeeklyOccurrence(
      { mode: "weekly", date: "", time: "17:00", weekday: 3, updatedAt: "" },
      new Date(2026, 9, 8, 18, 0, 0),
    );
    assert.equal(next?.getFullYear(), 2026);
    assert.equal(next?.getMonth(), 9);
    assert.equal(next?.getDate(), 15);
  });
});

describe("telegram theme", () => {
  it("paints secondary buttons and badges with the Telegram text color", () => {
    const props = new Map<string, string>();
    const previous = globalThis.document;
    globalThis.document = {
      documentElement: {
        dataset: {},
        style: {
          setProperty(name: string, value: string) {
            props.set(name, value);
          },
          removeProperty(name: string) {
            props.delete(name);
          },
        },
      },
    } as unknown as Document;

    applyTelegramTheme(
      {
        bg_color: "#1c1c1e",
        text_color: "#ffffff",
        hint_color: "#8e8e93",
        button_color: "#3390ec",
        button_text_color: "#ffffff",
        secondary_bg_color: "#2c2c2e",
      } as unknown as ThemeParams,
      "dark",
    );

    globalThis.document = previous;
    assert.equal(props.get("--secondary"), "#2c2c2e");
    assert.equal(props.get("--muted"), "#2c2c2e");
    assert.equal(props.get("--secondary-foreground"), "#ffffff");
    assert.equal(props.get("--accent-foreground"), "#ffffff");
  });

  it("does not paint dark text on a light panel", () => {
    const light = panelColor(
      {
        bg_color: "#1c1c1e",
        text_color: "#ffffff",
        secondary_bg_color: "#f2f2f7",
      } as unknown as ThemeParams,
      "dark",
    );
    assert.equal(light, "#1c1c1e");
    const dark = panelColor(
      {
        bg_color: "#1c1c1e",
        secondary_bg_color: "#2c2c2e",
      } as unknown as ThemeParams,
      "dark",
    );
    assert.equal(dark, "#2c2c2e");
    const day = panelColor(
      {
        bg_color: "#ffffff",
        secondary_bg_color: "#f2f2f7",
      } as unknown as ThemeParams,
      "light",
    );
    assert.equal(day, "#f2f2f7");
  });
});

describe("groq model", () => {
  it("replaces the retired free-tier models", () => {
    assert.equal(resolveGroqModel(undefined), "openai/gpt-oss-20b");
    assert.equal(resolveGroqModel("  "), "openai/gpt-oss-20b");
    assert.equal(resolveGroqModel("llama-3.1-8b-instant"), "openai/gpt-oss-20b");
    assert.equal(resolveGroqModel("llama-3.3-70b-versatile"), "openai/gpt-oss-20b");
    assert.equal(resolveGroqModel("openai/gpt-oss-120b"), "openai/gpt-oss-120b");
  });
});

describe("gemini text", () => {
  it("skips thought parts that hide the brief", () => {
    assert.equal(
      textFromGeminiParts([
        { thought: true, text: "internal" },
        { text: "Как прошла неделя." },
      ]),
      "Как прошла неделя.",
    );
    assert.equal(textFromGeminiParts([{ thought: true, text: "only thought" }]), "");
  });
});

describe("week access", () => {
  const now = new Date("2026-10-09T12:00:00.000Z");

  it("starts a 14-day trial on the first open and keeps the intro unread", () => {
    const opened = openWeekAccess(emptyWeekAccess(), now);
    assert.equal(opened.openedAt, now.toISOString());
    assert.equal(opened.introSeen, false);
    assert.equal(openWeekAccess(opened, new Date(now.getTime() + 1000)).openedAt, opened.openedAt);

    const view = describeWeekAccess(opened, now, 150);
    assert.equal(view.status, "trial");
    assert.equal(view.daysLeft, 14);
    assert.equal(view.starPrice, 150);
    assert.equal(view.introSeen, false);
    assert.equal(describeWeekAccess(markWeekIntroSeen(opened), now).introSeen, true);
  });

  it("locks the week after the fortnight and lets a later payment win", () => {
    const opened = openWeekAccess(emptyWeekAccess(), new Date(now.getTime() - TRIAL_MS));
    assert.equal(describeWeekAccess(opened, now).status, "locked");

    const during = describeWeekAccess(
      openWeekAccess(emptyWeekAccess(), new Date(now.getTime() - TRIAL_MS + 60_000)),
      now,
    );
    assert.equal(during.status, "trial");
    assert.equal(during.daysLeft, 1);

    const paid = grantWeekPaidUntil(opened, "2026-11-08T12:00:00.000Z");
    assert.equal(describeWeekAccess(paid, now).status, "paid");
    const renewed = grantWeekPaidUntil(paid, "2026-11-01T12:00:00.000Z");
    assert.equal(renewed.paidUntil, paid.paidUntil);
    const later = grantWeekPaidUntil(paid, "2026-12-08T12:00:00.000Z");
    assert.equal(later.paidUntil, "2026-12-08T12:00:00.000Z");
  });

  it("counts days and falls back to 150 stars", () => {
    assert.equal(daysPhrase(1), "1 день");
    assert.equal(daysPhrase(2), "2 дня");
    assert.equal(daysPhrase(5), "5 дней");
    assert.equal(daysPhrase(11), "11 дней");
    assert.equal(daysPhrase(21), "21 день");
    assert.equal(starPriceFromEnv(undefined), 150);
    assert.equal(starPriceFromEnv("150"), 150);
    assert.equal(starPriceFromEnv("0"), 150);
    assert.equal(starPriceFromEnv("10001"), 150);
    assert.equal(starPriceFromEnv("12.5"), 150);
  });
});

describe("languages", () => {
  it("maps Telegram language codes onto audience languages", () => {
    assert.equal(localeFromTelegram("en-US"), "en");
    assert.equal(localeFromTelegram("pt-BR"), "pt");
    assert.equal(localeFromTelegram("in"), "id");
    assert.equal(localeFromTelegram("fa"), "fa");
    assert.equal(localeFromTelegram("de"), null);
    assert.equal(localeFromTelegram(undefined), null);
  });

  it("keeps every catalog on the same keys and pluralizes days", () => {
    assert.equal(catalogsShareKeys(), true);
    assert.equal(countPhrase("ru", 1, "day"), "1 день");
    assert.equal(countPhrase("ru", 2, "day"), "2 дня");
    assert.equal(countPhrase("ru", 5, "day"), "5 дней");
    assert.equal(countPhrase("ru", 11, "day"), "11 дней");
    assert.equal(countPhrase("ru", 21, "day"), "21 день");
    assert.equal(countPhrase("en", 1, "note"), "1 note");
    assert.equal(countPhrase("en", 2, "note"), "2 notes");
    assert.equal(translate("ru", "helloDev", { name: "Гость" }), "Привет, Гость · режим разработки");
    assert.equal(translate("en", "helloDev", { name: "Guest" }), "Hello, Guest · development mode");
    assert.equal(feelingLabel("en", "тревожно"), "anxious");
    assert.equal(feelingLabel("ru", "тревожно"), "тревожно");
  });

  it("keeps bot replies on the chosen language and the greeting on the device", () => {
    assert.equal(resolveBotLocale("en", "ru", "hi"), "en");
    assert.equal(resolveBotLocale(null, "hi", "en"), "hi");
    assert.equal(resolveBotLocale(null, null, "pt-BR"), "pt");
    assert.equal(resolveBotLocale(null, null, "de"), "ru");
    assert.equal(resolveGreetingLocale("en-US", "ru", "hi"), "en");
    assert.equal(resolveGreetingLocale(null, "id", "ru"), "id");
    assert.equal(resolveGreetingLocale(undefined, null, "de"), "ru");
    assert.equal(
      translate("ru", "botHelp").split("\n")[0],
      "Between — дневник к сеансу.",
    );
    assert.match(pollText("morning"), /Утро/);
    assert.match(pollText("morning", "en"), /Morning/);
    const board = feelingKeyboard("morning", "en");
    assert.equal(board.inline_keyboard[0][0].text, "anxious");
    assert.equal(board.inline_keyboard[0][0].callback_data, "c:m:0");
    assert.equal(parseFeelingCallback("c:m:0")?.feeling, "тревожно");
  });

  it("lets an explicit language choice win the header greeting", () => {
    assert.equal(resolveAppGreetingLocale("en", "ru"), "en");
    assert.equal(resolveAppGreetingLocale(null, "ru"), "ru");
    assert.equal(translate("en", "hello", { name: "Анастасия" }), "Hello, Анастасия");
    assert.equal(translate("ru", "hello", { name: "Анастасия" }), "Привет, Анастасия");
  });

  it("translates a rule brief only when copy is passed", () => {
    const input = {
      weekEntries: [note({ id: "a", body: "разговор с мамой", feelings: ["тревожно"], tags: ["мама"] })],
      prevEntries: [] as ReturnType<typeof note>[],
      talkNotes: "",
      todayKey: "2026-10-09",
    };
    const russian = buildRuleBrief(input);
    assert.match(russian, /тревожно — 1/);
    assert.match(russian, /Записи:\n/);
    const english = buildRuleBrief({
      ...input,
      copy: {
        empty: "empty",
        most: "Most often: {main}.",
        mostPast: "Most often: {main}. {compared}.",
        past: "{feeling} last week was {count}",
        themes: "Themes: {list}.",
        carried: "Carried: {list}.",
        entries: "Notes:",
        today: "today",
        say: "Say: {talk}",
        talkEmpty: "Nothing to say yet.",
        feeling: (feeling) => feelingLabel("en", feeling),
      },
    });
    assert.match(english, /Most often: anxious — 1/);
    assert.match(english, /Notes:\ntoday/);
    assert.equal(buildRuleBrief(input), russian);
  });
});

describe("digest", () => {
  it("nudges at 21:00 only when the day has no note", () => {
    const store = emptyStore();
    assert.equal(
      digestAction({ localHour: 21, dateKey: "2026-10-09", store, alreadySent: false }).type,
      "nudge",
    );
    store.entries = [note({ id: "n", body: "была заметка" })];
    assert.equal(
      digestAction({ localHour: 21, dateKey: "2026-10-09", store, alreadySent: false }).type,
      "skip",
    );
    store.notify = { moodPolls: false, eveningNudge: true, updatedAt: "1" };
    assert.equal(
      digestAction({ localHour: 9, dateKey: "2026-10-09", store, alreadySent: false }).type,
      "skip",
    );
    store.notify = { moodPolls: true, eveningNudge: true, updatedAt: "1" };
    const morning = digestAction({
      localHour: 9,
      dateKey: "2026-10-09",
      store,
      alreadySent: false,
    });
    assert.equal(morning.type, "poll");
    if (morning.type === "poll") assert.equal(morning.slot, "morning");
  });
});

function session(date: string, id = date): SessionNote {
  return {
    id,
    date,
    summary: "",
    insights: "",
    homework: "",
    weekKey: "",
    updatedAt: `${date}T12:00:00.000Z`,
  };
}

describe("therapy week", () => {
  it("starts the day after the last session, not on Monday", () => {
    const period = therapyWindow(
      [session("2026-10-08"), session("2026-10-01", "earlier")],
      [
        note({ id: "before", date: "2026-10-07", body: "до сеанса" }),
        note({ id: "after", date: "2026-10-09", body: "после сеанса" }),
        note({ id: "mon", date: "2026-10-12", body: "понедельник" }),
      ],
      "2026-10-14",
    );
    assert.equal(period.last?.date, "2026-10-08");
    assert.equal(period.days[0], "2026-10-09");
    assert.equal(period.days.at(-1), "2026-10-14");
    assert.equal(period.days.includes("2026-10-08"), false);
    assert.equal(period.days.includes("2026-10-12"), true);
    assert.equal(period.previousDays[0], "2026-10-02");
    assert.equal(period.previousDays.at(-1), "2026-10-08");
  });

  it("ignores a session dated after today", () => {
    const period = therapyWindow(
      [session("2026-10-20"), session("2026-10-08")],
      [],
      "2026-10-14",
    );
    assert.equal(period.last?.date, "2026-10-08");
    assert.equal(period.days[0], "2026-10-09");
  });

  it("starts from the first note when no session is saved", () => {
    const period = therapyWindow(
      [],
      [note({ id: "first", date: "2026-10-10", body: "первая" })],
      "2026-10-14",
    );
    assert.equal(period.last, null);
    assert.equal(period.days[0], "2026-10-10");
    assert.equal(period.days.at(-1), "2026-10-14");
    assert.deepEqual(period.previousDays, []);
  });
});

describe("summary copy", () => {
  it("includes every note after the session, not only the highlighted edges", () => {
    const long = "длинная запись ".repeat(20).trim();
    const bodies = ["один", "два", "три", "четыре", "пять", "шесть", long];
    const entries = bodies.map((body, index) =>
      note({
        id: `n${index}`,
        date: `2020-01-${String(index + 2).padStart(2, "0")}`,
        body,
        feelings: index === 0 ? ["радость"] : index === 3 ? ["тяжело"] : ["тревожно"],
      }),
    );
    entries.push(note({ id: "before", date: "2019-12-20", body: "до сеанса" }));
    const summary = buildPeriodSummary(entries, [session("2020-01-01")]);
    assert.ok(summary);
    assert.equal(summary.entries.length, 7);
    assert.ok(summary.highlights.length < summary.entries.length);
    for (const body of bodies) assert.equal(summary.plainText.includes(body), true);
    assert.equal(summary.plainText.includes("до сеанса"), false);
    assert.equal(summary.plainText.includes("…"), false);
  });
});
