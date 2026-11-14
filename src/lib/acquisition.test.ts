import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACQUISITION_TTL, acquisitionIds, acquisitionPayload, conversionCsv, messengerStartUrl,
  type MessengerConversion,
} from "./acquisition";
import {
  ACK_CONVERSIONS, ACQUISITION_LOCK, QUEUE_CONVERSION,
  RELEASE_ACQUISITION_LOCK, createAcquisition, queueMessengerConversion, type AcquisitionStore,
} from "./acquisition-store";
import { syncAcquisition } from "./acquisition-sync";

/** Redis commands used by the outbox, including atomic script boundaries. */
class MemoryStore {
  values = new Map<string, unknown>();
  pending = new Set<string>();
  get = async (key: string) => {
    const value = this.values.get(key) ?? null;
    if (typeof value === "string") { try { return JSON.parse(value); } catch { return value; } }
    return structuredClone(value);
  };
  set = async (key: string, value: unknown, options?: { nx?: boolean }) => {
    if (options?.nx && this.values.has(key)) return null;
    this.values.set(key, value);
    return "OK";
  };
  zrange = async () => [...this.pending].slice(0, 50);
  zcard = async () => this.pending.size;
  zrem = async (_key: string, key: string) => this.pending.delete(key) ? 1 : 0;
  eval = async (script: string, keys: string[], args: unknown[]) => {
    if (script === QUEUE_CONVERSION) {
      if (this.values.has(keys[0]) || this.values.has(keys[2])) return 0;
      this.values.set(keys[0], args[0]);
      this.values.set(keys[2], "1");
      this.pending.add(keys[0]);
      return 1;
    }
    if (script === ACK_CONVERSIONS) {
      for (const key of keys.slice(1)) {
        const value = await this.get(key);
        if (value) this.values.set(key, { ...value, uploadId: args[0] });
        this.pending.delete(key);
      }
      return 1;
    }
    if (script === RELEASE_ACQUISITION_LOCK) {
      if (this.values.get(keys[0]) === args[0]) this.values.delete(keys[0]);
      return 1;
    }
    throw new Error("Unexpected Redis script");
  };
  get redis() { return this as unknown as AcquisitionStore; }
}

const NOW = Math.floor(Date.now() / 1000);
const actor = { messenger: "telegram" as const, userId: 42, pepper: "test-pepper", username: "customer" };

async function queued(store = new MemoryStore()) {
  const ref = await createAcquisition(store.redis, { clientId: "1760000000123456789", yclid: "99900011122233344455" }, NOW);
  assert.ok(ref);
  assert.equal(await queueMessengerConversion(store.redis, { ...actor, payload: `ad_${ref}` }, NOW), true);
  return store;
}

