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
  loadWeekAccess,
  redisConfigured,
  releaseDigestSlot,
  saveDigestRun,
} from "@/lib/redis";
import { resolveJournalId, resolveMaxJournalId } from "@/lib/web-account-store";
import { ensureMaxSubscription, maxFeelingKeyboard, maxOnboardKeyboard, maxToken, sendMaxMessage } from "@/lib/max-bot";
import { translate } from "@/lib/messages";
import { accessForUser } from "@/lib/week-access";
import { deliverCycle } from "@/lib/trial-dispatch";
import { pingsReduced, quietHour } from "@/lib/trial-cycle";
import { ensureTrial } from "@/lib/trial-bot";
import { loadOnboarding, markQuizReminded, quizReminderDue, remindOnboarding } from "@/lib/onboarding-flow";
import { ensureTelegramBlocks, feelingKeyboard, onboardReplyMarkup, telegramRequest } from "@/lib/telegram-bot";
import { zonedParts } from "@/lib/zoned";

/** The hourly run walks every user. The default function limit cut the tail of the list off. */
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

type Tally = { sent: number; skipped: number; failed: number; error: number };

const EMPTY_TALLY: Tally = { sent: 0, skipped: 0, failed: 0, error: 0 };

async function digestUser(
  userId: string,
  now: Date,
  channels: { telegram: boolean; max: boolean },
): Promise<Tally> {
  const channel = digestChannel(userId);
  if (!channel) return { ...EMPTY_TALLY, skipped: 1 };
  if (channel === "telegram" && !channels.telegram) return { ...EMPTY_TALLY, skipped: 1 };
  if (channel === "max" && !channels.max) return { ...EMPTY_TALLY, skipped: 1 };
  const maxId = channel === "max" ? maxUserIdFromDigest(userId) : null;
  if (channel === "max" && !maxId) return { ...EMPTY_TALLY, skipped: 1 };

  const owner =
    channel === "max" && maxId
      ? await resolveMaxJournalId(maxId)
      : await resolveJournalId(Number(userId));
  await ensureTrial(owner, now);
  const timeZone = await getUserTimezone(owner);
  const clock = zonedParts(now, timeZone);
  const store = await loadUserStore(owner);
  const locale =
    channel === "max"
      ? "ru"
      : resolveBotLocale(await loadUserLocale(owner), await loadDeviceLocale(owner), null);
  const actorId = channel === "max" && maxId ? maxId : Number(userId);
  const access = accessForUser(
    await loadWeekAccess(owner),
    { id: channel === "max" ? 0 : actorId },
    process.env.WEEK_EXEMPT_USER_IDS,
    now,
  );
  const onboarding = await loadOnboarding(owner);
  const onboardingOpen = Boolean(onboarding && onboarding.step !== "done");
  let cycleSent = 0;
  if (quietHour(clock.hour)) return { ...EMPTY_TALLY, skipped: 1 };
  if (quizReminderDue(onboarding, now, clock.hour)) {
    const reminder = await remindOnboarding(owner, locale);
    if (reminder) {
      const text = `${translate(locale, "botQuizRemind")}\n\n${reminder.text}`;
      const asked =
        channel === "max" && maxId
          ? await sendMaxMessage(maxId, text, maxOnboardKeyboard(reminder.rows))
          : await telegramRequest("sendMessage", {
              chat_id: Number(userId),
              text,
              reply_markup: onboardReplyMarkup(reminder.rows),
            });
      if (asked) {
        await markQuizReminded(owner);
        cycleSent += 1;
      }
    }
  }
  if (!access.view.paused) {
    cycleSent += await deliverCycle({
      channel,
      userId,
      owner,
      maxId,
      record: access.record,
      status: access.view.status,
      store,
      plan: store.sessionPlan,
      dateKey: clock.dateKey,
      hour: clock.hour,
      now,
      timeZone: timeZone ?? "Europe/Moscow",
      locale,
      onboardingOpen,
    });
  }
  const reduced = pingsReduced(access.record.openedAt, store.entries, now);
  const pollsOpen =
    !onboardingOpen && !access.view.paused && access.view.status !== "locked" && access.view.status !== "new";
  const exact = !pollsOpen || (reduced && slotForHour(clock.hour) !== "nudge") ? null : slotForHour(clock.hour);
  const due = pollsOpen && !reduced && !exact ? duePoll({ store, dateKey: clock.dateKey, hour: clock.hour }) : null;
  const slotName = exact ?? due;
  if (!slotName) return cycleSent ? { ...EMPTY_TALLY, sent: cycleSent } : { ...EMPTY_TALLY, skipped: 1 };

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
  if (action.type === "skip") return cycleSent ? { ...EMPTY_TALLY, sent: cycleSent } : { ...EMPTY_TALLY, skipped: 1 };

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
    return cycleSent ? { ...EMPTY_TALLY, sent: cycleSent } : { ...EMPTY_TALLY, failed: 1 };
  }
  return { ...EMPTY_TALLY, sent: cycleSent + 1 };
}

async function runDigest() {
  const channels = {
    telegram: Boolean(process.env.BOT_TOKEN?.trim()),
    max: Boolean(maxToken()),
  };
  if (!redisConfigured() || (!channels.telegram && !channels.max)) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
  }
  const started = Date.now();
  if (channels.telegram) await ensureTelegramBlocks();
  if (channels.max) await ensureMaxSubscription();

  const now = new Date();
  const userIds = await listUserIds();
  const counts: Tally = { ...EMPTY_TALLY };

  for (let index = 0; index < userIds.length; index += DIGEST_BATCH) {
    const batch = userIds.slice(index, index + DIGEST_BATCH);
    const outcomes = await Promise.all(
      batch.map((userId) => digestUser(userId, now, channels).catch((): Tally => ({ ...EMPTY_TALLY, error: 1 }))),
    );
    for (const outcome of outcomes) {
      counts.sent += outcome.sent;
      counts.skipped += outcome.skipped;
      counts.failed += outcome.failed;
      counts.error += outcome.error;
    }
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
