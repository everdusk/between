import { loadUserStore, redisConfigured } from "./redis";

/** True when the journal has no session date yet. A missing store counts as unset. */
export async function sessionDateMissing(owner: string): Promise<boolean> {
  if (!redisConfigured()) return false;
  try {
    const store = await loadUserStore(owner);
    return store.sessionPlan == null;
  } catch {
    return false;
  }
}
