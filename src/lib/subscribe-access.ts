/**
 * The checkout is for someone who already has a journal.
 * A normal browser with no session leaves for the sign-in.
 * A messenger launch (MAX or Telegram) is already signed in, even without the site cookie.
 * This decision stays in the browser: a static page cannot read the session cookie.
 */
export function shouldLeaveSubscribe(input: {
  signedIn: boolean;
  hash: string;
  storedMax: string | null;
}): boolean {
  if (input.signedIn) return false;
  if (input.storedMax?.trim()) return false;
  const hash = input.hash;
  if (hash.includes("WebAppData=") || hash.includes("tgWebAppData=")) return false;
  return true;
}