describe("attributed messenger starts", () => {
  it("keeps large identifiers as strings and rejects payloads and CSV injection", () => {
    assert.deepEqual(acquisitionIds({ clientId: "1760000000123456789", yclid: "99900011122233344455" }), { clientId: "1760000000123456789", yclid: "99900011122233344455" });
    assert.equal(acquisitionIds({ clientId: "=SUM(1)", yclid: "12\n34" }), null);
    assert.equal(acquisitionPayload("app_landing"), null);
    assert.equal(acquisitionPayload("login_secret"), null);
    assert.equal(acquisitionPayload("ad_https://example.com"), null);
    assert.equal(messengerStartUrl("telegram", "a".repeat(32)), `https://t.me/BetweenJournalBot?start=ad_${"a".repeat(32)}`);
    assert.equal(messengerStartUrl("max", "a".repeat(32)), `https://max.ru/se14938561_bot?start=ad_${"a".repeat(32)}`);
  });

  it("a landing click alone creates no conversion", async () => {
    const store = new MemoryStore();
    assert.ok(await createAcquisition(store.redis, { clientId: "123" }, NOW));
    assert.equal(store.pending.size, 0);
    assert.equal(await createAcquisition(store.redis, {}), null);
  });

  it("a QR scan on a phone keeps the desktop's identifier", async () => {
    const store = new MemoryStore();
    const ref = await createAcquisition(store.redis, { clientId: "111", yclid: "222" }, NOW);
    assert.equal(await createAcquisition(store.redis, { ref, clientId: "999" }, NOW + 30), ref);
    assert.deepEqual(await store.get(`between:acquisition:ref:${ref}`), { clientId: "111", yclid: "222", at: NOW });
  });

  it("a new advertising click replaces an old cookie attribution", async () => {
    const store = new MemoryStore();
    const ref = await createAcquisition(store.redis, { clientId: "111", yclid: "222" }, NOW);
    assert.notEqual(await createAcquisition(store.redis, { ref, clientId: "111", yclid: "333" }, NOW + 1), ref);
  });

  it("ignores unknown and expired references", async () => {
    const store = new MemoryStore();
    const ref = await createAcquisition(store.redis, { yclid: "222" }, NOW - ACQUISITION_TTL);
    assert.equal(await queueMessengerConversion(store.redis, { ...actor, payload: `ad_${ref}` }, NOW), false);
    assert.equal(await queueMessengerConversion(store.redis, { ...actor, payload: `ad_${"a".repeat(32)}` }, NOW), false);
    assert.equal(store.pending.size, 0);
  });

  it("excludes the owner in Telegram and MAX before writing any conversion", async () => {
    const store = new MemoryStore();
    const ref = await createAcquisition(store.redis, { yclid: "222" }, NOW);
    assert.equal(await queueMessengerConversion(store.redis, { ...actor, username: "aliatorovskaia", payload: `ad_${ref}` }, NOW), false);
    assert.equal(await queueMessengerConversion(store.redis, { ...actor, messenger: "max", userId: 1062664437, payload: `ad_${ref}` }, NOW), false);
    assert.equal(store.pending.size, 0);
  });

  it("deduplicates concurrent webhook deliveries and multiple links for one person/day", async () => {
    const store = new MemoryStore();
    const ref = await createAcquisition(store.redis, { yclid: "222" }, NOW);
    const next = await createAcquisition(store.redis, { yclid: "333" }, NOW);
    const results = await Promise.all([ref, ref, next].map((token) => queueMessengerConversion(store.redis, { ...actor, payload: `ad_${token}` }, NOW)));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(store.pending.size, 1);
    const conversion = await store.get([...store.pending][0]);
    assert.equal("userId" in conversion, false);
    assert.equal("username" in conversion, false);
    assert.equal("pepper" in conversion, false);
  });

  it("temporarily counts owner starts only before the explicit test deadline", async () => {
    const store = new MemoryStore();
    const ref = await createAcquisition(store.redis, { clientId: "123" }, NOW);
    const testOwner = { ...actor, username: "aliatorovskaia", payload: `ad_${ref}`, ownerTestUntil: NOW + 3600 };
    assert.equal(await queueMessengerConversion(store.redis, testOwner, NOW), true);
    assert.equal(await queueMessengerConversion(store.redis, testOwner, NOW), false);
    assert.equal(await queueMessengerConversion(store.redis, { ...testOwner, messenger: "max", userId: 1062664437 }, NOW), true);
    for (const ownerTestUntil of [NOW, NOW - 1, NaN, Infinity]) {
      const expiredStore = new MemoryStore();
      const nextRef = await createAcquisition(expiredStore.redis, { clientId: "123" }, NOW);
      const expiredOwner = { ...testOwner, payload: `ad_${nextRef}`, ownerTestUntil };
      assert.equal(await queueMessengerConversion(expiredStore.redis, expiredOwner, NOW), false);
      assert.equal(await queueMessengerConversion(expiredStore.redis, { ...expiredOwner, messenger: "max", userId: 1062664437 }, NOW), false);
    }
    assert.equal(store.pending.size, 2);
  });

  it("allows another day's confirmed visit and keeps messengers separate", async () => {
    const store = await queued();
    const ref = await createAcquisition(store.redis, { yclid: "555" }, NOW + 86400);
    assert.equal(await queueMessengerConversion(store.redis, { ...actor, payload: `ad_${ref}` }, NOW + 86400), true);
    assert.equal(await queueMessengerConversion(store.redis, { ...actor, messenger: "max", payload: `ad_${ref}` }, NOW + 86400), true);
    assert.equal(store.pending.size, 3);
  });
});

