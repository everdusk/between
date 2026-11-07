import { NextResponse } from "next/server";
import {
  digestAction,
  digestChannel,
  duePoll,
  maxUserIdFromDigest,
  nudgeText,
  pollText,
  slotForHour,
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
} from "@/lib/redis";
import { resolveJournalId, resolveMaxJournalId } from "@/lib/web-account-store";
import { ensureMaxSubscription, maxFeelingKeyboard, maxToken, sendMaxMessage } from "@/lib/max-bot";
import { feelingKeyboard, telegramRequest } from "@/lib/telegram-bot";
import { zonedParts } from "@/lib/zoned";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function runDigest() {
  const telegramOn = Boolean(process.env.BOT_TOKEN?.trim());
  const maxOn = Boolean(maxToken());
  if (!redisConfigured() || (!telegramOn && !maxOn)) {
    return NextResponse.json(
      { ok: false, error: "server_not_configured" },
      { status: 503 },
    );
  }
  if (maxOn) await ensureMaxSubscription();

  const now = new Date();
  const userIds = await listUserIds();
  let sent = 0;
  let skipped = 0;

  for (const userId of userIds) {
    try {
      const channel = digestChannel(userId);
      if (channel === "telegram" && !telegramOn) {
        skipped += 1;
        continue;
      }
      if (channel === "max" && !maxOn) {
        skipped += 1;
        continue;
      }
      if (!channel) {
        skipped += 1;
        continue;
      }
      const maxId = channel === "max" ? maxUserIdFromDigest(userId) : null;
      if (channel === "max" && !maxId) {
        skipped += 1;
        continue;
      }
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
      if (!slotName) {
        skipped += 1;
        continue;
      }

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

      if (action.type === "skip") {
        skipped += 1;
        continue;
      }

      const locale = resolveBotLocale(
        await loadUserLocale(owner),
        await loadDeviceLocale(owner),
        null,
      );
      const ok =
        channel === "max" && maxId
          ? action.type === "poll"
            ? await sendMaxMessage(
                maxId,
                pollText(action.slot, locale),
                maxFeelingKeyboard(action.slot, locale),
              )
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
        skipped += 1;
        continue;
      }
      sent += 1;
    } catch {
      skipped += 1;
    }
  }

  return NextResponse.json({ ok: true, users: userIds.length, sent, skipped });
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
