import type { Actor } from "./account-actor";
import { getRedis } from "./redis";

/** An internal digest job has the storage ID, not a browser session. */
export async function isReviewJournal(journal: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const id = Number(
      await redis.get("between:pilot:weekly-review:telegram-id"),
    );
    if (!Number.isSafeInteger(id) || id <= 0) return false;
    const { resolveJournalId } = await import("./web-account-store");
    return journal === (await resolveJournalId(id));
  } catch {
    return false;
  }
}

/** Enrol once from a signed Telegram launch. Later name changes cannot transfer access. */
export async function isReviewOwner(
  actor: Pick<Actor, "messenger" | "telegramUserId" | "telegramUsername">,
): Promise<boolean> {
  if (!actor.telegramUserId) return false;
  const redis = getRedis();
  if (!redis) return false;
  return matchReviewOwner(actor, {
    verifyLinked: verifyTelegramHandle,
    read: () => redis.get("between:pilot:weekly-review:telegram-id"),
    bind: (id) =>
      redis.set("between:pilot:weekly-review:telegram-id", id, { nx: true }),
  });
}

// An existing web session may predate the pilot. Verify its linked ID against Telegram before first enrolment.
async function verifyTelegramHandle(id: number): Promise<boolean> {
  const token = process.env.BOT_TOKEN?.trim();
  if (!token) return false;
  const response = await fetch(
    "https://api.telegram.org/bot" + token + "/getChat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: id }),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    },
  );
  if (!response.ok) return false;
  const data = await response.json();
  return (
    data.ok &&
    data.result?.type === "private" &&
    data.result.id === id &&
    data.result.username?.toLowerCase() === "aliatorovskaia"
  );
}

export async function matchReviewOwner(
  actor: Pick<Actor, "telegramUserId" | "telegramUsername" | "messenger">,
  ledger: {
    read: () => Promise<unknown>;
    bind: (id: string) => Promise<unknown>;
    verifyLinked?: (id: number) => Promise<boolean>;
  },
): Promise<boolean> {
  if (!actor.telegramUserId) return false;
  try {
    const id = String(actor.telegramUserId);
    const pinned = await ledger.read();
    if (pinned != null) return String(pinned) === id;
    if (
      actor.telegramUsername?.toLowerCase() === "aliatorovskaia" &&
      (actor.messenger === "telegram" ||
        (await ledger.verifyLinked?.(actor.telegramUserId)))
    ) {
      await ledger.bind(id);
      return String(await ledger.read()) === id;
    }
    return false;
  } catch {
    return false;
  }
}
