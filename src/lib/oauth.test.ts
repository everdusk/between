import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorizeUrl,
  beginOauth,
  codeChallenge,
  oauthClient,
  readOauth,
  sberIdentity,
  vkProfile,
  yandexProfile,
} from "./oauth";

describe("oauth", () => {
  it("builds the RFC 7636 S256 challenge", () => {
    assert.equal(
      codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("keeps a pending login and drops a forged cookie", () => {
    const { pending, cookie } = beginOauth("yandex", "secret", 1_000);
    const read = readOauth(cookie, "secret", 1_000);
    assert.equal(read?.state, pending.state);
    assert.equal(read?.verifier, pending.verifier);
    assert.equal(readOauth(`${cookie}x`, "secret", 1_000), null);
    assert.equal(readOauth(cookie, "secret", 1_000 + 11 * 60 * 1000), null);
    assert.ok(pending.state.length >= 32 && pending.state.length <= 96);
    assert.ok(pending.nonce.length <= 64);
  });

  it("sends each provider to its own authorize host", () => {
    const { pending } = beginOauth("vk", "secret", 1_000);
    const redirect = "https://between-rouge.vercel.app/api/account/oauth/vk/callback";
    const vk = new URL(authorizeUrl("vk", { id: "vk-app", secret: "" }, pending, redirect));
    assert.equal(vk.origin, "https://id.vk.ru");
    assert.equal(vk.searchParams.get("code_challenge_method"), "S256");
    assert.match(vk.searchParams.get("scope") ?? "", /email/);

    const yandex = new URL(authorizeUrl("yandex", { id: "ya", secret: "sek" }, pending, redirect));
    assert.equal(yandex.origin, "https://oauth.yandex.com");
    assert.equal(yandex.searchParams.get("scope"), "login:email login:info");

    const sber = new URL(authorizeUrl("sber", { id: "sber-app", secret: "sek" }, pending, redirect));
    assert.equal(sber.origin, "https://id.sber.ru");
    assert.equal(sber.searchParams.get("nonce"), pending.nonce);
    assert.equal(sber.searchParams.get("client_type"), "PRIVATE");
  });

  it("reads a profile id and ignores a blank one", () => {
    assert.deepEqual(vkProfile({ user: { user_id: "42", email: "a@vk.com" } }), {
      id: "42",
      email: "a@vk.com",
    });
    assert.equal(vkProfile({ user: { user_id: "" } }), null);
    assert.deepEqual(yandexProfile({ id: "100", default_email: "a@yandex.ru" }), {
      id: "100",
      email: "a@yandex.ru",
    });
  });

  it("accepts a Sber id token only when nonce and audience match", () => {
    const payload = Buffer.from(
      JSON.stringify({
        sub: "abc123",
        nonce: "nonce-1",
        aud: "sber-app",
        email: "a@sber.ru",
        sub_alt: "old123",
      }),
    ).toString("base64url");
    const token = `eyJhbGciOiJub25lIn0.${payload}.`;
    assert.deepEqual(sberIdentity(token, "nonce-1", "sber-app"), {
      id: "abc123",
      altIds: ["old123"],
      email: "a@sber.ru",
    });
    assert.equal(sberIdentity(token, "other", "sber-app"), null);
    assert.equal(sberIdentity(token, "nonce-1", "someone-else"), null);
  });

  it("treats a missing client id as not connected", () => {
    const previous = process.env.YANDEX_CLIENT_ID;
    delete process.env.YANDEX_CLIENT_ID;
    assert.equal(oauthClient("yandex"), null);
    if (previous) process.env.YANDEX_CLIENT_ID = previous;
  });
});
