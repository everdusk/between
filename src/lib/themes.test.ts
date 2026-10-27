import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Feeling, JournalEntry, SessionTheme } from "./types";
import {
  addManualTheme,
  applyVerdict,
  briefWordLimit,
  buildSessionBrief,
  clipPattern,
  dismissTheme,
  openThemes,
  parseJudgeVerdict,
  sameProblemTitle,
  settleEntry,
  themeScore,
  verbatimQuote,
  type BriefCopy,
  type JudgeVerdict,
} from "./themes";

function entry(
  id: string,
  body: string,
  feelings: Feeling[] = [],
  date = "2026-10-27",
): Pick<JournalEntry, "id" | "date" | "body" | "feelings"> {
  return { id, date, body, feelings };
}

function verdict(partial: Partial<JudgeVerdict>): JudgeVerdict {
  return {
    relevant: true,
    matchTheme: null,
    intensity: 8,
    newTheme: null,
    confidence: 0.9,
    quote: "",
    reason: "",
    ...partial,
  };
}

const COPY: BriefCopy = {
  header: "С последнего сеанса ({date}) — {entries}, {days}.",
  headerOpen: "С начала записей — {entries}, {days}.",
  moodUp: "К концу легче.",
  moodDown: "К концу тяжелее.",
  moodFlat: "Без сдвига.",
  anomaly: "{day} — {themes}",
  discussed: "Обсудили",
  returned: "вернулась",
  mark: {
    new: "новая",
    returned: "вернулась после сеанса",
    week2: "вторую неделю подряд",
    week3: "третью неделю подряд",
  },
};

