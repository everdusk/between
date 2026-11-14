import type { LocaleId } from "./i18n";
import { duePoll, moodPollsOpen, pollText } from "./digest";
import { loadOnboarding } from "./onboarding-flow";
import {
  claimDigestSlot,
  getUserTimezone,
  loadMessengerName,
  loadUserStore,
  loadWeekAccess,
  releaseDigestSlot,
  rememberMessengerName,
} from "./redis";
import { feelingKeyboard, telegramRequest } from "./telegram-bot";
import { pingsReduced, quietHour } from "./trial-cycle";
import { accountIdForMax, accountIdForTelegram, loadAccount, resolveJournalId } from "./web-account-store";
import { accessForUser } from "./week-access";
import { zonedParts } from "./zoned";

/** Name the hourly run can match against the forever grant. The account wins when the chat has not spoken since. */
export async function messengerUsername(userId: string, channel: "telegram" | "max"): Promise<string | undefined> {
  const stored = await loadMessengerName(userId);
  if (channel === "telegram" && /^\d+$/.test(userId)) {
    const accountId = await accountIdForTelegram(Number(userId));
    const account = accountId ? await loadAccount(accountId) : null;
    return account?.telegramUsername || stored;
  }
  const max = /^max:(\d+)$/.exec(userId);
  if (!max) return stored;
  const accountId = await accountIdForMax(Number(max[1]));
  const account = accountId ? await loadAccount(accountId) : null;
  return account?.maxUsername || account?.telegramUsername || stored;
}

/**
 * The mood question that is already due today.
 * MAX sends this when a chat opens. Telegram only had the hourly run, which does not see the person's name,
 * so a forever grant looked like a locked week and the question never left.
 */
export async function sendDueTelegramPoll(input: {
  chatId: number;
  userId: number;
  username?: string;
  locale: LocaleId;
}): Promise<void> {
  const spoken = input.username?.trim().replace(/^@/, "");
  if (spoken) await rememberMessengerName(input.userId, spoken);
  const owner = await resolveJournalId(input.userId);
  const now = new Date();
  const timeZone = await getUserTimezone(owner);
  const clock = zonedParts(now, timeZone);
  if (quietHour(clock.hour)) return;
  const store = await loadUserStore(owner);
  const username = spoken || (await loadMessengerName(input.userId));
  const access = accessForUser(
    await loadWeekAccess(owner),
    { id: input.userId, username },
    process.env.WEEK_EXEMPT_USER_IDS,
    now,
  );
  const onboarding = await loadOnboarding(owner);
  const pollsOpen = moodPollsOpen({
    onboardingOpen: Boolean(onboarding && onboarding.step !== "done"),
    paused: access.view.paused,
    status: access.view.status,
  });
  if (!pollsOpen || pingsReduced(access.record.openedAt, store.entries, now)) return;
  const slot = duePoll({ store, dateKey: clock.dateKey, hour: clock.hour });
  if (!slot) return;
  if (!(await claimDigestSlot(input.userId, clock.dateKey, slot))) return;
  const ok = await telegramRequest("sendMessage", {
    chat_id: input.chatId,
    text: pollText(slot, input.locale),
    reply_markup: feelingKeyboard(slot, input.locale),
  });
  if (!ok) await releaseDigestSlot(input.userId, clock.dateKey, slot);
}
