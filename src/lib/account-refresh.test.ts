import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { keptAccount } from "./account-refresh";

const signedIn = { email: "a@between-journal.ru" };

describe("account refresh", () => {
  it("keeps a signed-in journal when a poll comes back empty", () => {
    assert.deepEqual(keptAccount(signedIn, null, true), signedIn);
    assert.deepEqual(keptAccount(signedIn, null, false), signedIn);
  });

  it("opens the journal from the response that actually has an account", () => {
    assert.deepEqual(keptAccount(null, signedIn, true), signedIn);
    assert.deepEqual(keptAccount(null, signedIn, false), signedIn);
  });

  it("lets a newer account replace the one on screen", () => {
    const next = { email: "b@between-journal.ru" };
    assert.deepEqual(keptAccount(signedIn, next, true), next);
    assert.deepEqual(keptAccount(signedIn, next, false), signedIn);
  });

  it("stays signed out when the first answer is empty", () => {
    assert.equal(keptAccount(null, null, true), null);
    assert.equal(keptAccount(null, null, false), null);
  });
});
