import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeEmail } from "./account-validation";

export const callbackPath = "/api/account/oauth/yandex/callback";
export const pendingCookie = "between_yandex_login";
export const loginTtl = 600;
export const pendingOptions = {
  httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: callbackPath,
};

export function yandexConfig() {
  const id = process.env.YANDEX_CLIENT_ID?.trim();
  const secret = process.env.YANDEX_CLIENT_SECRET?.trim();
  const origin = process.env.YANDEX_LOGIN_ORIGIN || "https://www.between-journal.ru";
  return id && secret ? { id, secret, origin } : null;
}

type Pending = { state: string; verifier: string; until: number; survey: boolean; locale: "en" | "ru" };
function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update("yandex-login." + payload).digest("base64url");
}

export function beginYandex(id: string, origin: string, signingSecret: string, survey: boolean, locale: "en" | "ru") {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const pending: Pending = { state, verifier, survey, locale, until: Date.now() + loginTtl * 1000 };
  const payload = Buffer.from(JSON.stringify(pending)).toString("base64url");
  const query = new URLSearchParams({
    client_id: id, response_type: "code", redirect_uri: origin + callbackPath, scope: "login:email",
    state, code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  });
  return { state, url: "https://oauth.yandex.ru/authorize?" + query, cookie: payload + "." + signature(payload, signingSecret) };
}

export function readYandexPending(cookie: string, state: string | null, secret: string): Pending | null {
  const [payload, sig, extra] = cookie.split(".");
  if (!payload || !sig || extra !== undefined) return null;
  const expected = Buffer.from(signature(payload, secret));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const pending = JSON.parse(Buffer.from(payload, "base64url").toString()) as Pending;
    return pending.state === state && Date.now() < pending.until ? pending : null;
  } catch { return null; }
}

export async function yandexIdentity(config: NonNullable<ReturnType<typeof yandexConfig>>, code: string, verifier: string) {
  const token = await fetch("https://oauth.yandex.ru/token", {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    headers: { Authorization: "Basic " + Buffer.from(config.id + ":" + config.secret).toString("base64") },
    body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier }),
  });
  if (!token.ok) return null;
  const { access_token: access } = await token.json();
  if (typeof access !== "string" || !access) return null;
  const info = await fetch("https://login.yandex.ru/info?format=json", {
    headers: { Authorization: "OAuth " + access }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!info.ok) return null;
  const { client_id, id, default_email } = await info.json();
  const email = normalizeEmail(default_email);
  return client_id === config.id && typeof id === "string" && /^\d{1,30}$/.test(id) && email ? { id, email } : null;
}
