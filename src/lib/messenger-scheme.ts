export type Messenger = "telegram" | "max";
export type SchemeChoice = "day" | "night" | "client";
export const SCHEME_EVENT = "between-scheme";

const sessionChoice: Partial<Record<Messenger, SchemeChoice>> = {};

export function messengerChoice(host: Messenger): SchemeChoice {
  if (sessionChoice[host]) return sessionChoice[host];
  try {
    const saved = localStorage.getItem(`between:scheme:${host}`);
    if (saved === "day" || saved === "night") return saved;
  } catch { /* Storage can be disabled in a WebView. */ }
  return "client";
}

export function chooseMessengerScheme(host: Messenger, choice: SchemeChoice) {
  sessionChoice[host] = choice;
  try { localStorage.setItem(`between:scheme:${host}`, choice); } catch { /* Session choice still works. */ }
  window.dispatchEvent(new Event(SCHEME_EVENT));
}
