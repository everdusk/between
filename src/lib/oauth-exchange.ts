import { randomBytes } from "node:crypto";
import https from "node:https";
import { sberIdentity, vkProfile, yandexProfile, type OauthClient, type OauthProvider } from "./oauth";

export type OauthIdentity = {
  id: string;
  altIds: string[];
  email: string | null;
};

function form(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

function pem(value: string | undefined): string {
  return (value ?? "").replace(/\\n/g, "\n").trim();
}

function request(
  method: "GET" | "POST",
  url: string,
  body: string,
  headers: Record<string, string>,
  tls?: { cert: string; key: string },
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = https.request(
      {
        method,
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        headers:
          method === "POST"
            ? {
                ...headers,
                "content-type": "application/x-www-form-urlencoded",
                "content-length": Buffer.byteLength(body),
              }
            : headers,
        cert: tls?.cert,
        key: tls?.key,
        timeout: 10_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    if (method === "POST") req.write(body);
    req.end();
  });
}

function postForm(
  url: string,
  body: string,
  headers: Record<string, string>,
  tls?: { cert: string; key: string },
): Promise<{ status: number; text: string }> {
  return request("POST", url, body, headers, tls);
}

async function readJson(res: { status: number; text: string }): Promise<unknown | null> {
  if (res.status < 200 || res.status >= 300) return null;
  try {
    return JSON.parse(res.text) as unknown;
  } catch {
    return null;
  }
}

export async function exchangeOauth(
  provider: OauthProvider,
  client: OauthClient,
  code: string,
  pending: { state: string; nonce: string; verifier: string },
  deviceId: string,
  redirectUri: string,
): Promise<OauthIdentity | null> {
  if (provider === "vk") return exchangeVk(client, code, pending, deviceId, redirectUri);
  if (provider === "yandex") return exchangeYandex(client, code, pending.verifier, redirectUri);
  return exchangeSber(client, code, pending, redirectUri);
}

async function exchangeVk(
  client: OauthClient,
  code: string,
  pending: { state: string; verifier: string },
  deviceId: string,
  redirectUri: string,
): Promise<OauthIdentity | null> {
  const fields: Record<string, string> = {
    grant_type: "authorization_code",
    code_verifier: pending.verifier,
    redirect_uri: redirectUri,
    code,
    client_id: client.id,
    device_id: deviceId,
    state: pending.state,
  };
  if (client.secret) fields.service_token = client.secret;
  const token = await readJson(
    await postForm("https://id.vk.ru/oauth2/auth", form(fields), {}),
  );
  const access = token && typeof token === "object" ? (token as { access_token?: unknown }).access_token : null;
  if (typeof access !== "string" || !access) return null;
  const profile = await readJson(
    await postForm(
      "https://id.vk.ru/oauth2/user_info",
      form({ client_id: client.id, access_token: access }),
      {},
    ),
  );
  const user = vkProfile(profile);
  if (user) return { id: user.id, altIds: [], email: user.email };
  const fallback = token && typeof token === "object" ? (token as { user_id?: unknown }).user_id : null;
  const id = typeof fallback === "number" || typeof fallback === "string" ? String(fallback) : "";
  if (!/^\d+$/.test(id)) return null;
  return { id, altIds: [], email: null };
}

async function exchangeYandex(
  client: OauthClient,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<OauthIdentity | null> {
  const token = await readJson(
    await postForm(
      "https://oauth.yandex.com/token",
      form({
        grant_type: "authorization_code",
        code,
        client_id: client.id,
        client_secret: client.secret,
        code_verifier: verifier,
        redirect_uri: redirectUri,
      }),
      {},
    ),
  );
  const access = token && typeof token === "object" ? (token as { access_token?: unknown }).access_token : null;
  if (typeof access !== "string" || !access) return null;
  const info = await fetch("https://login.yandex.ru/info?format=json", {
    headers: { Authorization: `OAuth ${access}` },
  });
  if (!info.ok) return null;
  const profile = yandexProfile(await info.json().catch(() => null));
  if (!profile) return null;
  return { id: profile.id, altIds: [], email: profile.email };
}

async function exchangeSber(
  client: OauthClient,
  code: string,
  pending: { nonce: string; verifier: string },
  redirectUri: string,
): Promise<OauthIdentity | null> {
  const cert = pem(process.env.SBER_CLIENT_CERT);
  const key = pem(process.env.SBER_CLIENT_KEY);
  const tls = cert && key ? { cert, key } : undefined;
  const tokenUrl = process.env.SBER_TOKEN_URL?.trim() || "https://oauth.sber.ru/ru/prod/tokens/v2/oidc";
  const rquid = randomHex(32);
  const token = await readJson(
    await postForm(
      tokenUrl,
      form({
        grant_type: "authorization_code",
        code,
        client_id: client.id,
        client_secret: client.secret,
        redirect_uri: redirectUri,
        code_verifier: pending.verifier,
      }),
      { accept: "application/json", rquid },
      tls,
    ),
  );
  const idToken = token && typeof token === "object" ? (token as { id_token?: unknown }).id_token : null;
  if (typeof idToken !== "string") return null;
  const identity = sberIdentity(idToken, pending.nonce, client.id);
  if (!identity) return null;
  const access = (token as { access_token?: unknown }).access_token;
  if (typeof access !== "string" || !access || identity.email) return identity;
  const userinfoUrl =
    process.env.SBER_USERINFO_URL?.trim() || "https://oauth.sber.ru/ru/prod/sberbankid/v2.1/userinfo";
  try {
    const info = await request(
      "GET",
      userinfoUrl,
      "",
      { authorization: `Bearer ${access}`, accept: "application/json", rquid: randomHex(32) },
      tls,
    );
    const body = await readJson(info);
    const email = body && typeof body === "object" ? (body as { email?: unknown }).email : null;
    if (typeof email === "string") identity.email = email;
  } catch {
    return identity;
  }
  return identity;
}

function randomHex(length: number): string {
  return randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}