describe("Metrika outbox", () => {
  it("keeps confirmed starts pending while OAuth is not configured", async () => {
    const store = await queued();
    const result = await syncAcquisition(store.redis, { token: "" });
    assert.equal(result.status, "not_configured");
    assert.equal(store.pending.size, 1);
  });

  it("retains the original event time after an HTTP failure, then acknowledges a receipt once", async () => {
    const store = await queued();
    const key = [...store.pending][0];
    let requests = 0;
    let submitted = "";
    const send = (async (url, options) => {
      requests++;
      assert.equal(String(url), "https://api-metrika.yandex.net/management/v1/counter/114026277/offline_conversions/upload");
      assert.equal((options?.headers as Record<string, string>).Authorization, "OAuth private-test-token");
      submitted = await ((options?.body as FormData).get("file") as Blob).text();
      return requests === 1 ? new Response("unavailable", { status: 503 }) : Response.json({ uploading: { id: 123, line_quantity: 0, status: "PREPARED" } });
    }) as typeof fetch;
    assert.equal((await syncAcquisition(store.redis, { token: "private-test-token", send })).status, "error");
    assert.equal(store.pending.size, 1);
    assert.equal((await store.get(key)).time, NOW);
    assert.equal((await syncAcquisition(store.redis, { token: "private-test-token", send })).status, "uploaded");
    assert.equal(store.pending.size, 0);
    assert.equal((await store.get(key)).uploadId, 123);
    assert.equal((await syncAcquisition(store.redis, { token: "private-test-token", send })).status, "empty");
    assert.equal(requests, 2);
    assert.equal(submitted, `ClientId,yclid,Target,DateTime\n1760000000123456789,99900011122233344455,messenger_start_telegram,${NOW}\n`);
    assert.equal(submitted.includes("customer"), false);
    assert.equal(submitted.includes("42,"), false);
  });

  it("does not discard an outbox item when the connection throws or the response has no receipt", async () => {
    const store = await queued();
    const throws = (async () => { throw new Error("Network unavailable"); }) as typeof fetch;
    assert.equal((await syncAcquisition(store.redis, { token: "test", send: throws })).status, "error");
    const invalid = (async () => Response.json({ error: "unexpected" })) as typeof fetch;
    assert.equal((await syncAcquisition(store.redis, { token: "test", send: invalid })).status, "error");
    assert.equal(store.pending.size, 1);
    assert.equal(store.values.has(ACQUISITION_LOCK), false);
  });

  it("serializes concurrent uploads with an expiring lock", async () => {
    const store = await queued();
    await store.set(ACQUISITION_LOCK, "another-worker");
    const send = (async () => { throw new Error("Must not run"); }) as typeof fetch;
    assert.equal((await syncAcquisition(store.redis, { token: "test", send })).status, "busy");
    assert.equal(store.pending.size, 1);
  });

  it("exports only numeric website ids, target and Unix seconds", () => {
    const row: MessengerConversion = { clientId: "123", at: NOW, messenger: "max", time: NOW };
    assert.equal(conversionCsv([row]), `ClientId,yclid,Target,DateTime\n123,,messenger_start_max,${NOW}\n`);
    assert.throws(() => conversionCsv([{ ...row, clientId: "x,another,row" }]));
  });
});
