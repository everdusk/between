import { validateInitData } from "./telegram-auth";
import { loadAccount, resolveJournalId } from "./web-account-store";
import { readSession, sessionSecret, sessionTokenFromRequest, webStorageId } from "./web-account";

export type Actor = {
  id: string;
  telegramUserId: number | null;
  telegramUsername: string | null;
};

/** Who may read the journal: a Telegram user, or a browser session. */
export async function actorFromRequest(req: Request): Promise<Actor | null> {
  const initData = req.headers.get("x-telegram-init-data");
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

  const secret = sessionSecret();
  const token = sessionTokenFromRequest(req);
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
