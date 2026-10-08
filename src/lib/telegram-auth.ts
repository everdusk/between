import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type ValidatedInitData = {
  user: TelegramWebAppUser;
  authDate: number;
  raw: URLSearchParams;
};

function botToken(): string | null {
  const token = process.env.BOT_TOKEN?.trim();
  return token || null;
}

/** Validate Telegram Mini App `initData` per Bot API docs. */
export function validateInitData(
  initData: string,
  maxAgeSeconds = 60 * 60 * 24,
): ValidatedInitData | null {
  const token = botToken();
  if (!token || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const calculated = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  try {
    const a = Buffer.from(calculated, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number(authDateRaw) : NaN;
  if (!Number.isFinite(authDate)) return null;
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age < 0 || age > maxAgeSeconds) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;
  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(userRaw) as TelegramWebAppUser;
  } catch {
    return null;
  }
  if (!user?.id || typeof user.id !== "number") return null;

  return { user, authDate, raw: params };
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://between-rouge.vercel.app"
  );
}
