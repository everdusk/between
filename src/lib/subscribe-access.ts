/**
 * The checkout is for someone who already has a journal.
 * A normal browser with no session leaves before the form is painted.
 * A messenger launch (MAX or Telegram) is already signed in, even without the site cookie.
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

/** Runs before React on a page the server already knows has no site session. */
export const SUBSCRIBE_LEAVE_SCRIPT = `try{var h=location.hash||"";var max="";try{max=sessionStorage.getItem("WebAppData")||""}catch(e){}if(!max&&h.indexOf("WebAppData=")<0&&h.indexOf("tgWebAppData=")<0)location.replace("/journal")}catch(e){}`;
