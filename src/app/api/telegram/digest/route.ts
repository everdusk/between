import { NextResponse } from "next/server";
import {
  digestAction,
  NUDGE_TEXT,
  POLL_TEXT,
  slotForHour,
} from "@/lib/digest";
import {
  claimDigestSlot,
  getUserTimezone,
  listUserIds,
  loadUserStore,
  redisConfigured,
  releaseDigestSlot,
} from "@/lib/redis";
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
      const timeZone = await getUserTimezone(userId);
      const clock = zonedParts(now, timeZone);
      const store = await loadUserStore(userId);
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

      const ok =
        action.type === "poll"
          ? await telegramRequest("sendMessage", {
              chat_id: Number(userId),
              text: POLL_TEXT[action.slot],
              reply_markup: feelingKeyboard(action.slot),
            })
          : await telegramRequest("sendMessage", {
              chat_id: Number(userId),
              text: NUDGE_TEXT,
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
