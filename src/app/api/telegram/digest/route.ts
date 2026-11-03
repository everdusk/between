import { NextResponse } from "next/server";
import { digestAction, nudgeText, pollText, slotForHour } from "@/lib/digest";
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
import { resolveJournalId } from "@/lib/web-account-store";
import { feelingKeyboard, telegramRequest } from "@/lib/telegram-bot";
import { zonedParts } from "@/lib/zoned";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function runDigest() {
  if (!redisConfigured() || !process.env.BOT_TOKEN?.trim()) {
    return NextResponse.json(
      { ok: false, error: "server_not_configured" },
      { status: 503 },
    );
  }

  const now = new Date();
  const userIds = await listUserIds();
  let sent = 0;
  let skipped = 0;

  for (const userId of userIds) {
    try {
      if (!/^\d+$/.test(userId)) {
        skipped += 1;
        continue;
      }
      const owner = await resolveJournalId(Number(userId));
      const timeZone = await getUserTimezone(owner);
      const clock = zonedParts(now, timeZone);
      const store = await loadUserStore(owner);
      const slotName = slotForHour(clock.hour);
      if (!slotName) {
        skipped += 1;
        continue;
      }

      const claimed = await claimDigestSlot(userId, clock.dateKey, slotName);
      const action = digestAction({
        localHour: clock.hour,
        dateKey: clock.dateKey,
        store,
        alreadySent: !claimed,
      });

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
        action.type === "poll"
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
