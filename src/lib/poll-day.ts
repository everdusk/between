import { pollChatQuiet, analyticsQuiet } from "./analytics-model";
import {
  DIGEST_BATCH,
  MOOD_SLOTS,
  digestChannel,
  formatPollDay,
  hasCheckin,
  maxUserIdFromDigest,
  moodPollsOpen,
  tallyPollDay,
  type PollPerson,
} from "./digest";
import { loadOnboarding } from "./onboarding-flow";
import {
  digestSlotHeld,
  getUserTimezone,
  listBlockedBots,
  listStatsQuiet,
  listUserIds,
  loadDigestRun,
  loadUserStore,
  loadWeekAccess,
  rememberStatsQuiet,
} from "./redis";
import { pingsReduced } from "./trial-cycle";
import { accountIdForTelegram, loadAccount, resolveJournalId, resolveMaxJournalId } from "./web-account-store";
import { accessForUser } from "./week-access";
import { zonedParts } from "./zoned";

/** The digest opens a trial the first time it sees the account. The report counts that person too. */
function statusAfterOpen(openedAt: string | null, status: string): string {
  return !openedAt && status === "new" ? "trial" : status;
}

/** The stats owner is one person in two chats. Remember the chat so the next report can drop it. */
export async function rememberQuietChat(
  userId: number,
  username: string | undefined,
  messenger: "telegram" | "max",
): Promise<void> {
  if (!analyticsQuiet({ userId, username, messenger, owners: process.env.ANALYTICS_OWNERS })) return;
  await rememberStatsQuiet(messenger === "max" ? `max:${userId}` : String(userId));
}

async function quietChat(userId: string, quiet: Set<string>): Promise<boolean> {
  if (quiet.has(userId) || pollChatQuiet(userId)) return true;
  if (!/^\d+$/.test(userId)) return false;
  const accountId = await accountIdForTelegram(Number(userId));
  if (!accountId) return false;
  const account = await loadAccount(accountId);
  return pollChatQuiet(userId, account?.telegramUsername);
}

async function readPerson(userId: string, now: Date, blocked: Set<string>, quiet: Set<string>): Promise<PollPerson | null> {
  const channel = digestChannel(userId);
  if (!channel || blocked.has(userId) || (await quietChat(userId, quiet))) return null;
  const maxId = channel === "max" ? maxUserIdFromDigest(userId) : null;
  if (channel === "max" && !maxId) return null;
  const owner =
    channel === "max" && maxId ? await resolveMaxJournalId(maxId) : await resolveJournalId(Number(userId));
  const [timeZone, store, record, onboarding] = await Promise.all([
    getUserTimezone(owner),
    loadUserStore(owner),
    loadWeekAccess(owner),
    loadOnboarding(owner),
  ]);
  const clock = zonedParts(now, timeZone);
  const actorId = channel === "max" ? 0 : Number(userId);
  const access = accessForUser(record, { id: actorId }, process.env.WEEK_EXEMPT_USER_IDS, now);
  const sent = await Promise.all(MOOD_SLOTS.map((slot) => digestSlotHeld(userId, clock.dateKey, slot)));
  return {
    blocked: false,
    moodPolls: store.notify.moodPolls,
    pollsOpen: moodPollsOpen({
      onboardingOpen: Boolean(onboarding && onboarding.step !== "done"),
      paused: access.view.paused,
      status: statusAfterOpen(access.record.openedAt, access.view.status),
    }),
    reduced: pingsReduced(access.record.openedAt, store.entries, now),
    hour: clock.hour,
    slots: MOOD_SLOTS.map((slot, index) => ({
      slot,
      sent: sent[index] === true,
      answered: hasCheckin(store, clock.dateKey, slot),
    })),
  };
}

/** Who should have today's poll, who has it, and who answered. Each chat uses its own clock. */
export async function loadPollDay(now = new Date()): Promise<string> {
  const [userIds, blocked, quiet, run] = await Promise.all([
    listUserIds(),
    listBlockedBots(),
    listStatsQuiet(),
    loadDigestRun(),
  ]);
  const people: PollPerson[] = [];
  for (let index = 0; index < userIds.length; index += DIGEST_BATCH) {
    const batch = userIds.slice(index, index + DIGEST_BATCH);
    const rows = await Promise.all(
      batch.map((userId) => readPerson(userId, now, blocked, quiet).catch(() => null)),
    );
    for (const row of rows) {
      if (row) people.push(row);
    }
  }
  return formatPollDay(tallyPollDay(people), run, now);
}
