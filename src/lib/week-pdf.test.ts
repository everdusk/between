import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { buildWeekPdfModel, feelingRgb, oklchToRgb } from "./week-pdf-model";
import { renderWeekPdf, type WeekPdfFonts } from "./week-pdf";
import type { JournalEntry, SessionTheme, ThemeLink } from "./types";

function theme(partial: Partial<SessionTheme> & Pick<SessionTheme, "id" | "title" | "status">): SessionTheme {
  return {
    userId: "1",
    count: 2,
    firstSeen: "2026-11-05",
    lastSeen: "2026-11-07",
    peakIntensity: 3,
    reopened: false,
    dismissed: false,
    confidence: 0.8,
    summary: partial.title,
    quotes: [],
    updatedAt: "2026-11-07T00:00:00.000Z",
    ...partial,
  };
}

function entry(partial: Partial<JournalEntry> & Pick<JournalEntry, "id" | "body">): JournalEntry {
  return {
    date: "2026-11-07",
    createdAt: "2026-11-07T08:00:00.000Z",
    updatedAt: "2026-11-07T08:00:00.000Z",
    feelings: ["тревожно"],
    tags: [],
    source: "bot",
    ...partial,
  };
}

const days = ["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"];

function model(themes: SessionTheme[], entries: JournalEntry[], links: ThemeLink[]) {
  return buildWeekPdfModel({
    todayKey: "2026-11-11",
    dayKeys: days,
    entries,
    themes,
    links,
    now: new Date("2026-11-11T12:00:00.000Z"),
    range: "5–11 ноября",
    spectrumLabel: "Спектр недели",
    spectrumTitle: "тревожно",
    spectrumLead: "Чаще всего — тревожно.",
    axis: "Слева легче, справа тяжелее",
    patternTitle: "Что смотрится как паттерн",
    patternText: "Тревога перед встречами возвращается по утрам.",
    backlogTitle: "Что обсудить",
    backlogLead: "Название открывает записи.",
    emptyBacklog: "Пока пусто.",
    noNotes: "К этой теме пока не привязана запись.",
    said: "Уже сказано",
    weekday: () => "ср",
    dayNumber: (day) => String(Number(day.slice(8))),
    when: (day) => day,
    feeling: (value) => value,
    noteCount: (count) => `${count} записи`,
  });
}

describe("week pdf", () => {
  it("keeps the feeling yellow warmer than the heavy end", () => {
    const joy = oklchToRgb(0.8, 0.12, 95);
    const heavy = feelingRgb("тяжело");
    assert.ok(joy.r > joy.b);
    assert.ok(heavy.b >= heavy.r);
  });

  it("puts linked notes under the backlog title and leaves out dismissed and archived ones", () => {
    const linked = entry({ id: "e1", body: "Перед встречей снова тревожно" });
    const other = entry({ id: "e2", body: "Утро тихое", feelings: ["спокойно"] });
    const built = model(
      [
        theme({ id: "open", title: "Тревога перед встречей", status: "active" }),
        theme({ id: "gone", title: "Убранная тема", status: "active", dismissed: true }),
        theme({
          id: "old",
          title: "Старое",
          status: "discussed",
          discussedAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
        }),
        theme({ id: "bare", title: "Без записей", status: "active", count: 1 }),
      ],
      [linked, other],
      [{ entryId: "e1", themeId: "open", confidence: 0.9 }],
    );
    assert.deepEqual(
      built.themes.map((item) => item.title),
      ["Тревога перед встречей", "Без записей"],
    );
    assert.equal(built.themes[0].notes[0].body, "Перед встречей снова тревожно");
    assert.equal(built.themes[0].notes[0].feelings[0].label, "тревожно");
    assert.equal(built.themes[1].empty, "К этой теме пока не привязана запись.");
    assert.equal(built.emptyBacklog, null);
    assert.equal(built.patternText.includes("по утрам"), true);
    assert.equal(built.days.length, 7);
    assert.equal(built.filename, "between-2026-11-05_2026-11-11.pdf");
  });

  it("renders a night sheet the fonts can encode", async () => {
    const fonts: WeekPdfFonts = {
      display: new Uint8Array(await readFile("public/fonts/Unbounded-SemiBold.ttf")),
      text: new Uint8Array(await readFile("public/fonts/Manrope-Regular.ttf")),
      strong: new Uint8Array(await readFile("public/fonts/Manrope-SemiBold.ttf")),
      arabic: new Uint8Array(await readFile("public/fonts/NotoSansArabic-Regular.ttf")),
      devanagari: new Uint8Array(await readFile("public/fonts/NotoSansDevanagari-Regular.ttf")),
    };
    const linked = entry({ id: "e1", body: "Перед встречей снова тревожно\nИ вечером тоже." });
    const built = model(
      [theme({ id: "open", title: "Тревога перед встречей", status: "active" })],
      [linked, entry({ id: "e2", body: "Спокойный вечер", feelings: ["спокойно"], date: "2026-11-08" })],
      [{ entryId: "e1", themeId: "open", confidence: 0.9 }],
    );
    const bytes = await renderWeekPdf(built, fonts);
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
    assert.ok(bytes.byteLength > 8_000);
  });
});
