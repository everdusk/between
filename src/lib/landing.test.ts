import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLandingStart,
  LANDING_BOT_URL,
  LANDING_START_PARAM,
  landingCount,
  landingStatsLine,
  rememberLandingSource,
  startPayload,
  surfaceFromLocation,
  WEB_SURFACE_CSS,
  YANDEX_METRIKA_ID,
  YANDEX_METRIKA_NOSCRIPT,
  YANDEX_METRIKA_SCRIPT,
} from "./landing";

describe("landing start mark", () => {
  it("keeps the app handoff and names the landing", () => {
    assert.equal(LANDING_START_PARAM, "app_landing");
    assert.equal(LANDING_BOT_URL, "https://t.me/BetweenJournalBot?start=app_landing");
    assert.equal(isLandingStart("/start app_landing"), true);
    assert.equal(isLandingStart("/start@BetweenJournalBot app_landing"), true);
    assert.equal(isLandingStart("/start app"), false);
    assert.equal(isLandingStart("/start"), false);
    assert.equal(isLandingStart("/help"), false);
    assert.equal(startPayload("/Start APP_LANDING"), "app_landing");
  });

  it("counts the first arrival once", async () => {
    const store = new Map<string, string>();
    let count = 0;
    const redis = {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: string) => {
        store.set(key, value);
      },
      incr: async () => {
        count += 1;
        return count;
      },
    };
    assert.equal(await rememberLandingSource(redis, 7), "new");
    assert.equal(await rememberLandingSource(redis, 7), "again");
    assert.equal(count, 1);
    assert.equal(store.get("between:user:7:source"), "landing");
    assert.equal(landingStatsLine(landingCount(count)), "\n\nС лендинга 1");
    assert.equal(landingStatsLine(0), "");
    assert.equal(landingCount("nope"), 0);
  });
});

describe("landing surface", () => {
  it("shows the journal inside Telegram and the page in a browser", () => {
    assert.equal(surfaceFromLocation("", "", null), "web");
    assert.equal(surfaceFromLocation("#tgWebAppData=user%3D1", "", null), "app");
    assert.equal(surfaceFromLocation("#tgWebAppVersion=8.0", "", null), "app");
    assert.equal(surfaceFromLocation("#tgWebAppData=", "", null), "web");
    assert.equal(
      surfaceFromLocation("", "", JSON.stringify({ tgWebAppData: "user=1" })),
      "app",
    );
    assert.equal(surfaceFromLocation("", "", "{"), "web");
  });

  it("counts the public page and leaves the journal alone", () => {
    assert.equal(YANDEX_METRIKA_ID, 114026277);
    assert.match(YANDEX_METRIKA_SCRIPT, /data-between"\)!=="app"/);
    assert.match(
      YANDEX_METRIKA_SCRIPT,
      /https:\/\/mc\.yandex\.ru\/metrika\/tag\.js\?id=114026277/,
    );
    assert.match(YANDEX_METRIKA_SCRIPT, /ssr:true,webvisor:true,clickmap:true/);
    assert.match(YANDEX_METRIKA_NOSCRIPT, /https:\/\/mc\.yandex\.ru\/watch\/114026277/);
  });

  it("hides the launch splash with the same specificity it uses to show itself", () => {
    assert.match(
      WEB_SURFACE_CSS,
      /html\[data-splash\] \.splash-screen\{display:none!important\}/,
    );
  });
});
