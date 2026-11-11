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
import { resolveBotLocale, type LocaleId } from "@/lib/i18n";
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
import { ensureMaxSubscription, maxFeelingKeyboard, maxToken, sendMaxDocument, sendMaxMessage, weekOpenKeyboard as maxWeekKeyboard } from "@/lib/max-bot";
import { accessForUser } from "@/lib/week-access";
import { sessionBriefDue, SESSION_BRIEF_SLOT, sessionPdfActive, sessionPdfCaption, sessionPdfOpen } from "@/lib/session-brief";
import { renderSessionPdf, sessionPeriodNoteCount } from "@/lib/session-pdf";
import { prepareSessionSheet } from "@/lib/session-sheet";
import { appUrl } from "@/lib/telegram-auth";
import { ensureTelegramBlocks, feelingKeyboard, sendTelegramDocument, telegramRequest, weekOpenKeyboard } from "@/lib/telegram-bot";
import type { TherapyStore } from "@/lib/types";
import { zonedParts } from "@/lib/zoned";

async function deliverSessionPdf(input: {
  channel: "telegram" | "max";
  userId: string;
  owner: string;
  actorId: number;
  maxId: number | null;
  dateKey: string;
  hour: number;
  now: Date;
  store: TherapyStore;
  locale: LocaleId;
}): Promise<boolean> {
  const due = sessionBriefDue({ plan: input.store.sessionPlan, dateKey: input.dateKey, hour: input.hour });
  if (!due) return false;
  const access = accessForUser(
    await loadWeekAccess(input.owner),
    { id: input.actorId },
    process.env.WEEK_EXEMPT_USER_IDS,
    input.now,
  );
  if (!sessionPdfOpen(access.view.status)) return false;
  const notes = sessionPeriodNoteCount(input.store, input.dateKey, input.now);
  if (!sessionPdfActive(notes)) return false;
  const claimed = await claimDigestSlot(input.userId, input.dateKey, SESSION_BRIEF_SLOT);
  if (!claimed) return false;
  try {
    const sheet = await prepareSessionSheet(
      input.store,
      input.locale,
      input.dateKey,
      input.now,
      input.owner,
    );
    const pdf = await renderSessionPdf(input.store, input.locale, input.dateKey, input.now, sheet);
    const caption = sessionPdfCaption(input.locale, due.time);
    const ok =
      input.channel === "max" && input.maxId
        ? await sendMaxDocument(input.maxId, pdf.filename, pdf.bytes, caption, maxWeekKeyboard(input.locale))
        : await sendTelegramDocument(
            Number(input.userId),
            pdf.filename,
            pdf.bytes,
            caption,
            weekOpenKeyboard(appUrl(), input.locale),
          );
    if (!ok) {
      await releaseDigestSlot(input.userId, input.dateKey, SESSION_BRIEF_SLOT);
      return false;
    }
    return true;
  } catch {
    await releaseDigestSlot(input.userId, input.dateKey, SESSION_BRIEF_SLOT);
    return false;
  }
}

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
      const pdfSent = await deliverSessionPdf({
        channel,
        userId,
        owner,
        actorId: channel === "max" && maxId ? maxId : Number(userId),
        maxId,
        dateKey: clock.dateKey,
        hour: clock.hour,
        now,
        store,
        locale,
      });
      const exact = slotForHour(clock.hour);
      const due = exact ? null : duePoll({ store, dateKey: clock.dateKey, hour: clock.hour });
      const slotName = exact ?? due;
      if (!slotName) {
        if (pdfSent) sent += 1;
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
        if (pdfSent) sent += 1;
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
        if (!pdfSent) skipped += 1;
        else sent += 1;
        continue;
      }
      sent += pdfSent ? 2 : 1;
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
