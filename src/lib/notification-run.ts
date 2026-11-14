import { claimDigestSlot, releaseDigestSlot } from "./redis";

/** One scheduled message per journal per local hour, including concurrent cron and webhook runs. */
export async function withNotificationRun<T extends { sent: number }>(
  owner: string, dateKey: string, hour: number, dispatch: () => Promise<T>,
  claims = { claim: claimDigestSlot, release: releaseDigestSlot },
): Promise<T | null> {
  const slot = `notification-hour:${hour}`;
  if (!await claims.claim(owner, dateKey, slot)) return null;
  // Keep an uncertain delivery claimed if dispatch throws after the provider accepted it.
  const result = await dispatch();
  if (!result.sent) await claims.release(owner, dateKey, slot);
  return result;
}
