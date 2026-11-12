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
  loadWeekAccess,
  redisConfigured,
  releaseDigestSlot,
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

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export const maxDuration = 60;

async function runDigest() {
  const telegramOn = Boolean(process.env.BOT_TOKEN?.trim());
  const maxOn = Boolean(maxToken());
  if (!redisConfigured() || (!telegramOn && !maxOn)) {
    return NextResponse.json(
      { ok: false, error: "server_not_configured" },
      { status: 503 },
    );
  }
  if (telegramOn) await ensureTelegramBlocks();
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
      await ensureTrial(owner, now);
      const timeZone = await getUserTimezone(owner);
      const clock = zonedParts(now, timeZone);
      const store = await loadUserStore(owner);
      const locale =
        channel === "max"
          ? "ru"
          : resolveBotLocale(
              await loadUserLocale(owner),
              await loadDeviceLocale(owner),
              null,
            );
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
      if (quietHour(clock.hour)) {
        skipped += 1;
        continue;
      }
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
      const pollsOpen = !onboardingOpen && !access.view.paused && access.view.status !== "locked" && access.view.status !== "new";
      const exact = !pollsOpen || (reduced && slotForHour(clock.hour) !== "nudge") ? null : slotForHour(clock.hour);
      const due = pollsOpen && !reduced && !exact ? duePoll({ store, dateKey: clock.dateKey, hour: clock.hour }) : null;
      const slotName = exact ?? due;
      if (!slotName) {
        if (cycleSent) sent += cycleSent;
        else skipped += 1;
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
        if (cycleSent) sent += cycleSent;
        else skipped += 1;
        continue;
      }

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
        if (cycleSent) sent += cycleSent;
        else skipped += 1;
        continue;
      }
      sent += cycleSent + 1;
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
