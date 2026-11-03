import { NextResponse } from "next/server";
import { accountReady, accountUnavailable } from "@/lib/account-http";
import { loadAccount, toPublicAccount } from "@/lib/web-account-store";
import { readSession, sessionSecret, sessionTokenFromRequest } from "@/lib/web-account";

export async function GET(req: Request) {
  if (!accountReady()) return accountUnavailable();
  const secret = sessionSecret();
  const token = sessionTokenFromRequest(req);
  const accountId = secret && token ? readSession(token, secret) : null;
  const account = accountId ? await loadAccount(accountId) : null;
  return NextResponse.json({
    ok: true,
    account: account ? toPublicAccount(account) : null,
  });
}
