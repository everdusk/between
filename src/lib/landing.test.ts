import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import {
  isLandingStart,
  LANDING_BOT_URL,
  LANDING_MAX_URL,
  LANDING_OPEN_URL,
  LANDING_START_PARAM,
  landingCount,
  landingStatsLine,
  rememberLandingSource,
  startPayload,
  SURFACE_BOOT_SCRIPT,
  surfaceFromLocation,
  WEB_SURFACE_CSS,
  JOURNAL_SURFACE_SCRIPT,
  YANDEX_METRIKA_ID,
  YANDEX_METRIKA_NOSCRIPT,
  YANDEX_METRIKA_SCRIPT,
} from "./landing";

describe("landing start mark", () => {
  it("keeps the app handoff and names the landing", () => {
    assert.equal(LANDING_START_PARAM, "app_landing");
    assert.equal(LANDING_BOT_URL, "https://t.me/BetweenJournalBot");
    assert.equal(LANDING_MAX_URL, "https://max.ru/se14938561_bot");
    assert.equal(LANDING_OPEN_URL, "https://www.between-journal.ru/open");
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
  function boot(pathname: string, hash = "") {
    const attrs = new Map<string, string>([["data-splash", ""]]);
    const style = { textContent: WEB_SURFACE_CSS };
    let counters = 0;
    const context = {
      location: { pathname, hash, search: "" },
      sessionStorage: { getItem: () => null },
      localStorage: { getItem: () => "day" },
      document: {
        documentElement: {
          setAttribute: (k: string, v: string) => attrs.set(k, v),
          removeAttribute: (k: string) => attrs.delete(k),
          getAttribute: (k: string) => attrs.get(k),
        },
        getElementById: () => style,
      },
      window: {},
      // Reaching the first counter initializer is sufficient to detect recording.
    };
    runInNewContext(SURFACE_BOOT_SCRIPT, context);
    runInNewContext(JOURNAL_SURFACE_SCRIPT, context);
    try { runInNewContext(YANDEX_METRIKA_SCRIPT, context); } catch { counters += 1; }
    return { attrs, style, counters };
  }

  it("opens the browser workspace immediately without enabling the landing recorder", () => {
    const { attrs, style, counters } = boot("/");
    assert.equal(attrs.get("data-between"), "app");
    assert.equal(attrs.get("data-journal"), "web");
    assert.equal(attrs.get("data-scheme"), "day");
    assert.equal(attrs.has("data-web-first"), true);
    assert.equal(attrs.has("data-splash"), false);
    assert.equal(counters, 0);
    assert.doesNotMatch(style.textContent, /app-root\{display:none/);
  });

  it("keeps the public landing on about and preserves messenger launch surfaces", () => {
    const about = boot("/about");
    assert.equal(about.attrs.get("data-between"), "web");
    assert.match(about.style.textContent, /between-landing\{display:block/);
    const max = boot("/journal");
    assert.equal(max.attrs.get("data-between"), "app");
    assert.equal(max.attrs.has("data-web-first"), false);
    assert.equal(max.attrs.has("data-splash"), true);
    const tg = boot("/", "#tgWebAppData=user%3D1");
    assert.equal(tg.attrs.has("data-web-first"), false);
    assert.equal(tg.attrs.has("data-splash"), true);
    assert.equal(tg.counters, 0);
  });
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

  it("counts the messenger fork and still hides the journal", () => {
    assert.match(
      JOURNAL_SURFACE_SCRIPT,
      /if\(p!=="\/open"&&p!=="\/subscribe"\)document\.documentElement\.setAttribute\("data-between","app"\)/,
    );
    assert.match(JOURNAL_SURFACE_SCRIPT, /p==="\/open"/);
    assert.match(JOURNAL_SURFACE_SCRIPT, /p==="\/subscribe"/);
    assert.match(JOURNAL_SURFACE_SCRIPT, /p==="\/journal"/);
  });

  it("ships the public page visible, then lets Telegram replace that style", () => {
    assert.match(SURFACE_BOOT_SCRIPT, /getElementById\("between-surface"\)/);
    assert.doesNotMatch(SURFACE_BOOT_SCRIPT, /appendChild\(style\)\}catch/);
  });

  it("hides the launch splash with the same specificity it uses to show itself", () => {
    assert.match(
      WEB_SURFACE_CSS,
      /html\[data-splash\] \.splash-screen\{display:none!important\}/,
    );
  });
});
