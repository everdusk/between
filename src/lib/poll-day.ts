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
  listUserIds,
  loadDigestRun,
  loadUserStore,
  loadWeekAccess,
} from "./redis";
import { pingsReduced } from "./trial-cycle";
import { messengerUsername } from "./due-mood";
import { resolveJournalId, resolveMaxJournalId } from "./web-account-store";
import { accessForUser, maxAccessIdentity } from "./week-access";
import { zonedParts } from "./zoned";

/** The digest opens a trial the first time it sees the account. The report counts that person too. */
function statusAfterOpen(openedAt: string | null, status: string): string {
  return !openedAt && status === "new" ? "trial" : status;
}

async function readPerson(userId: string, now: Date, blocked: Set<string>): Promise<PollPerson | null> {
  const channel = digestChannel(userId);
  if (!channel || blocked.has(userId)) return null;
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
  const username = await messengerUsername(userId, channel);
  const access = accessForUser(
    record,
    channel === "max" && maxId ? maxAccessIdentity(maxId, username) : { id: Number(userId), username },
    process.env.WEEK_EXEMPT_USER_IDS,
    now,
  );
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
  const [userIds, blocked, run] = await Promise.all([listUserIds(), listBlockedBots(), loadDigestRun()]);
  const people: PollPerson[] = [];
  for (let index = 0; index < userIds.length; index += DIGEST_BATCH) {
    const batch = userIds.slice(index, index + DIGEST_BATCH);
    const rows = await Promise.all(
      batch.map((userId) => readPerson(userId, now, blocked).catch(() => null)),
    );
    for (const row of rows) {
      if (row) people.push(row);
    }
  }
  return formatPollDay(tallyPollDay(people), run, now);
}
