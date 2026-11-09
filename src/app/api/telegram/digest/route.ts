import { NextResponse } from "next/server";
import {
  DIGEST_BATCH,
  digestAction,
  digestChannel,
  duePoll,
  maxUserIdFromDigest,
  nudgeText,
  pollText,
  slotForHour,
  type DigestRun,
} from "@/lib/digest";
import { resolveBotLocale } from "@/lib/i18n";
import {
  claimDigestSlot,
  getUserTimezone,
  listUserIds,
  loadDeviceLocale,
  loadUserLocale,
  loadUserStore,
  redisConfigured,
  releaseDigestSlot,
  saveDigestRun,
} from "@/lib/redis";
import { resolveJournalId, resolveMaxJournalId } from "@/lib/web-account-store";
import { ensureMaxSubscription, maxFeelingKeyboard, maxToken, sendMaxMessage } from "@/lib/max-bot";
import { ensureTelegramBlocks, feelingKeyboard, telegramRequest } from "@/lib/telegram-bot";
import { zonedParts } from "@/lib/zoned";

/** The hourly run walks every user. The default function limit cut the tail of the list off. */
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

type Outcome = "sent" | "skipped" | "failed" | "error";

async function digestUser(
  userId: string,
  now: Date,
  channels: { telegram: boolean; max: boolean },
): Promise<Outcome> {
  const channel = digestChannel(userId);
  if (!channel) return "skipped";
  if (channel === "telegram" && !channels.telegram) return "skipped";
  if (channel === "max" && !channels.max) return "skipped";
  const maxId = channel === "max" ? maxUserIdFromDigest(userId) : null;
  if (channel === "max" && !maxId) return "skipped";

  const owner =
    channel === "max" && maxId
      ? await resolveMaxJournalId(maxId)
      : await resolveJournalId(Number(userId));
  const timeZone = await getUserTimezone(owner);
  const clock = zonedParts(now, timeZone);
  const store = await loadUserStore(owner);
  const exact = slotForHour(clock.hour);
  const due = exact ? null : duePoll({ store, dateKey: clock.dateKey, hour: clock.hour });
  const slotName = exact ?? due;
  if (!slotName) return "skipped";

  const claimed = await claimDigestSlot(userId, clock.dateKey, slotName);
  const action = exact
    ? digestAction({
        localHour: clock.hour,
        dateKey: clock.dateKey,
        store,
        alreadySent: !claimed,
      })
    : claimed && due
      ? { type: "poll" as const, slot: due }
      : { type: "skip" as const };
  if (action.type === "skip") return "skipped";

  const locale =
    channel === "max"
      ? "ru"
      : resolveBotLocale(await loadUserLocale(owner), await loadDeviceLocale(owner), null);
  const ok =
    channel === "max" && maxId
      ? action.type === "poll"
        ? await sendMaxMessage(maxId, pollText(action.slot, locale), maxFeelingKeyboard(action.slot, locale))
        : await sendMaxMessage(maxId, nudgeText(locale))
      : action.type === "poll"
        ? await telegramRequest("sendMessage", {
            chat_id: Number(userId),
            text: pollText(action.slot, locale),
            reply_markup: feelingKeyboard(action.slot, locale),
          })
        : await telegramRequest("sendMessage", {
            chat_id: Number(userId),
            text: nudgeText(locale),
          });

  if (!ok) {
    await releaseDigestSlot(userId, clock.dateKey, slotName);
    return "failed";
  }
  return "sent";
}

async function runDigest() {
  const channels = {
    telegram: Boolean(process.env.BOT_TOKEN?.trim()),
    max: Boolean(maxToken()),
  };
  if (!redisConfigured() || (!channels.telegram && !channels.max)) {
    return NextResponse.json(
      { ok: false, error: "server_not_configured" },
      { status: 503 },
    );
  }
  const started = Date.now();
  if (channels.telegram) await ensureTelegramBlocks();
  if (channels.max) await ensureMaxSubscription();

  const now = new Date();
  const userIds = await listUserIds();
  const counts: Record<Outcome, number> = { sent: 0, skipped: 0, failed: 0, error: 0 };

  for (let index = 0; index < userIds.length; index += DIGEST_BATCH) {
    const batch = userIds.slice(index, index + DIGEST_BATCH);
    const outcomes = await Promise.all(
      batch.map((userId) => digestUser(userId, now, channels).catch((): Outcome => "error")),
    );
    for (const outcome of outcomes) counts[outcome] += 1;
  }

  const run: DigestRun = {
    at: now.toISOString(),
    users: userIds.length,
    sent: counts.sent,
    skipped: counts.skipped,
    failed: counts.failed,
    errors: counts.error,
    ms: Date.now() - started,
  };
  try {
    await saveDigestRun(run);
  } catch {
    // The summary is a diagnostic. The polls already went out.
  }
  console.log("digest", JSON.stringify(run));

  return NextResponse.json({
    ok: true,
    users: run.users,
    sent: run.sent,
    skipped: run.skipped,
    failed: run.failed,
    errors: run.errors,
    ms: run.ms,
  });
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return runDigest();
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return runDigest();
}
