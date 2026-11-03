import type { Actor } from "./account-actor";
import { getRedis } from "./redis";
import { loadAccount, accountIdForTelegram } from "./web-account-store";
import { webStorageId } from "./web-account";

const USERS_KEY = "between:users";

export type ErasureAccount = {
  id: string;
  email: string;
  telegramUserId: number | null;
  providers: Partial<Record<"vk" | "yandex" | "sber", string>>;
};

/** Fixed keys and scan patterns for one journal id. Does not include another person's id. */
export function erasurePlan(input: {
  storageIds: string[];
  account: ErasureAccount | null;
}): { keys: string[]; patterns: string[]; users: string[] } {
  const keys: string[] = [];
  const patterns: string[] = [];
  const users: string[] = [];
  for (const id of input.storageIds) {
    if (!id) continue;
    users.push(id);
    keys.push(
      `between:user:${id}:store`,
      `between:user:${id}:tz`,
      `between:user:${id}:week-access`,
      `between:user:${id}:locale`,
      `between:user:${id}:device-locale`,
      `between:user:${id}:bot-intro`,
      `between:user:${id}:source`,
    );
    patterns.push(
      `between:user:${id}:brief:*`,
      `between:user:${id}:brief-latest:*`,
      `between:user:${id}:brief-count:*`,
      `between:digest:${id}:*`,
    );
  }
  const account = input.account;
  if (account) {
    keys.push(`between:acct:${account.id}`, `between:acct:email:${account.email}`, `between:otp:${account.email}`);
    if (account.telegramUserId != null) keys.push(`between:acct:tg:${account.telegramUserId}`);
    for (const provider of ["vk", "yandex", "sber"] as const) {
      const subject = account.providers[provider];
      if (subject) keys.push(`between:acct:oauth:${provider}:${subject}`);
    }
  }
  return { keys, patterns, users };
}

type EraseRedis = {
  del: (...keys: string[]) => Promise<unknown>;
  srem: (key: string, ...members: string[]) => Promise<unknown>;
  scan: (
    cursor: string | number,
    opts: { match: string; count: number },
  ) => Promise<[string | number, string[]]>;
};

async function deletePattern(redis: EraseRedis, pattern: string): Promise<void> {
  let cursor: string | number = 0;
  for (let step = 0; step < 40; step += 1) {
    const [next, found] = await redis.scan(cursor, { match: pattern, count: 200 });
    cursor = next;
    if (found.length) await redis.del(...found);
    if (String(cursor) === "0") return;
  }
}

/** Erases the journal, the sign-in, and a linked Telegram copy. Anonymous day counters stay. */
export async function eraseActorData(actor: Actor, redis: EraseRedis | null = getRedis()): Promise<boolean> {
  if (!redis) return false;
  const storageIds = new Set<string>([actor.id]);
  if (actor.telegramUserId != null) storageIds.add(String(actor.telegramUserId));

  let account: ErasureAccount | null = null;
  if (actor.id.startsWith("web:")) {
    const loaded = await loadAccount(actor.id.slice("web:".length));
    if (loaded) account = loaded;
  } else if (actor.telegramUserId != null) {
    const linked = await accountIdForTelegram(actor.telegramUserId);
    if (linked) {
      const loaded = await loadAccount(linked);
      if (loaded) {
        account = loaded;
        storageIds.add(webStorageId(loaded.id));
      }
    }
  }

  const plan = erasurePlan({ storageIds: [...storageIds], account });
  if (plan.keys.length) await redis.del(...plan.keys);
  for (const pattern of plan.patterns) await deletePattern(redis, pattern);
  if (plan.users.length) await redis.srem(USERS_KEY, ...plan.users);
  return true;
}
