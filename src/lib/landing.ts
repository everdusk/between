import { LANDING_ORIGIN } from "./landing-seo";

/**
 * The bot only receives the `start` payload. `app_landing` is the open-the-app
 * handoff plus the mark that this person came from the landing page.
 */
export const LANDING_START_PARAM = "app_landing";
export const LANDING_BOT_URL = "https://t.me/BetweenJournalBot?start=app_landing";
/** Public MAX bot. `max.ru` opens the app from a phone; the web client works in a desktop browser. */
export const LANDING_MAX_BOT = "se14938561_bot";
export const LANDING_MAX_URL = `https://max.ru/${LANDING_MAX_BOT}?start=${LANDING_START_PARAM}`;
export const LANDING_MAX_WEB_URL = `https://web.max.ru/${LANDING_MAX_BOT}?start=${LANDING_START_PARAM}`;
/** Phone cameras land here and choose Telegram or MAX. */
export const LANDING_OPEN_URL = `${LANDING_ORIGIN}/open`;
export const LANDING_SOURCE = "landing";
export const LANDING_COUNT_KEY = "between:source:landing";

export function landingSourceKey(userId: number | string): string {
  return `between:user:${userId}:source`;
}

/** Payload of `/start`, or null when the text is not that command. */
export function startPayload(text: string): string | null {
  const match = /^\/start(?:@\S+)?(?:\s+(\S+))?$/i.exec(text.trim());
  if (!match) return null;
  return (match[1] ?? "").toLowerCase();
}

export function isLandingStart(text: string): boolean {
  return startPayload(text) === LANDING_START_PARAM;
}

export function landingCount(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.floor(number);
}

/** Empty when nobody has arrived from the landing yet. */
export function landingStatsLine(count: number): string {
  if (count <= 0) return "";
  return `\n\nС лендинга ${count}`;
}

type LandingRedis = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: string) => Promise<unknown>;
  incr: (key: string) => Promise<unknown>;
};

/** Tags the person and counts a first arrival. A repeat start does not count again. */
export async function rememberLandingSource(
  redis: LandingRedis,
  userId: number,
): Promise<"new" | "again"> {
  const key = landingSourceKey(userId);
  const existing = await redis.get(key);
  await redis.set(key, LANDING_SOURCE);
  if (existing === LANDING_SOURCE) return "again";
  await redis.incr(LANDING_COUNT_KEY);
  return "new";
}

/** Mini App launch hash, or a payload the official script already stored. */
export function surfaceFromLocation(
  hash: string,
  search: string,
  stored: string | null,
): "app" | "web" {
  const blob = `${hash}&${search}`;
  const data = /(?:^|[?#&])tgWebAppData=([^&#]*)/.exec(blob);
  if (data?.[1]) return "app";
  if (/(?:^|[?#&])tgWebAppVersion=/.test(blob)) return "app";
  if (!stored) return "web";
  try {
    const parsed = JSON.parse(stored) as { tgWebAppData?: unknown };
    if (typeof parsed?.tgWebAppData === "string" && parsed.tgWebAppData) return "app";
  } catch {
    return "web";
  }
  return "web";
}

export const APP_SURFACE_CSS = ".between-landing{display:none!important}";

/** Terms and privacy are public pages, not the Mini App and not the landing. */
export function isLegalPath(pathname: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return path === "/terms" || path === "/privacy";
}

/** Public pages that are not the landing and not the journal: legal text, the password link, deletion. */
export function isQuietPath(pathname: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return isLegalPath(path) || path === "/reset" || path === "/delete" || path === "/open" || path === "/subscribe";
}

export const LEGAL_SURFACE_CSS = `${APP_SURFACE_CSS}.splash-screen{display:none!important}`;

/**
 * Runs before Metrika. Quiet pages and the journal hide the landing.
 * `/open` and `/subscribe` stay `web`: the counter starts only when `data-between` is not `app`,
 * and Metrika's button markup lists pages the counter has seen.
 */
export const JOURNAL_SURFACE_SCRIPT = `try{var p=location.pathname||"";if(p.length>1&&p.charAt(p.length-1)==="/")p=p.slice(0,-1);var quiet=p==="/terms"||p==="/privacy"||p==="/reset"||p==="/delete"||p==="/open"||p==="/subscribe";var journal=p==="/journal"||p.indexOf("/journal/")===0;if(quiet||journal){if(p!=="/open"&&p!=="/subscribe")document.documentElement.setAttribute("data-between","app");document.documentElement.setAttribute("data-journal","web");var scheme="night";if(journal){try{var saved=localStorage.getItem("between:scheme");if(saved==="day"||saved==="night")scheme=saved;}catch(e){}}document.documentElement.setAttribute("data-scheme",scheme);if(quiet)document.documentElement.removeAttribute("data-splash");var s=document.getElementById("between-surface");if(s)s.textContent=quiet?${JSON.stringify(LEGAL_SURFACE_CSS)}:${JSON.stringify(APP_SURFACE_CSS)};}}catch(e){}`;

export const WEB_SURFACE_CSS = [
  "html[data-splash] .splash-screen{display:none!important}",
  "html[data-splash] .app-root,.app-root{display:none!important}",
  ".between-landing{display:block!important}",
  "html[data-between=web],html[data-between=web] body{background-color:#0c1412!important;background-image:none!important;color-scheme:only dark}",
].join("");

export const SURFACE_BOOT_SCRIPT = `try{var stored=null;try{stored=sessionStorage.getItem("__telegram__initParams")}catch(e){}var surface=(${surfaceFromLocation.toString()})(location.hash||"",location.search||"",stored);var css=surface==="app"?"${APP_SURFACE_CSS}":"${WEB_SURFACE_CSS}";var style=document.getElementById("between-surface");if(!style){style=document.createElement("style");style.id="between-surface";document.head.appendChild(style);}style.textContent=css;document.documentElement.setAttribute("data-between",surface);}catch(e){}`;

/** Public landing counter. Stays off inside the Mini App so session replay does not record the journal. */
export const YANDEX_METRIKA_ID = 114026277;

export const YANDEX_METRIKA_SCRIPT = `if(document.documentElement.getAttribute("data-between")!=="app"){(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_ID}','ym');ym(${YANDEX_METRIKA_ID},'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});}`;

export const YANDEX_METRIKA_NOSCRIPT = `<div><img src="https://mc.yandex.ru/watch/${YANDEX_METRIKA_ID}" style="position:absolute;left:-9999px;" alt="" /></div>`;

/** Telegram confirmed after paint (web client, no launch hash). Replaces the boot style. */
export function holdAppSurface(): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-between", "app");
  let style = document.getElementById("between-surface");
  if (!style) {
    style = document.createElement("style");
    style.id = "between-surface";
    document.head.appendChild(style);
  }
  style.textContent = APP_SURFACE_CSS;
}