describe("theme judge", () => {
  it("leaves a plain errand with no feeling off the list", () => {
    const result = applyVerdict(
      { themes: [], links: [] },
      entry("e1", "Купил хлеб, день норм"),
      verdict({ relevant: false, intensity: 1, confidence: 0.2, newTheme: "покупки" }),
    );
    assert.equal(result.touchedId, null);
    assert.equal(result.state.themes.length, 0);
  });

  it("matches an open theme about mom and does not create a second one", () => {
    const existing: SessionTheme = {
      id: "mom",
      userId: "local",
      title: "конфликты с мамой",
      status: "active",
      count: 1,
      firstSeen: "2026-10-20",
      lastSeen: "2026-10-20",
      peakIntensity: 6,
      reopened: false,
      dismissed: false,
      confidence: 0.8,
      summary: "конфликты с мамой",
      quotes: [],
      updatedAt: "2026-10-20T00:00:00.000Z",
    };
    const note = entry("e2", "Мама опять обиделась из-за праздника", ["злость"], "2026-10-27");
    const result = applyVerdict(
      { themes: [existing], links: [{ entryId: "e0", themeId: "mom", confidence: 0.8 }] },
      note,
      verdict({
        matchTheme: "mom",
        quote: "Мама опять обиделась из-за праздника",
        newTheme: "ссора с мамой из-за праздника",
      }),
    );
    assert.equal(result.touchedId, "mom");
    assert.equal(result.state.themes.length, 1);
    assert.equal(result.state.themes[0].count, 2);
    assert.equal(result.state.themes[0].quotes[0].text, "Мама опять обиделась из-за праздника");
  });

  it("drops the previous theme count when a note moves", () => {
    const shame: SessionTheme = {
      id: "shame",
      userId: "local",
      title: "стыд после сеанса",
      status: "active",
      count: 1,
      firstSeen: "2026-10-22",
      lastSeen: "2026-10-22",
      peakIntensity: 8,
      reopened: false,
      dismissed: false,
      confidence: 0.9,
      summary: "стыд после сеанса",
      quotes: [],
      updatedAt: "2026-10-22T00:00:00.000Z",
    };
    const mom: SessionTheme = {
      id: "mom",
      userId: "local",
      title: "конфликты с мамой",
      status: "active",
      count: 1,
      firstSeen: "2026-10-20",
      lastSeen: "2026-10-20",
      peakIntensity: 6,
      reopened: false,
      dismissed: false,
      confidence: 0.8,
      summary: "конфликты с мамой",
      quotes: [],
      updatedAt: "2026-10-20T00:00:00.000Z",
    };
    const note = entry("e9", "Мама опять обиделась из-за праздника", ["злость"], "2026-10-27");
    const result = applyVerdict(
      {
        themes: [shame, mom],
        links: [{ entryId: "e9", themeId: "shame", confidence: 0.9 }],
      },
      note,
      verdict({ matchTheme: "mom", quote: "Мама опять обиделась из-за праздника" }),
    );
    const nextShame = result.state.themes.find((theme) => theme.id === "shame");
    const nextMom = result.state.themes.find((theme) => theme.id === "mom");
    assert.equal(nextShame?.count, 0);
    assert.equal(nextMom?.count, 1);
    assert.equal(result.state.links.filter((link) => link.entryId === "e9").length, 1);
  });

  it("creates a theme from a calm sentence when the person marked high anxiety", () => {
    const result = applyVerdict(
      { themes: [], links: [] },
      entry("e3", "Всё нормально", ["тревожно"]),
      verdict({
        intensity: 8,
        confidence: 0.8,
        newTheme: "тревога, которую трудно признать",
        quote: "Всё нормально",
      }),
    );
    assert.equal(result.state.themes.length, 1);
    assert.equal(result.state.themes[0].title, "тревога, которую трудно признать");
    assert.equal(result.state.themes[0].status, "active");
  });

  it("keeps a pattern title instead of the episode sentence", () => {
    const body = "Поругалась из-за телефона";
    const result = applyVerdict(
      { themes: [], links: [] },
      entry("e4", body, ["злость"]),
      verdict({ newTheme: "конфликты с мамой из-за границ", quote: body }),
    );
    assert.equal(result.state.themes[0].title, "конфликты с мамой из-за границ");
    assert.notEqual(result.state.themes[0].title, body);
  });

  it("reopens a discussed theme and boosts its score", () => {
    const discussed: SessionTheme = {
      id: "mom",
      userId: "local",
      title: "конфликты с мамой",
      status: "discussed",
      count: 2,
      firstSeen: "2026-10-01",
      lastSeen: "2026-10-10",
      peakIntensity: 6,
      reopened: false,
      dismissed: false,
      confidence: 0.8,
      summary: "конфликты с мамой",
      quotes: [],
      updatedAt: "2026-10-10T00:00:00.000Z",
    };
    const result = applyVerdict(
      { themes: [discussed], links: [] },
      entry("e5", "Мама снова позвонила", ["грусть"], "2026-10-27"),
      verdict({ matchTheme: "mom", quote: "Мама снова позвонила" }),
    );
    const theme = result.state.themes[0];
    assert.equal(theme.status, "active");
    assert.equal(theme.reopened, true);
    assert.ok(openThemes(result.state.themes).some((item) => item.id === "mom"));
    const quiet = themeScore({ ...theme, reopened: false }, "2026-10-27", []);
    assert.ok(themeScore(theme, "2026-10-27", []) >= quiet + 4);
  });

  it("does not resurrect a theme the person dismissed", () => {
    const gone = dismissTheme(
      [
        {
          id: "mom",
          userId: "local",
          title: "конфликты с мамой",
          status: "active",
          count: 2,
          firstSeen: "2026-10-01",
          lastSeen: "2026-10-10",
          peakIntensity: 6,
          reopened: false,
          dismissed: false,
          confidence: 0.8,
          summary: "конфликты с мамой",
          quotes: [],
          updatedAt: "2026-10-10T00:00:00.000Z",
        },
      ],
      "mom",
    );
    const matched = applyVerdict(
      { themes: gone, links: [] },
      entry("e6", "Мама опять написала", ["злость"]),
      verdict({ matchTheme: "mom", newTheme: "конфликты с мамой из-за границ" }),
    );
    assert.equal(matched.state.themes.filter((theme) => !theme.dismissed).length, 0);
    const reborn = applyVerdict(
      { themes: gone, links: [] },
      entry("e7", "Снова разговор с мамой про границы", ["злость"]),
      verdict({ newTheme: "конфликты с мамой из-за границ", quote: "Снова разговор с мамой про границы" }),
    );
    assert.equal(reborn.state.themes.filter((theme) => !theme.dismissed).length, 0);
    assert.equal(sameProblemTitle("конфликты с мамой", "конфликты с мамой из-за границ"), true);
  });

  it("drops a quote that is not in the note", () => {
    assert.equal(verbatimQuote("Мама позвонила", "мы снова поссорились"), "");
  });

  it("merges a theme in the same pass when a match makes it the same problem", () => {
    const older: SessionTheme = {
      id: "a",
      userId: "local",
      title: "конфликты с мамой",
      status: "active",
      count: 2,
      firstSeen: "2026-10-01",
      lastSeen: "2026-10-12",
      peakIntensity: 7,
      reopened: false,
      dismissed: false,
      confidence: 0.9,
      summary: "конфликты с мамой",
      quotes: [{ entryId: "old", text: "Мама кричала", date: "2026-10-12", intensity: 7 }],
      updatedAt: "2026-10-12T00:00:00.000Z",
    };
    const younger: SessionTheme = {
      id: "b",
      userId: "local",
      title: "мама и границы",
      status: "active",
      count: 1,
      firstSeen: "2026-10-20",
      lastSeen: "2026-10-20",
      peakIntensity: 6,
      reopened: false,
      dismissed: false,
      confidence: 0.8,
      summary: "мама и границы",
      quotes: [],
      updatedAt: "2026-10-20T00:00:00.000Z",
    };
    const next = settleEntry(
      {
        themes: [older, younger],
        links: [{ entryId: "old", themeId: "a", confidence: 0.9 }],
      },
      entry("e8", "Мама опять про границы", ["злость"], "2026-10-27"),
      verdict({ matchTheme: "b", quote: "Мама опять про границы" }),
      () => ({ themeId: "a", confidence: 0.9, title: "конфликты с мамой из-за границ" }),
    );
    assert.equal(next.themes.length, 1);
    assert.equal(next.themes[0].id, "a");
    assert.equal(next.themes[0].title, "конфликты с мамой из-за границ");
    assert.equal(next.themes[0].count, 2);
    assert.ok(next.links.every((link) => link.themeId === "a"));
  });

  it("keeps a migration of thirty notes inside seven themes", () => {
    let state = { themes: [] as SessionTheme[], links: [] as { entryId: string; themeId: string; confidence: number }[] };
    const buckets = ["стыд за детское", "обман в близости", "злость и уход", "сны про угрозу", "брать в отношениях"];
    for (let index = 0; index < 30; index += 1) {
      const bucket = index % 5;
      const body = `Запись ${index} про ${buckets[bucket]}`;
      const open = state.themes.find((theme) => theme.title === buckets[bucket]);
      state = settleEntry(
        state,
        entry(`n${index}`, body, ["грусть"], `2026-10-${String((index % 27) + 1).padStart(2, "0")}`),
        verdict({
          matchTheme: open?.id ?? null,
          newTheme: open ? null : buckets[bucket],
          quote: body,
          intensity: 6,
          confidence: 0.9,
        }),
      );
    }
    assert.ok(state.themes.length <= 7);
    assert.equal(new Set(state.themes.map((theme) => theme.title)).size, state.themes.length);
  });
});

