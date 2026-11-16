import { POLL_HOURS } from "./digest";
import type { TherapyStore } from "./types";
import type { WeekAccessStatus } from "./week-access";

export const SESSION_INVITE_SLOT = "session-invite-v1";
export const SESSION_INVITE_DAY = "onboarding";

/** One optional offer after a real note; never competes with scheduled mood questions. */
export function sessionInviteDue(input: {
  store: TherapyStore;
  now: Date;
  hour: number;
  status: WeekAccessStatus;
  paused: boolean;
}): boolean {
  const { store, now, hour, status, paused } = input;
  if (paused || (status !== "trial" && status !== "paid")) return false;
  if (store.notify.serviceReminders === false || store.sessionPlan) return false;
  if (hour < 9 || hour >= 22 || Object.values(POLL_HOURS).some((scheduled) => scheduled === hour)) return false;
  return store.entries.some((entry) => {
    if (entry.source === "checkin" || !entry.body.trim()) return false;
    const created = Date.parse(entry.createdAt);
    return Number.isFinite(created) && now.getTime() - created >= 24 * 60 * 60 * 1000;
  });
}
