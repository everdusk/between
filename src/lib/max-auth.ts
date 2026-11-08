import { createHmac, timingSafeEqual } from "node:crypto";

export type MaxWebAppUser = {
  id: number;
  username?: string;
};

export type ValidatedMaxInit = {
  user: MaxWebAppUser;
  authDate: number;
  startParam: string | null;
};

const MAX_AGE_SECONDS = 60 * 60;

/** Check MAX mini-app `WebAppData` / `initData`. The signature key is `MAX_BOT_TOKEN`. */
export function validateMaxInitData(
  initData: string,
  token: string | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): ValidatedMaxInit | null {
  const bot = token?.trim();
  if (!bot || !initData.trim()) return null;

  const pairs: [string, string][] = [];
  const seen = new Set<string>();
  let hash = "";
  for (const part of initData.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq <= 0) return null;
    const key = part.slice(0, eq);
    if (seen.has(key)) return null;
    seen.add(key);
    let value = part.slice(eq + 1);
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
    if (key === "hash") {
      hash = value;
      continue;
    }
    pairs.push([key, value]);
  }
  if (!/^[0-9a-f]{64}$/i.test(hash)) return null;

  pairs.sort((a, b) => a[0].localeCompare(b[0]));
  const launch = pairs.map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(bot).digest();
  const calculated = createHmac("sha256", secret).update(launch).digest("hex");
  try {
    const left = Buffer.from(calculated, "hex");
    const right = Buffer.from(hash, "hex");
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  } catch {
    return null;
  }

  const authDate = Number(pairs.find(([key]) => key === "auth_date")?.[1]);
  if (!Number.isFinite(authDate)) return null;
  const age = nowSec - authDate;
  if (age < -30 || age > MAX_AGE_SECONDS) return null;

  const user = readUser(pairs.find(([key]) => key === "user")?.[1]);
  if (!user) return null;
  const startParam = pairs.find(([key]) => key === "start_param")?.[1] ?? null;
  return { user, authDate, startParam };
}

function readUser(raw: string | undefined): MaxWebAppUser | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  let id = (parsed as { id?: unknown }).id;
  if (typeof id === "string" && /^\d+$/.test(id)) id = Number(id);
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return null;
  const usernameRaw = (parsed as { username?: unknown }).username;
  const username =
    typeof usernameRaw === "string" && usernameRaw.trim()
      ? usernameRaw.trim().replace(/^@/, "")
      : undefined;
  return { id, username };
}
