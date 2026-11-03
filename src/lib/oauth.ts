import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appUrl } from "./telegram-auth";

export const OAUTH_COOKIE = "between_oauth";
export const OAUTH_PROVIDERS = ["vk", "yandex", "sber"] as const;
export type OauthProvider = (typeof OAUTH_PROVIDERS)[number];

const STATE_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
const OAUTH_MS = 10 * 60 * 1000;

export function isOauthProvider(value: string): value is OauthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

export function oauthSubject(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const id = String(value).trim();
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(id)) return null;
  return id;
}

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function oauthRedirect(origin: string, provider: OauthProvider): string {
  return `${origin.replace(/\/$/, "")}/api/account/oauth/${provider}/callback`;
}

export function requestOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return appUrl();
}

type OauthPending = {
  provider: OauthProvider;
  state: string;
  nonce: string;
  verifier: string;
  exp: number;
};

function randomToken(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += STATE_ALPHABET[bytes[i] % STATE_ALPHABET.length];
  return out;
}

export function beginOauth(provider: OauthProvider, secret: string, now = Date.now()): {
  pending: OauthPending;
  cookie: string;
} {
  const pending: OauthPending = {
    provider,
    state: randomToken(43),
    nonce: randomToken(32),
    verifier: randomToken(64),
    exp: now + OAUTH_MS,
  };
  const payload = Buffer.from(JSON.stringify(pending)).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return { pending, cookie: `${payload}.${sig}` };
}

export function readOauth(cookie: string, secret: string, now = Date.now()): OauthPending | null {
  const split = cookie.split(".");
  if (split.length !== 2) return null;
  const [payload, sig] = split;
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  let parsed: Partial<OauthPending>;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<OauthPending>;
  } catch {
    return null;
  }
  if (!parsed.provider || !isOauthProvider(parsed.provider)) return null;
  if (typeof parsed.state !== "string" || parsed.state.length < 32 || parsed.state.length > 96) return null;
  if (typeof parsed.nonce !== "string" || parsed.nonce.length < 8 || parsed.nonce.length > 64) return null;
  if (typeof parsed.verifier !== "string" || parsed.verifier.length < 43 || parsed.verifier.length > 128) return null;
  if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
  return {
    provider: parsed.provider,
    state: parsed.state,
    nonce: parsed.nonce,
    verifier: parsed.verifier,
    exp: parsed.exp,
  };
}

export type OauthClient = { id: string; secret: string };

export function oauthClient(provider: OauthProvider): OauthClient | null {
  if (provider === "vk") {
    const id = process.env.VK_CLIENT_ID?.trim();
    if (!id) return null;
    return { id, secret: process.env.VK_SERVICE_TOKEN?.trim() ?? "" };
  }
  if (provider === "yandex") {
    const id = process.env.YANDEX_CLIENT_ID?.trim();
    const secret = process.env.YANDEX_CLIENT_SECRET?.trim();
    if (!id || !secret) return null;
    return { id, secret };
  }
  const id = process.env.SBER_CLIENT_ID?.trim();
  const secret = process.env.SBER_CLIENT_SECRET?.trim();
  if (!id || !secret) return null;
  return { id, secret };
}

export function authorizeUrl(
  provider: OauthProvider,
  client: OauthClient,
  pending: OauthPending,
  redirect: string,
): string {
  if (provider === "vk") {
    const url = new URL("https://id.vk.ru/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", client.id);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", pending.state);
    url.searchParams.set("code_challenge", codeChallenge(pending.verifier));
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("scope", "vkid.personal_info email");
    return url.toString();
  }
  if (provider === "yandex") {
    const url = new URL("https://oauth.yandex.com/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", client.id);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", pending.state);
    url.searchParams.set("scope", "login:email login:info");
    url.searchParams.set("code_challenge", codeChallenge(pending.verifier));
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }
  const url = new URL("https://id.sber.ru/CSAFront/oidc/authorize.do");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_type", "PRIVATE");
  url.searchParams.set("client_id", client.id);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("state", pending.state);
  url.searchParams.set("nonce", pending.nonce);
  url.searchParams.set("scope", "openid name email");
  url.searchParams.set("code_challenge", codeChallenge(pending.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function vkProfile(body: unknown): { id: string; email: string | null } | null {
  if (!body || typeof body !== "object") return null;
  const user = (body as { user?: unknown }).user;
  const row = (user && typeof user === "object" ? user : body) as { user_id?: unknown; email?: unknown };
  const id = oauthSubject(row.user_id);
  if (!id) return null;
  const email = typeof row.email === "string" ? row.email : null;
  return { id, email };
}

export function yandexProfile(body: unknown): { id: string; email: string | null } | null {
  if (!body || typeof body !== "object") return null;
  const row = body as { id?: unknown; default_email?: unknown };
  const id = oauthSubject(row.id);
  if (!id) return null;
  const email = typeof row.default_email === "string" ? row.default_email : null;
  return { id, email };
}

export function sberIdentity(
  idToken: string,
  nonce: string,
  clientId: string,
): { id: string; altIds: string[]; email: string | null } | null {
  const parts = idToken.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  let payload: {
    sub?: unknown;
    nonce?: unknown;
    aud?: unknown;
    email?: unknown;
    sub_alt?: unknown;
  };
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as typeof payload;
  } catch {
    return null;
  }
  if (payload.nonce !== nonce) return null;
  const aud = payload.aud;
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!audiences.includes(clientId)) return null;
  const id = oauthSubject(payload.sub);
  if (!id) return null;
  const altRaw = Array.isArray(payload.sub_alt) ? payload.sub_alt : payload.sub_alt ? [payload.sub_alt] : [];
  const altIds = altRaw.map(oauthSubject).filter((item): item is string => Boolean(item) && item !== id);
  const email = typeof payload.email === "string" ? payload.email : null;
  return { id, altIds, email };
}
