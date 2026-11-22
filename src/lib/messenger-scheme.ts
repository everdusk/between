export type Messenger = "telegram" | "max";
export type SchemeChoice = "day" | "night" | "client";
export const SCHEME_EVENT = "between-scheme";

const sessionChoice: Partial<Record<Messenger, SchemeChoice>> = {};

export function resolveMessengerChoice(host: Messenger, saved: string | null): SchemeChoice {
  if (saved === "client" || saved === "day" || saved === "night") return saved;
  return host === "telegram" ? "night" : "client";
}

export function messengerChoice(host: Messenger): SchemeChoice {
  if (sessionChoice[host]) return sessionChoice[host];
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(`between:scheme:${host}`);
  } catch { /* Storage can be disabled in a WebView. */ }
  return resolveMessengerChoice(host, saved);
}

export function chooseMessengerScheme(host: Messenger, choice: SchemeChoice) {
  sessionChoice[host] = choice;
  try { localStorage.setItem(`between:scheme:${host}`, choice); } catch { /* Session choice still works. */ }
  window.dispatchEvent(new Event(SCHEME_EVENT));
}
