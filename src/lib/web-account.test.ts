import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { passwordSettingsKind } from "./password-settings";
import {
  journalStorageId,
  linkCodeFromStart,
  normalizeEmail,
  passwordMatches,
  passwordProblem,
  hashPassword,
  hashResetToken,
  newResetToken,
  readSession,
  resetUrl,
  signSession,
} from "./web-account";

describe("web account", () => {
  it("accepts a normal email and refuses a blank one", () => {
    assert.equal(normalizeEmail("  Ada@Example.com "), "ada@example.com");
    assert.equal(normalizeEmail("not-an-email"), null);
    assert.equal(normalizeEmail(""), null);
  });

  it("asks for a password of at least 8 characters", () => {
    assert.equal(passwordProblem("short"), "short");
    assert.equal(passwordProblem("long-enough"), null);
  });

  it("offers a password change only for an email journal opened on the site", () => {
    const mail = {
      inTelegram: false,
      inMax: false,
      signedIn: true,
      hasPassword: true,
      telegramLinked: true,
      maxLinked: false,
    };
    assert.equal(passwordSettingsKind(mail), "form");
    assert.equal(passwordSettingsKind({ ...mail, inTelegram: true }), "telegram");
    assert.equal(passwordSettingsKind({ ...mail, inMax: true, hasPassword: true }), "max");
    assert.equal(
      passwordSettingsKind({ ...mail, hasPassword: false, telegramLinked: false, maxLinked: true }),
      "max",
    );
    assert.equal(
      passwordSettingsKind({ ...mail, hasPassword: false, telegramLinked: true, maxLinked: true }),
      "messenger",
    );
    assert.equal(
      passwordSettingsKind({ ...mail, hasPassword: false, telegramLinked: false, maxLinked: false }),
      "none",
    );
    assert.equal(passwordSettingsKind({ ...mail, signedIn: false, hasPassword: false }), "hidden");
  });

  it("checks the password without keeping it", async () => {
    const stored = await hashPassword("correct-horse");
    assert.equal(await passwordMatches("correct-horse", stored.salt, stored.hash), true);
    assert.equal(await passwordMatches("wrong-horse", stored.salt, stored.hash), false);
    assert.equal(stored.hash.includes("correct-horse"), false);
  });

  it("drops a session that was edited or has expired", () => {
    const token = signSession("wabc", "secret", 1_000);
    assert.equal(readSession(token, "secret", 1_000), "wabc");
    assert.equal(readSession(token, "other", 1_000), null);
    assert.equal(readSession(`${token}x`, "secret", 1_000), null);
    assert.equal(readSession(token, "secret", 1_000 + 31 * 24 * 60 * 60 * 1000), null);
  });

  it("keeps an unlinked Telegram journal on its own key", () => {
    assert.equal(journalStorageId(42, null), "42");
    assert.equal(journalStorageId(42, "wabc"), "web:wabc");
  });

  it("builds a reset link without treating the token as the stored hash", () => {
    const token = newResetToken();
    const hash = hashResetToken(token);
    assert.notEqual(hash, token);
    assert.equal(hashResetToken(token), hash);
    assert.equal(
      resetUrl("https://www.between-journal.ru/", token),
      `https://www.between-journal.ru/reset?token=${encodeURIComponent(token)}`,
    );
  });

  it("reads only a link code from the start payload", () => {
    assert.equal(linkCodeFromStart("link_ab23cdef"), "ab23cdef");
    assert.equal(linkCodeFromStart("app_landing"), null);
    assert.equal(linkCodeFromStart("link_short"), null);
  });
});
