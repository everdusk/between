export const GUEST_STORAGE_KEY = "between:guest-journal:v1";

/** Also runs before hydration, before the landing starts its analytics. */
export function hasGuestJournal(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const guest = JSON.parse(raw);
    return Array.isArray(guest?.introductions) && guest.introductions.length > 0;
  } catch {
    return false;
  }
}
