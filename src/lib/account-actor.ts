import { validateMaxInitData } from "./max-auth";
import { validateInitData } from "./telegram-auth";
import { accountFromSession, ensureMaxAccount, resolveJournalId } from "./web-account-store";
import { maxStorageId, sessionSecret, sessionTokenFromRequest, webStorageId } from "./web-account";

export type Actor = {
  id: string;
  telegramUserId: number | null;
  telegramUsername: string | null;
  messenger: "telegram" | "max" | "web";
  analyticsId: number | string;
};

/**
 * Whose journal a request is asking for.
 * The MAX launch string names the person in the chat. A leftover website cookie must not win.
 */
export function leadingCredential(input: {
  maxInitData?: string | null;
  telegramInitData?: string | null;
  session?: boolean;
}): "max" | "telegram" | "session" | null {
  if (input.maxInitData?.trim()) return "max";
  if (input.telegramInitData?.trim()) return "telegram";
  if (input.session) return "session";
  return null;
}

/** Who may read the journal: the MAX chat, a Telegram user, or a browser session. */
export async function actorFromRequest(req: Request): Promise<Actor | null> {
  const maxInit = req.headers.get("x-max-init-data");
  const initData = req.headers.get("x-telegram-init-data");
  const secret = sessionSecret();
  const token = secret ? sessionTokenFromRequest(req) : null;
  const kind = leadingCredential({
    maxInitData: maxInit,
    telegramInitData: initData,
    session: Boolean(token),
  });

  if (kind === "max" && maxInit) {
    const validated = validateMaxInitData(maxInit, process.env.MAX_BOT_TOKEN);
    if (validated) {
      const account = await ensureMaxAccount(validated.user.id, validated.user.username);
      if (account) {
        return {
          id: webStorageId(account.id),
          telegramUserId: account.telegramUserId,
          telegramUsername: account.telegramUsername,
          messenger: "max",
          analyticsId: validated.user.id,
        };
      }
      return {
        id: maxStorageId(validated.user.id),
        telegramUserId: null,
        telegramUsername: null,
        messenger: "max",
        analyticsId: validated.user.id,
      };
    }
  }

  if (initData) {
    const validated = validateInitData(initData);
    if (validated) {
      return {
        id: await resolveJournalId(validated.user.id),
        telegramUserId: validated.user.id,
        telegramUsername: validated.user.username?.replace(/^@/, "") || null,
        messenger: "telegram",
        analyticsId: validated.user.id,
      };
    }
  }

  if (!secret || !token) return null;
  const account = await accountFromSession(token, secret);
  if (!account) return null;
  return {
    id: webStorageId(account.id),
    telegramUserId: account.telegramUserId,
    telegramUsername: account.telegramUsername,
    messenger: "web",
    analyticsId: webStorageId(account.id),
  };
}
