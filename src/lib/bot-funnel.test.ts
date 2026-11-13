import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LOCALES } from "./i18n";
import { translate } from "./messages";
import { loadWelcomeImage } from "./welcome-photo";
import { welcomeCaption } from "./welcome-text";
import {
  emptyBotFunnel,
  formatBotFunnel,
  funnelCounterKey,
  loadBotFunnel,
  marksForChoice,
  recordBotFunnel,
  type BotFunnelCounts,
  type BotFunnelReport,
} from "./bot-funnel";

function memoryRedis() {
  const keys = new Map<string, number>();
  const sets = new Map<string, Set<string>>();
  return {
    keys,
    async sadd(key: string, member: string) {
      const set = sets.get(key) ?? new Set<string>();
      const before = set.size;
      set.add(member);
      sets.set(key, set);
      return set.size - before;
    },
    async expire() {
      return 1;
    },
    async incr(key: string) {
      const next = (keys.get(key) ?? 0) + 1;
      keys.set(key, next);
      return next;
    },
    async mget(...names: string[]) {
      return names.map((name) => keys.get(name) ?? null);
    },
  };
}

function filled(): BotFunnelCounts {
  const counts = emptyBotFunnel();
  counts.start = 20;
  counts.yes = 11;
  counts.no = 5;
  counts.days = 10;
  counts.weekdays[0] = 8;
  counts.weekdays[2] = 6;
  counts.time = 10;
  counts.hours[8] = 4;
  counts.hours[9] = 6;
  counts.mood = 14;
  counts.feelings[0] = 5;
  counts.feelings[1] = 4;
  counts.note = 9;
  return counts;
}

describe("bot funnel", () => {
  it("names the committed answers and skips a second tap", () => {
    assert.deepEqual(marksForChoice({ step: "yes" }), ["yes"]);
    assert.deepEqual(marksForChoice({ step: "days", days: [2, 0, 2] }), ["days", "wd0", "wd2"]);
    assert.deepEqual(marksForChoice({ step: "time", hour: 18 }), ["time", "h18"]);
    assert.deepEqual(marksForChoice({ step: "mood", feeling: "тревожно" }), ["mood", "f0"]);
    assert.deepEqual(marksForChoice({ step: "time", hour: 3 }), ["time"]);
  });

  it("counts one person once per day and keeps the id out of the keys", async () => {
    const redis = memoryRedis();
    const input = {
      userId: 424242,
      messenger: "telegram" as const,
      day: "2026-11-13",
      pepper: "pepper",
      choice: { step: "days" as const, days: [0, 3] },
    };
    await recordBotFunnel(redis, input);
    await recordBotFunnel(redis, input);
    await recordBotFunnel(redis, { ...input, userId: 7, choice: { step: "no" } });
    assert.equal(redis.keys.get(funnelCounterKey("2026-11-13", "telegram", "days")), 1);
    assert.equal(redis.keys.get(funnelCounterKey("2026-11-13", "telegram", "wd0")), 1);
    assert.equal(redis.keys.get(funnelCounterKey("2026-11-13", "telegram", "wd3")), 1);
    assert.equal(redis.keys.get(funnelCounterKey("2026-11-13", "telegram", "no")), 1);
    assert.equal([...redis.keys.keys()].some((key) => key.includes("424242")), false);
    await recordBotFunnel(redis, { ...input, userId: 9, day: "2026-11-12", choice: { step: "yes" } });

    const report = await loadBotFunnel(redis, new Date("2026-11-13T12:00:00.000Z"));
    assert.equal(report.windowDays, 1);
    assert.equal(report.totals.yes, 0);
    assert.equal(report.totals.days, 1);
    assert.equal(report.totals.weekdays[0], 1);
    assert.equal(report.totals.weekdays[3], 1);
    assert.equal(report.totals.no, 1);
    assert.equal(report.messengers.max.days, 0);
  });

  it("prints the quiz as one funnel", () => {
    const totals = filled();
    const today = emptyBotFunnel();
    today.start = 2;
    today.note = 1;
    const telegram = emptyBotFunnel();
    telegram.start = 14;
    const max = emptyBotFunnel();
    max.start = 6;
    const report: BotFunnelReport = {
      windowDays: 7,
      totals,
      today,
      messengers: { telegram, max },
    };
    const text = formatBotFunnel(report);
    assert.match(text, /^Воронка бота, 7 дн\./);
    assert.match(text, /Старт 20/);
    assert.match(text, /Терапевт 16 — да 11, нет 5/);
    assert.match(text, /Дни 10 — пн 8, ср 6/);
    assert.match(text, /Время 10 — 17:00 ×4, 18:00 ×6/);
    assert.match(text, /Настроение 14 — тревожно 5, спокойно 4/);
    assert.match(text, /Заметка 9/);
    assert.match(text, /Сегодня: старт 2, заметка 1/);
    assert.match(text, /Telegram 14 · MAX 6/);
    assert.equal(formatBotFunnel({ ...report, totals: emptyBotFunnel() }), "");
  });

  it("keeps the welcome caption inside a photo and reads the picture", async () => {
    for (const locale of LOCALES) {
      assert.ok(translate(locale.id, "botHelp").length <= 1024, locale.id);
      assert.ok(translate(locale.id, "botHelpMax").length <= 1024, locale.id);
      assert.ok(welcomeCaption(locale.id).length <= 1024, locale.id);
      assert.match(welcomeCaption(locale.id), /150 ₽/);
    }
    const bytes = await loadWelcomeImage();
    assert.ok(bytes);
    assert.equal(bytes[0], 0x89);
    assert.equal(bytes[1], 0x50);
    assert.ok(bytes.byteLength > 10_000);
  });
});
