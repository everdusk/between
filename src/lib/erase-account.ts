import type { Actor } from "./account-actor";
import { maxStorageId, webStorageId } from "./web-account";
import { getRedis } from "./redis";
import { accountIdForMax, accountIdForTelegram, loadAccount, type AccountRecord } from "./web-account-store";

const USERS_KEY = "between:users";

export type ErasureAccount = {
  id: string;
  email: string;
  telegramUserId: number | null;
  maxUserId: number | null;
  providers: Partial<Record<"vk" | "yandex" | "sber", string>>;
  resetTokenHash: string | null;
};

type EraseRedis = {
  del: (...keys: string[]) => Promise<unknown>;
  get: (key: string) => Promise<unknown>;
  srem: (key: string, ...members: string[]) => Promise<unknown>;
  scan: (
    cursor: string | number,
    opts: { match: string; count: number },
  ) => Promise<[string | number, string[]]>;
};

/** Fixed keys and scan patterns for one journal. Does not include another person's id. */
export function erasurePlan(input: {
  storageIds: string[];
  account: ErasureAccount | null;
}): { keys: string[]; patterns: string[] } {
  const keys: string[] = [];
  const patterns: string[] = [];
  for (const id of input.storageIds) {
    if (!id || /[*?[\]\\]/.test(id)) continue;
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
    keys.push(
      `between:acct:${account.id}`,
      `between:acct:email:${account.email}`,
      `between:otp:${account.email}`,
      `between:signup:${account.email}`,
      `between:reset-wait:${account.email}`,
      `between:reset-active:${account.email}`,
    );
    if (account.resetTokenHash) keys.push(`between:reset:${account.resetTokenHash}`);
    if (account.telegramUserId != null) keys.push(`between:acct:tg:${account.telegramUserId}`);
    if (account.maxUserId != null) keys.push(`between:acct:max:${account.maxUserId}`);
    for (const provider of ["vk", "yandex", "sber"] as const) {
      const subject = account.providers[provider];
      if (subject) keys.push(`between:acct:oauth:${provider}:${subject}`);
    }
  }
  return { keys, patterns };
}

async function deletePattern(redis: EraseRedis, pattern: string): Promise<void> {
  let cursor: string | number = 0;
  for (let step = 0; step < 40; step += 1) {
    const [next, found] = await redis.scan(cursor, { match: pattern, count: 200 });
    cursor = next;
    if (found.length) await redis.del(...found);
    if (String(cursor) === "0") return;
  }
}

function asAccountView(account: AccountRecord, resetTokenHash: string | null): ErasureAccount {
  return {
    id: account.id,
    email: account.email,
    telegramUserId: account.telegramUserId,
    maxUserId: account.maxUserId,
    providers: account.providers,
    resetTokenHash,
  };
}

/** Erases the journal, the sign-in, and a linked Telegram or MAX copy. Anonymous day counters stay. */
export async function eraseActorData(actor: Actor, redis: EraseRedis | null = getRedis()): Promise<boolean> {
  if (!redis) return false;
  let account: AccountRecord | null = null;
  if (actor.id.startsWith("web:")) {
    account = await loadAccount(actor.id.slice(4));
  } else if (actor.telegramUserId != null) {
    const linked = await accountIdForTelegram(actor.telegramUserId);
    if (linked) account = await loadAccount(linked);
  } else if (actor.messenger === "max" && typeof actor.analyticsId === "number") {
    const linked = await accountIdForMax(actor.analyticsId);
    if (linked) account = await loadAccount(linked);
  }

  const storageIds = new Set<string>([actor.id]);
  if (actor.telegramUserId != null) storageIds.add(String(actor.telegramUserId));
  if (account) {
    storageIds.add(webStorageId(account.id));
    if (account.telegramUserId != null) storageIds.add(String(account.telegramUserId));
    if (account.maxUserId != null) storageIds.add(maxStorageId(account.maxUserId));
  }

  const resetTokenHash = account
    ? await redis.get(`between:reset-active:${account.email}`).then((value) =>
        typeof value === "string" && value ? value : null,
      )
    : null;
  const plan = erasurePlan({
    storageIds: [...storageIds],
    account: account ? asAccountView(account, resetTokenHash) : null,
  });
  if (plan.keys.length) await redis.del(...plan.keys);
  for (const pattern of plan.patterns) await deletePattern(redis, pattern);
  if (storageIds.size) await redis.srem(USERS_KEY, ...storageIds);
  return true;
}