describe("session brief", () => {
  it("stays within 300 words and keeps quotes verbatim", () => {
    const themes: SessionTheme[] = Array.from({ length: 6 }, (_, index) => ({
      id: `t${index}`,
      userId: "local",
      title: `паттерн номер ${index} в отношениях и самооценке`,
      status: "active" as const,
      count: index + 1,
      firstSeen: "2026-10-01",
      lastSeen: "2026-10-27",
      peakIntensity: 8,
      peakFeeling: "стыд" as const,
      reopened: index === 0,
      dismissed: false,
      confidence: 0.9,
      summary: `паттерн ${index}`,
      quotes: [
        {
          entryId: `e${index}`,
          text: "я чувствую себя дурой после сеанса и не понимаю, зачем снизила градус",
          date: "2026-10-22",
          intensity: 8,
        },
        {
          entryId: `f${index}`,
          text: "снилось что прихожу в квартиру где меня в детстве совратили",
          date: "2026-10-19",
          intensity: 9,
        },
      ],
      updatedAt: "2026-10-27T00:00:00.000Z",
    }));
    const brief = buildSessionBrief({
      themes,
      entries: [
        {
          id: "e0",
          date: "2026-10-22",
          createdAt: "2026-10-22T00:00:00.000Z",
          updatedAt: "2026-10-22T00:00:00.000Z",
          body: "я чувствую себя дурой после сеанса",
          feelings: ["стыд"],
          tags: [],
          source: "app",
        },
      ],
      sessionDates: ["2026-10-15"],
      lastSession: {
        id: "s",
        date: "2026-10-15",
        summary: "",
        insights: "",
        homework: "",
        weekKey: "2026-W42",
        updatedAt: "2026-10-15T00:00:00.000Z",
      },
      todayKey: "2026-10-27",
      copy: COPY,
      dayLabel: (date) => date,
      longDate: (date) => date,
      feelingLabel: (feeling) => feeling,
      entryPhrase: (count) => `${count} записей`,
      dayPhrase: (count) => `${count} дней`,
    });
    assert.ok(brief.themes.length >= 3 && brief.themes.length <= 4);
    assert.ok(
      brief.themes.some((theme) => theme.quotes.some((quote) => quote.text.includes("дурой"))),
    );
    const pattern = clipPattern(
      brief.words,
      "Стыд после сеанса стоит рядом со сном про квартиру из детства. Оба возвращаются в одних и тех же заметках. Это уже не разовый эпизод.",
    );
    const total =
      brief.words + pattern.split(/\s+/).filter(Boolean).length;
    assert.ok(total <= briefWordLimit());
    assert.match(brief.header, /2026-10-15/);
  });

  it("reads a judge object and ignores a fenced extra", () => {
    const parsed = parseJudgeVerdict(
      '```json\n{"relevant":true,"match_theme":null,"intensity":8,"new_theme":{"title":"стыд за детское"},"confidence":0.91,"quote":"дурой","reason":"стыд"}\n```',
    );
    assert.equal(parsed?.newTheme, "стыд за детское");
    assert.equal(parseJudgeVerdict('{"relevant":"yes"}'), null);
  });

  it("keeps an open theme that came back out of the discussed block", () => {
    const open = {
      id: "calm",
      userId: "local",
      title: "тревога, которую трудно признать",
      status: "active" as const,
      count: 1,
      firstSeen: "2026-10-24",
      lastSeen: "2026-10-24",
      peakIntensity: 8,
      reopened: true,
      dismissed: false,
      confidence: 0.9,
      summary: "тревога",
      quotes: [],
      updatedAt: "2026-10-24T00:00:00.000Z",
    };
    const said = { ...open, id: "mom", title: "конфликты с мамой из-за границ", status: "discussed" as const, reopened: false };
    const brief = buildSessionBrief({
      themes: [open, said],
      entries: [],
      sessionDates: ["2026-10-15"],
      lastSession: null,
      todayKey: "2026-10-27",
      copy: COPY,
      dayLabel: (date) => date,
      longDate: (date) => date,
      feelingLabel: (feeling) => feeling,
      entryPhrase: (count) => `${count} записей`,
      dayPhrase: (count) => `${count} дней`,
    });
    assert.deepEqual(
      brief.discussed.map((item) => item.id),
      ["mom"],
    );
    assert.equal(brief.themes[0]?.mark, "returned");
  });

  it("does not add a second copy of a theme typed by hand", () => {
    const once = addManualTheme([], "про дедлайн", "2026-10-27");
    const twice = addManualTheme(once, "про дедлайн", "2026-10-27");
    assert.equal(twice.length, 1);
  });
});
