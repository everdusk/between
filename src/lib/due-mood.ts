import type { CheckinSlot } from "./types";
import type { LocaleId } from "./i18n";
import { duePoll, moodPollsOpen, pollText } from "./digest";
import { maxFeelingKeyboard, sendMaxMessage } from "./max-bot";
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
import { pingsReduced, quietHour } from "./trial-cycle";
import { maxStorageId } from "./web-account";
import { accountIdForMax, accountIdForTelegram, loadAccount, resolveMaxJournalId } from "./web-account-store";
import { accessForUser, maxAccessIdentity, type WeekAccessIdentity } from "./week-access";
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

/** Latest unanswered mood question that the hourly run would still send. */
async function openDueSlot(
  owner: string,
  identity: WeekAccessIdentity,
): Promise<{ slot: CheckinSlot; dateKey: string } | null> {
  const now = new Date();
  const timeZone = await getUserTimezone(owner);
  const clock = zonedParts(now, timeZone);
  if (quietHour(clock.hour)) return null;
  const store = await loadUserStore(owner);
  const access = accessForUser(
    await loadWeekAccess(owner),
    identity,
    process.env.WEEK_EXEMPT_USER_IDS,
    now,
  );
  const onboarding = await loadOnboarding(owner);
  const pollsOpen = moodPollsOpen({
    onboardingOpen: Boolean(onboarding && onboarding.step !== "done"),
    paused: access.view.paused,
    status: access.view.status,
  });
  if (!pollsOpen || pingsReduced(access.record.openedAt, store.entries, now)) return null;
  const slot = duePoll({ store, dateKey: clock.dateKey, hour: clock.hour });
  if (!slot) return null;
  return { slot, dateKey: clock.dateKey };
}

/** Today's unanswered mood question, when the MAX chat is opened. A note does not ask again. */
export async function sendDueMaxPoll(input: {
  userId: number;
  username?: string;
  locale: LocaleId;
  chatId?: number;
}): Promise<void> {
  const storageId = maxStorageId(input.userId);
  const spoken = input.username?.trim().replace(/^@/, "");
  if (spoken) await rememberMessengerName(storageId, spoken);
  const owner = await resolveMaxJournalId(input.userId);
  const username = spoken || (await messengerUsername(storageId, "max"));
  const due = await openDueSlot(owner, maxAccessIdentity(input.userId, username));
  if (!due) return;
  if (!(await claimDigestSlot(storageId, due.dateKey, due.slot))) return;
  const ok = await sendMaxMessage(
    input.userId,
    pollText(due.slot, input.locale),
    maxFeelingKeyboard(due.slot, input.locale),
    input.chatId,
  );
  if (!ok) await releaseDigestSlot(storageId, due.dateKey, due.slot);
}
