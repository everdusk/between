const PENDING_KEY = "between:bot-intro-pending";

/** The permission window is for a Telegram open that has not allowed the bot to write. */
export function shouldShowBotChat(input: { inTelegram: boolean; allowsWriteToPm: boolean }): boolean {
  return input.inTelegram && !input.allowsWriteToPm;
}

export function botIntroPending(): boolean {
  try {
    return localStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markBotIntroPending(): void {
  try {
    localStorage.setItem(PENDING_KEY, "1");
  } catch {
    /* The server still dedups a successful hello. */
  }
}

export function clearBotIntroPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* A later open will try the hello again. */
  }
}
