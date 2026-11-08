/** Copies `WebAppData` before the app starts. A later navigation must not lose it. */
export const MAX_LAUNCH_BOOT_SCRIPT = `try{var h=location.hash.replace(/^#/,"");if(!h){var n=performance.getEntriesByType("navigation")[0];h=n?new URL(n.name).hash.replace(/^#/,""):"";}if(h){var d=new URLSearchParams(h).get("WebAppData");if(d)sessionStorage.setItem("WebAppData",d);}}catch(e){}`;

/** MAX fills the launch string a moment after the page opens. */
export function waitForMaxInitData(timeoutMs = 1200): Promise<string | null> {
  const first = readMaxInitData();
  if (first || typeof window === "undefined") return Promise.resolve(first);
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const data = readMaxInitData();
      if (data || Date.now() - started >= timeoutMs) {
        window.clearInterval(timer);
        resolve(data);
      }
    }, 50);
  });
}

function webAppDataFromHash(hash: string): string | null {
  if (!hash) return null;
  try {
    return new URLSearchParams(hash.replace(/^#/, "")).get("WebAppData");
  } catch {
    return null;
  }
}

/** Signed launch string from a MAX mini app, or null in a normal browser. */
export function readMaxInitData(): string | null {
  if (typeof window === "undefined") return null;
  const fromHash = webAppDataFromHash(window.location.hash);
  if (fromHash) return fromHash;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const fromNav = nav ? webAppDataFromHash(new URL(nav.name).hash) : null;
    if (fromNav) return fromNav;
  } catch {
    /* navigation entry is not a URL */
  }
  try {
    const stored = sessionStorage.getItem("WebAppData");
    if (stored) return stored;
  } catch {
    /* private mode */
  }
  const app = (window as unknown as { WebApp?: { initData?: string } }).WebApp;
  const init = app?.initData?.trim();
  return init || null;
}

export const MAX_CLIENT_COOKIE = "between-max";

/** True when this page was opened by the MAX client, not by a normal browser. */
export function maxClientFrom(input: {
  hash?: string;
  referrer?: string;
  requestedWith?: string;
  hasWebApp?: boolean;
  cookie?: boolean;
}): boolean {
  if (input.cookie || input.hasWebApp) return true;
  const hash = input.hash?.replace(/^#/, "") ?? "";
  if (hash) {
    const params = new URLSearchParams(hash);
    if (params.get("WebAppData") || params.get("WebAppPlatform")) return true;
  }
  const requested = input.requestedWith ?? "";
  if (/oneme/i.test(requested)) return true;
  return maxHost(input.referrer ?? "");
}

function maxHost(value: string): boolean {
  if (!value) return false;
  if (/^android-app:\/\/ru\.oneme\.app/i.test(value)) return true;
  try {
    const host = new URL(value).hostname;
    return host === "max.ru" || host.endsWith(".max.ru");
  } catch {
    return false;
  }
}

/** The open journal is inside MAX. A normal browser tab stays false. */
export function inMaxClient(): boolean {
  if (typeof window === "undefined") return false;
  const app = (window as unknown as { WebApp?: { initData?: string; platform?: string } }).WebApp;
  const cookie = document.cookie.split(";").some((part) => part.trim() === `${MAX_CLIENT_COOKIE}=1`);
  const detected = maxClientFrom({
    hash: window.location.hash,
    referrer: document.referrer,
    hasWebApp: Boolean(app && (app.initData || app.platform)),
    cookie,
  });
  try {
    if (detected) sessionStorage.setItem(MAX_CLIENT_COOKIE, "1");
    if (!detected && sessionStorage.getItem(MAX_CLIENT_COOKIE) === "1") return true;
  } catch {
    /* private mode */
  }
  return detected;
}
