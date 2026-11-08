import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { validateMaxInitData } from "./max-auth";
import { loginTokenFromStart } from "./web-account";

const TOKEN = "max-bot-token";

function sign(fields: Record<string, string>, token = TOKEN): string {
  const pairs = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b));
  const launch = pairs.map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(launch).digest("hex");
  return [...pairs, ["hash", hash] as [string, string]]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
}

describe("MAX mini app login", () => {
  it("accepts a signed launch and ignores a null username", () => {
    const now = 1_700_000_000;
    const init = sign({
      auth_date: String(now),
      query_id: "q1",
      user: JSON.stringify({ id: 67890, first_name: "Max", username: null }),
      start_param: "login_abcdefghjkmnpqrstuvwxyz234567892",
    });
    const parsed = validateMaxInitData(init, TOKEN, now);
    assert.ok(parsed);
    assert.equal(parsed.user.id, 67890);
    assert.equal(parsed.user.username, undefined);
    assert.equal(parsed.startParam, "login_abcdefghjkmnpqrstuvwxyz234567892");
    assert.equal(loginTokenFromStart(parsed.startParam ?? ""), "abcdefghjkmnpqrstuvwxyz234567892");
  });

  it("accepts a user id that arrived as text", () => {
    const now = 1_700_000_000;
    const init = sign({
      auth_date: String(now),
      user: JSON.stringify({ id: "67890", first_name: "Max" }),
    });
    const parsed = validateMaxInitData(init, TOKEN, now);
    assert.equal(parsed?.user.id, 67890);
  });

  it("rejects a edited user, a second hash, the wrong token, and an old launch", () => {
    const now = 1_700_000_000;
    const init = sign({
      auth_date: String(now),
      user: JSON.stringify({ id: 7, username: "ada", first_name: "UniquePerson" }),
    });
    assert.equal(validateMaxInitData(init.replace("UniquePerson", "OtherPerson"), TOKEN, now), null);
    assert.equal(validateMaxInitData(`${init}&hash=ab`, TOKEN, now), null);
    assert.equal(validateMaxInitData(init, "other-token", now), null);
    assert.equal(validateMaxInitData(init, TOKEN, now + 60 * 60 + 5), null);
    const ok = validateMaxInitData(init, TOKEN, now + 10);
    assert.equal(ok?.user.username, "ada");
  });
});
