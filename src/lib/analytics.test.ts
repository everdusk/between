import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyticsDedupToken, loadAnalyticsReport, recordAnalytics, type AnalyticsRedis } from "./analytics";
import { captureServerProduct, productDistinctId } from "./product-analytics-server";
import {
  acceptClientEvent,
  clientMessenger,
  analyticsCohortKey,
  analyticsCounterKey,
  analyticsDedupKey,
  formatAnalyticsReport,
  analyticsQuiet,
  isAnalyticsOwner,
  pollChatQuiet,
  statsWindow,
  quietClientLaunch,
  messengerEventName,
  parseMessengerEvent,
  planAnalyticsSend,
  scrubProductEvent,
  snapshotFromReads,
  sumCountRows,
} from "./analytics-model";
import { posthogBrowserConfig } from "./posthog-env";

function memoryRedis(): AnalyticsRedis & { keys: Map<string, number>; sets: Map<string, Set<string>> } {
  const keys = new Map<string, number>();
  const sets = new Map<string, Set<string>>();
  return {
    keys,
    sets,
    async sadd(key, member) {
      const set = sets.get(key) ?? new Set<string>();
      const before = set.size;
      set.add(member);
      sets.set(key, set);
      return set.size - before;
    },
    async expire() {
      return 1;
    },
    async incr(key) {
      const next = (keys.get(key) ?? 0) + 1;
      keys.set(key, next);
      return next;
    },
    async mget(...names: string[]) {
      return names.map((name) => keys.get(name) ?? null);
    },
  };
}

