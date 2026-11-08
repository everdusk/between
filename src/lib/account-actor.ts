import { validateMaxInitData } from "./max-auth";
import { validateInitData } from "./telegram-auth";
import { ensureMaxAccount, loadAccount, resolveJournalId } from "./web-account-store";
import { maxStorageId, readSession, sessionSecret, sessionTokenFromRequest, webStorageId } from "./web-account";

export type Actor = {
  id: string;
  telegramUserId: number | null;
  telegramUsername: string | null;
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
        };
      }
      return {
        id: maxStorageId(validated.user.id),
        telegramUserId: null,
        telegramUsername: null,
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
      };
    }
  }

  if (!secret || !token) return null;
  const accountId = readSession(token, secret);
  if (!accountId) return null;
  const account = await loadAccount(accountId);
  if (!account) return null;
  return {
    id: webStorageId(account.id),
    telegramUserId: account.telegramUserId,
    telegramUsername: account.telegramUsername,
  };
}
