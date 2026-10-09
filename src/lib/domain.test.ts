import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRuleBrief } from "./brief";
import { buildWeekSpectrum, spectrumHeadline } from "./spectrum";
import { digestAction } from "./digest";
import { mergeStores } from "./journal-api";
import { normalizeStore } from "./migrate";
import { nextWeeklyOccurrence } from "./session-plan";
import { suggestTags } from "./tags";
import type { ThemeParams } from "@twa-dev/types";
import { applyTelegramTheme, panelColor } from "./telegram";
import { resolveGroqModel, textFromGeminiParts } from "../app/api/brief/route";
import { emptyStore, type JournalEntry } from "./types";

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