describe("analytics", () => {
  it("counts a visit once per person per day and keeps the id out of the keys", async () => {
    const redis = memoryRedis();
    const first = await recordAnalytics(redis, {
      userId: 424242,
      event: "visit",
      messenger: "telegram",
      day: "2026-11-01",
      cohort: "2026-11-01",
      offset: 0,
      pepper: "pepper",
    });
    const again = await recordAnalytics(redis, {
      userId: 424242,
      event: "visit",
      messenger: "telegram",
      day: "2026-11-01",
      cohort: "2026-10-01",
      offset: 31,
      pepper: "pepper",
    });
    const other = await recordAnalytics(redis, {
      userId: 424242,
      event: "visit",
      messenger: "max",
      day: "2026-11-01",
      pepper: "pepper",
    });
    assert.equal(first, "counted");
    assert.equal(again, "duplicate");
    assert.equal(other, "counted");
    assert.equal(redis.keys.get(analyticsCounterKey("2026-11-01", "visit", "telegram")), 1);
    assert.equal(redis.keys.get(analyticsCounterKey("2026-11-01", "visit", "max")), 1);
    assert.equal(redis.keys.has(analyticsCounterKey("2026-11-01", "visit")), false);
    const site = await recordAnalytics(redis, {
      userId: "web:abc123device",
      event: "note",
      messenger: "web",
      day: "2026-11-01",
      pepper: "pepper",
    });
    assert.equal(site, "counted");
    assert.equal(redis.keys.get(analyticsCounterKey("2026-11-01", "note", "web")), 1);
    assert.equal(redis.keys.has(analyticsCounterKey("2026-11-01", "note", "telegram")), false);
    assert.equal(redis.keys.get(analyticsCohortKey("2026-11-01", 0, "telegram")), 1);
    assert.equal(redis.keys.has(analyticsCohortKey("2026-10-01", 31, "telegram")), false);
  });

  it("counts one return inside the week, not a visit on every later day", async () => {
    const redis = memoryRedis();
    const base = {
      userId: 7,
      event: "visit" as const,
      messenger: "telegram" as const,
      cohort: "2026-11-01",
      pepper: "pepper",
    };
    await recordAnalytics(redis, { ...base, day: "2026-11-01", offset: 0 });
    await recordAnalytics(redis, { ...base, day: "2026-11-04", offset: 3 });
    await recordAnalytics(redis, { ...base, day: "2026-11-06", offset: 5 });
    await recordAnalytics(redis, { ...base, day: "2026-11-09", offset: 8 });
    assert.equal(redis.keys.get(analyticsCohortKey("2026-11-01", 0, "telegram")), 1);
    assert.equal(redis.keys.get(analyticsCohortKey("2026-11-01", 8, "telegram")), 1);
    assert.equal(redis.keys.has(analyticsCohortKey("2026-11-01", 3, "telegram")), false);
    assert.equal(redis.keys.has(analyticsCohortKey("2026-11-01", 5, "telegram")), false);
    const stored = [...redis.sets.keys(), ...redis.keys.keys(), ...[...redis.sets.values()].flatMap((set) => [...set])];
    assert.equal(stored.some((value) => value.includes("424242") || value.includes("abc123device")), false);
    assert.equal([...redis.sets.keys()].includes(analyticsDedupKey("2026-11-01")), true);
  });

  it("counts the step when the dedup key cannot store a ttl", async () => {
    const redis = memoryRedis();
    redis.expire = async () => {
      throw new Error("ttl");
    };
    const result = await recordAnalytics(redis, {
      userId: 7,
      event: "paid",
      messenger: "web",
      day: "2026-11-09",
      salt: "yk-1",
      pepper: "pepper",
    });
    assert.equal(result, "counted");
    assert.equal(redis.keys.get(analyticsCounterKey("2026-11-09", "paid", "web")), 1);
  });

  it("keeps a MAX launch out of the website column", () => {
    assert.equal(clientMessenger("", "user=1&hash=ab"), "max");
    assert.equal(clientMessenger("user=1", "user=1&hash=ab"), "telegram");
    assert.equal(clientMessenger("", ""), "web");
    assert.equal(clientMessenger("  ", null), "web");
  });

  it("counts the same Stars charge once", async () => {
    const redis = memoryRedis();
    const input = {
      userId: 7,
      event: "paid" as const,
      messenger: "telegram" as const,
      day: "2026-11-01",
      salt: "charge-1",
      pepper: "pepper",
    };
    assert.equal(await recordAnalytics(redis, input), "counted");
    assert.equal(await recordAnalytics(redis, { ...input, day: "2026-11-02" }), "duplicate");
    assert.equal(redis.keys.get(analyticsCounterKey("2026-11-01", "paid", "telegram")), 1);
    assert.equal(redis.keys.has(analyticsCounterKey("2026-11-02", "paid", "telegram")), false);
  });

  it("rejects a client trying to report a payment or a distant day", () => {
    assert.equal(acceptClientEvent({ event: "paid", cohort: "2026-11-01", day: "2026-11-01" }, "2026-11-01").ok, false);
    assert.equal(
      acceptClientEvent({ event: "visit", cohort: "2026-11-01", day: "2026-10-01" }, "2026-11-01").ok,
      false,
    );
    const ok = acceptClientEvent({ event: "paywall", cohort: "2026-10-20", day: "2026-11-01" }, "2026-11-01");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.offset, 12);
  });

  it("remembers the first day on the device and sends each step once", () => {
    const first = planAnalyticsSend({ cohort: null, sent: {} }, "visit", "2026-11-01");
    assert.equal(first.send, true);
    assert.equal(first.cohort, "2026-11-01");
    const repeat = planAnalyticsSend(first.state, "visit", "2026-11-01");
    assert.equal(repeat.send, false);
    const next = planAnalyticsSend(
      { cohort: "2026-11-01", sent: { "2026-10-01": ["visit"], "2026-11-01": ["visit"] } },
      "note",
      "2026-11-02",
    );
    assert.equal(next.send, true);
    assert.equal(next.cohort, "2026-11-01");
    assert.equal(next.state.sent["2026-10-01"], undefined);
    assert.deepEqual(next.state.sent["2026-11-02"], ["note"]);
  });

  it("hides the week return until the next day and keeps the messengers apart", () => {
    const telegram = snapshotFromReads(
      "2026-11-01",
      [
        {
          day: "2026-11-01",
          counts: { visit: 4, note: 2, mood: 3, block: 1, plan: 2, week: 3, paywall: 1, checkout: 1, paid: 0 },
        },
      ],
      [
        { day: "2026-10-20", d0: 8, week: 3 },
        { day: "2026-11-01", d0: 4, week: 9 },
        { day: "2026-10-01", d0: 0, week: 0 },
      ],
    );
    const max = snapshotFromReads(
      "2026-11-01",
      [{ day: "2026-11-01", counts: { visit: 1, note: 1, mood: 1, block: 0, plan: 0, week: 0, paywall: 0, checkout: 0, paid: 0 } }],
      [],
    );
    const web = snapshotFromReads(
      "2026-11-01",
      [{ day: "2026-11-01", counts: { visit: 9, note: 0, mood: 0, block: 0, plan: 0, week: 2, paywall: 0, checkout: 0, paid: 0 } }],
      [],
    );
    const text = formatAnalyticsReport({
      today: telegram.today,
      windowDays: telegram.windowDays,
      messengers: { telegram, max, web },
    });
    assert.match(text, /Telegram[\s\S]*Визит 4[\s\S]*Заметка 2[\s\S]*Настроение 3[\s\S]*Блокировка 1[\s\S]*График 2/);
    assert.match(text, /MAX[\s\S]*Настроение 1/);
    assert.match(text, /MAX[\s\S]*Визит 1/);
    assert.doesNotMatch(text, /Сайт/);
    assert.doesNotMatch(text, /Визит 9/);
    assert.match(text, /Пейволл 1/);
    assert.match(text, /1 ноя — 4 новых, за неделю ещё нет/);
    assert.match(text, /20 окт — 8 новых, за неделю 3 из 8/);
    assert.doesNotMatch(text, /следующий день/);
    assert.doesNotMatch(text, /день 7/);
    assert.doesNotMatch(text, /1 окт/);
    assert.equal(text.includes("424242"), false);
    const merged = sumCountRows(
      [{ day: "2026-11-01", counts: telegram.todayCounts }],
      [{ day: "2026-11-01", counts: { visit: 3, note: 0, mood: 0, block: 0, plan: 0, week: 0, paywall: 0, checkout: 0, paid: 0 } }],
    );
    assert.equal(merged[0].counts.visit, 7);
  });

  it("starts the report on 13 Nov and prints only Telegram and MAX", async () => {
    assert.deepEqual(statsWindow("2026-11-13", 7), ["2026-11-13"]);
    assert.deepEqual(statsWindow("2026-11-12", 7), []);
    assert.equal(statsWindow("2026-11-20", 7).length, 7);
    assert.equal(statsWindow("2026-11-20", 7)[0], "2026-11-14");

    const redis = memoryRedis();
    const pepper = "pepper";
    await recordAnalytics(redis, {
      userId: 1,
      event: "visit",
      messenger: "telegram",
      day: "2026-11-12",
      pepper,
    });
    await recordAnalytics(redis, {
      userId: 2,
      event: "note",
      messenger: "telegram",
      day: "2026-11-13",
      pepper,
    });
    await recordAnalytics(redis, {
      userId: 3,
      event: "mood",
      messenger: "max",
      day: "2026-11-13",
      pepper,
    });
    await recordAnalytics(redis, {
      userId: "web:device",
      event: "visit",
      messenger: "web",
      day: "2026-11-13",
      pepper,
    });
    const report = await loadAnalyticsReport(redis, new Date("2026-11-13T12:00:00.000Z"));
    assert.equal(report.today, "2026-11-13");
    assert.equal(report.windowDays, 1);
    assert.equal(report.messengers.telegram.totals.visit, 0);
    assert.equal(report.messengers.telegram.totals.note, 1);
    assert.equal(report.messengers.max.totals.mood, 1);
    const text = formatAnalyticsReport(report);
    assert.match(text, /Between за 1 дн\., по Москве/);
    assert.match(text, /Telegram[\s\S]*Заметка 1/);
    assert.match(text, /MAX[\s\S]*Настроение 1/);
    assert.doesNotMatch(text, /Сайт/);
    assert.doesNotMatch(text, /Визит [1-9]/);

    const empty = snapshotFromReads("2026-11-13", [], []);
    const siteOnly = snapshotFromReads(
      "2026-11-13",
      [{ day: "2026-11-13", counts: { visit: 9, note: 0, mood: 0, block: 0, plan: 0, week: 0, paywall: 0, checkout: 0, paid: 0 } }],
      [],
    );
    assert.equal(
      formatAnalyticsReport({
        today: "2026-11-13",
        windowDays: 1,
        messengers: { telegram: empty, max: empty, web: siteOnly },
      }),
      "Пока никто не открывал Between.",
    );
  });

  it("sends a funnel step to PostHog without a person, an ip, or the launch hash", () => {
    const launch =
      "https://between-rouge.vercel.app/#tgWebAppData=user%3D%257B%2522id%2522%253A424242%257D&tgWebAppVersion=8";
    const kept = scrubProductEvent({
      event: "checkout",
      properties: {
        distinct_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        token: "phc_public",
        $session_id: "sess",
        $lib: "web",
        $current_url: launch,
        $ip: "203.0.113.8",
        $elements: [{ text: "сегодня тяжело" }],
        note: "сегодня тяжело",
        plan: "quarter",
        username: "aliatorovskaia",
      },
      $set: { name: "hidden" },
      $set_once: { first: "hidden" },
      $unset: ["name"],
    });
    assert.ok(kept);
    assert.equal(kept.event, "checkout");
    assert.equal(kept.properties?.plan, "quarter");
    assert.equal(kept.properties?.distinct_id, "7c9e6679-7425-40de-944b-e07fc1f90ae7");
    assert.equal(kept.properties?.token, "phc_public");
    assert.equal(kept.properties?.$session_id, "sess");
    assert.equal(kept.properties?.$lib, "web");
    assert.equal(kept.properties?.$current_url, "https://between-rouge.vercel.app/");
    assert.equal(kept.properties?.$geoip_disable, true);
    assert.equal(kept.properties?.$ip, undefined);
    assert.equal(kept.properties?.note, undefined);
    assert.equal(kept.properties?.username, undefined);
    assert.equal(kept.properties?.$elements, undefined);
    assert.equal(kept.$set, undefined);
    assert.equal(kept.$set_once, undefined);
    assert.equal(kept.$unset, undefined);
    assert.equal(JSON.stringify(kept).includes("424242"), false);
    const split = scrubProductEvent({
      event: "max_note",
      properties: { distinct_id: "anon", messenger: "telegram", note: "сегодня тяжело" },
    });
    assert.equal(split?.event, "max_note");
    assert.equal(split?.properties?.messenger, "max");
    assert.equal(split?.properties?.note, undefined);
    assert.equal(messengerEventName("telegram", "paid"), "telegram_paid");
    assert.deepEqual(parseMessengerEvent("telegram_paid"), { messenger: "telegram", event: "paid" });
    assert.equal(parseMessengerEvent("visit"), null);
    assert.deepEqual(parseMessengerEvent("web_week"), { messenger: "web", event: "week" });
    assert.deepEqual(parseMessengerEvent("max_mood"), { messenger: "max", event: "mood" });
    assert.deepEqual(parseMessengerEvent("telegram_block"), { messenger: "telegram", event: "block" });
    assert.deepEqual(parseMessengerEvent("web_plan"), { messenger: "web", event: "plan" });
    assert.equal(JSON.stringify(kept).includes("тяжело"), false);

    assert.equal(scrubProductEvent({ event: "$pageview", properties: { distinct_id: "anon" } }), null);
    assert.equal(scrubProductEvent({ event: "paid", properties: { plan: "forever", distinct_id: "anon" } })?.properties?.plan, undefined);
    assert.equal(
      scrubProductEvent({ event: "visit", properties: { distinct_id: "424242" } }),
      null,
    );
  });

  it("passes a public PostHog token to the browser and holds a personal key", () => {
    assert.deepEqual(posthogBrowserConfig({ key: "phc_publictoken12" }), {
      token: "phc_publictoken12",
      host: "https://us.i.posthog.com",
    });
    assert.equal(posthogBrowserConfig({ key: "phx_personalkey12" }), null);
    assert.equal(posthogBrowserConfig({ key: "" }), null);
    assert.equal(posthogBrowserConfig({ key: "phc_publictoken12", host: "http://evil.example" })?.host, "https://us.i.posthog.com");
    assert.equal(
      posthogBrowserConfig({ key: "  phc_publictoken12  ", host: "https://eu.i.posthog.com/capture/" })?.host,
      "https://eu.i.posthog.com",
    );
  });

  it("recognises the owner without treating the name as a stored id", () => {
    assert.equal(isAnalyticsOwner("Aliatorovskaia", "aliatorovskaia"), true);
    assert.equal(isAnalyticsOwner("@aliatorovskaia", "aliatorovskaia, other"), true);
    assert.equal(isAnalyticsOwner("someone", "aliatorovskaia"), false);
    assert.equal(isAnalyticsOwner(undefined, "aliatorovskaia"), false);
    assert.equal(analyticsQuiet({ username: "Aliatorovskaia", messenger: "telegram" }), true);
    assert.equal(analyticsQuiet({ username: "reader", messenger: "web", owners: "reader" }), true);
    assert.equal(analyticsQuiet({ userId: 1062664437, messenger: "max" }), true);
    assert.equal(analyticsQuiet({ userId: 1062664437, messenger: "telegram" }), false);
    assert.equal(analyticsQuiet({ username: "someone", userId: 5, messenger: "telegram" }), false);
    assert.equal(pollChatQuiet("max:1062664437"), true);
    assert.equal(pollChatQuiet("42", "aliatorovskaia"), true);
    assert.equal(pollChatQuiet("42"), false);
    assert.equal(pollChatQuiet("42", "ada"), false);
    assert.equal(pollChatQuiet("max:5"), false);
    assert.equal(
      quietClientLaunch({
        telegramInit: "user=" + encodeURIComponent(JSON.stringify({ id: 7, username: "aliatorovskaia" })),
      }),
      true,
    );
    assert.equal(
      quietClientLaunch({ maxInit: "user=" + encodeURIComponent(JSON.stringify({ id: 1062664437 })) }),
      true,
    );
    assert.equal(
      quietClientLaunch({ telegramInit: "user=" + encodeURIComponent(JSON.stringify({ id: 7, username: "ada" })) }),
      false,
    );
    const token = analyticsDedupToken("pepper", "424242:visit:2026-11-01");
    assert.equal(token.includes("424242"), false);
    assert.equal(token.length, 64);
  });

  it("uses one PostHog person for the bot and the mini app", async () => {
    const pepper = "bot-token";
    const person = productDistinctId(pepper, "telegram", 42);
    assert.equal(productDistinctId(pepper, "telegram", "42"), person);
    assert.equal(person.length, 32);
    assert.equal(person.includes("42"), false);
    assert.notEqual(productDistinctId(pepper, "max", 42), person);
    assert.notEqual(productDistinctId("other-token", "telegram", 42), person);

    const previous = {
      key: process.env.POSTHOG_KEY,
      host: process.env.POSTHOG_HOST,
      token: process.env.BOT_TOKEN,
    };
    const calls: { url: string; body: { event?: string; distinct_id?: string; properties?: { plan?: string } } }[] = [];
    const original = globalThis.fetch;
    process.env.POSTHOG_KEY = "phc_publictoken12";
    process.env.POSTHOG_HOST = "https://us.i.posthog.com";
    process.env.BOT_TOKEN = pepper;
    globalThis.fetch = async (url, init) => {
      calls.push({
        url: String(url),
        body: JSON.parse(String(init?.body)) as { event?: string; distinct_id?: string; properties?: { plan?: string } },
      });
      return new Response("ok");
    };
    try {
      await captureServerProduct({ messenger: "telegram", event: "note", userId: 42, plan: "month" });
      await captureServerProduct({ messenger: "max", event: "visit", userId: 42 });
    } finally {
      globalThis.fetch = original;
      if (previous.key === undefined) delete process.env.POSTHOG_KEY;
      else process.env.POSTHOG_KEY = previous.key;
      if (previous.host === undefined) delete process.env.POSTHOG_HOST;
      else process.env.POSTHOG_HOST = previous.host;
      if (previous.token === undefined) delete process.env.BOT_TOKEN;
      else process.env.BOT_TOKEN = previous.token;
    }
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.url, "https://us.i.posthog.com/capture/");
    assert.equal(calls[0]?.body.event, "telegram_note");
    assert.equal(calls[0]?.body.distinct_id, person);
    assert.equal(calls[0]?.body.properties?.plan, "month");
    assert.equal(calls[1]?.body.event, "max_visit");
    assert.equal(calls[1]?.body.distinct_id, productDistinctId(pepper, "max", 42));
    assert.equal(calls[1]?.body.properties?.plan, undefined);
  });
});
