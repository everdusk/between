import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyticsDedupToken, recordAnalytics, type AnalyticsRedis } from "./analytics";
import {
  acceptClientEvent,
  analyticsCohortKey,
  analyticsCounterKey,
  analyticsDedupKey,
  formatAnalyticsReport,
  isAnalyticsOwner,
  planAnalyticsSend,
  scrubProductEvent,
  snapshotFromReads,
} from "./analytics-model";

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
    async mget() {
      return [];
    },
  };
}

describe("analytics", () => {
  it("counts a visit once per person per day and keeps the id out of the keys", async () => {
    const redis = memoryRedis();
    const first = await recordAnalytics(redis, {
      userId: 424242,
      event: "visit",
      day: "2026-11-01",
      cohort: "2026-11-01",
      offset: 0,
      pepper: "pepper",
    });
    const again = await recordAnalytics(redis, {
      userId: 424242,
      event: "visit",
      day: "2026-11-01",
      cohort: "2026-10-01",
      offset: 31,
      pepper: "pepper",
    });
    assert.equal(first, "counted");
    assert.equal(again, "duplicate");
    assert.equal(redis.keys.get(analyticsCounterKey("2026-11-01", "visit")), 1);
    assert.equal(redis.keys.get(analyticsCohortKey("2026-11-01", 0)), 1);
    assert.equal(redis.keys.has(analyticsCohortKey("2026-10-01", 31)), false);
    const stored = [...redis.sets.keys(), ...redis.keys.keys(), ...[...redis.sets.values()].flatMap((set) => [...set])];
    assert.equal(stored.some((value) => value.includes("424242")), false);
    assert.equal([...redis.sets.keys()].includes(analyticsDedupKey("2026-11-01")), true);
  });

  it("counts the same Stars charge once", async () => {
    const redis = memoryRedis();
    const input = {
      userId: 7,
      event: "paid" as const,
      day: "2026-11-01",
      salt: "charge-1",
      pepper: "pepper",
    };
    assert.equal(await recordAnalytics(redis, input), "counted");
    assert.equal(await recordAnalytics(redis, { ...input, day: "2026-11-02" }), "duplicate");
    assert.equal(redis.keys.get(analyticsCounterKey("2026-11-01", "paid")), 1);
    assert.equal(redis.keys.has(analyticsCounterKey("2026-11-02", "paid")), false);
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

  it("hides day 7 until that day has arrived", () => {
    const text = formatAnalyticsReport(
      snapshotFromReads(
        "2026-11-01",
        [
          {
            day: "2026-11-01",
            counts: { visit: 4, note: 2, week: 3, paywall: 1, checkout: 1, paid: 0 },
          },
        ],
        [
          { day: "2026-10-20", d0: 8, d1: 3, d7: 2 },
          { day: "2026-11-01", d0: 4, d1: 9, d7: 9 },
          { day: "2026-10-01", d0: 0, d1: 0, d7: 0 },
        ],
      ),
    );
    assert.match(text, /Визит 4/);
    assert.match(text, /Пейволл 1/);
    assert.match(text, /1 ноя — 4 новых, следующий день ещё нет/);
    assert.match(text, /20 окт — 8 новых, следующий день 3 из 8, день 7: 2 из 8/);
    assert.doesNotMatch(text, /1 окт/);
    assert.equal(text.includes("424242"), false);
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
    assert.equal(JSON.stringify(kept).includes("тяжело"), false);

    assert.equal(scrubProductEvent({ event: "$pageview", properties: { distinct_id: "anon" } }), null);
    assert.equal(scrubProductEvent({ event: "paid", properties: { plan: "forever", distinct_id: "anon" } })?.properties?.plan, undefined);
    assert.equal(
      scrubProductEvent({ event: "visit", properties: { distinct_id: "424242" } }),
      null,
    );
  });

  it("recognises the owner without treating the name as a stored id", () => {
    assert.equal(isAnalyticsOwner("Aliatorovskaia", "aliatorovskaia"), true);
    assert.equal(isAnalyticsOwner("@aliatorovskaia", "aliatorovskaia, other"), true);
    assert.equal(isAnalyticsOwner("someone", "aliatorovskaia"), false);
    assert.equal(isAnalyticsOwner(undefined, "aliatorovskaia"), false);
    const token = analyticsDedupToken("pepper", "424242:visit:2026-11-01");
    assert.equal(token.includes("424242"), false);
    assert.equal(token.length, 64);
  });
});
