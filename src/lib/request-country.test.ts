import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countryFromHeaders, telegramNeedsVpn } from "./request-country";

describe("request country", () => {
  it("reads the Vercel country and ignores a junk header", () => {
    assert.equal(countryFromHeaders((name) => (name === "x-vercel-ip-country" ? "ru" : null)), "RU");
    assert.equal(countryFromHeaders(() => "Russia"), null);
    assert.equal(countryFromHeaders(() => null), null);
  });

  it("asks for a VPN only on a Russian address", () => {
    assert.equal(telegramNeedsVpn("RU"), true);
    assert.equal(telegramNeedsVpn("DE"), false);
    assert.equal(telegramNeedsVpn(null), false);
  });
});
