import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchWeekAccess, postSessionWeekAccess, postWeekAccess } from "./week-access-client";
import { absorbWeekPremium, adoptClientTrial, describeWeekAccess, emptyWeekAccess, openWeekAccess } from "./week-access";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("authoritative messenger trial", () => {
  const first = new Date("2026-11-01T10:00:00Z");
  const restart = new Date("2026-11-15T10:00:00Z");
  const expired = openWeekAccess(emptyWeekAccess(), first);

  it("restart, shared account migration and cleared browser storage preserve expiration", () => {
    const restarted = openWeekAccess(expired, restart);
    assert.equal(restarted.openedAt, first.toISOString());
    const migrated = absorbWeekPremium(emptyWeekAccess(), restarted, restart).web;
    for (const local of [emptyWeekAccess(), openWeekAccess(emptyWeekAccess(), restart)]) {
      const reopened = openWeekAccess(adoptClientTrial(migrated, local, restart), restart);
      assert.equal(reopened.openedAt, first.toISOString());
      assert.equal(describeWeekAccess(reopened, restart).status, "locked");
    }
  });

  it("MAX signs both status and open requests and never imports a browser trial", async () => {
    const requests: RequestInit[] = [];
    const view = describeWeekAccess(expired, restart);
    globalThis.fetch = async (_url, init) => {
      requests.push(init!);
      return Response.json({ ok: true, access: view });
    };
    assert.equal((await fetchWeekAccess("", "signed-max"))?.status, "locked");
    const unrelatedFreshTrial = openWeekAccess(emptyWeekAccess(), restart);
    assert.equal((await postSessionWeekAccess("open", unrelatedFreshTrial, "signed-max"))?.daysLeft, 0);
    await postSessionWeekAccess("seen", undefined, "signed-max");
    for (const request of requests) {
      assert.equal(new Headers(request.headers).get("X-Max-Init-Data"), "signed-max");
      assert.equal(new Headers(request.headers).has("X-Telegram-Init-Data"), false);
    }
    assert.deepEqual(JSON.parse(requests[1].body as string), { action: "open" });
    assert.deepEqual(JSON.parse(requests[2].body as string), { action: "seen" });
  });

  it("Telegram keeps signed authentication for status and restart", async () => {
    globalThis.fetch = async (_url, init) => {
      assert.equal(new Headers(init?.headers).get("X-Telegram-Init-Data"), "signed-tg");
      return Response.json({ ok: true, access: describeWeekAccess(expired, restart) });
    };
    assert.equal((await fetchWeekAccess("signed-tg"))?.status, "locked");
    assert.equal((await postWeekAccess("signed-tg", "open"))?.status, "locked");
  });

  it("failed verification never returns a synthetic seven-day trial", async () => {
    for (const status of [401, 403, 503]) {
      globalThis.fetch = async () => new Response(null, { status });
      assert.equal(await fetchWeekAccess("", "signed-max"), null);
      assert.equal(await postSessionWeekAccess("open", undefined, "signed-max"), null);
      assert.equal(await postWeekAccess("signed-tg", "open"), null);
    }
    globalThis.fetch = async () => { throw new Error("offline"); };
    assert.equal(await fetchWeekAccess("signed-tg"), null);
    assert.equal(await postSessionWeekAccess("open", undefined, "signed-max"), null);
  });
});
