/**
 * What the open journal should show after /api/account answers.
 * A late or empty poll keeps the account already on screen.
 * Signing out goes through the account setter and does not come through here.
 */
export function keptAccount<T>(current: T | null, incoming: T | null, fresh: boolean): T | null {
  if (!fresh) return current ?? incoming;
  return incoming ?? current;
}
