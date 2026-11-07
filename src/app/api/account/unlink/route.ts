import { NextResponse } from "next/server";
import { accountReady, accountUnavailable } from "@/lib/account-http";
import { readSession, sessionSecret, sessionTokenFromRequest } from "@/lib/web-account";
import { loadAccount, toPublicAccount, unlinkMessenger } from "@/lib/web-account-store";

/** Drop Telegram or MAX from the signed-in journal. */
export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  const secret = sessionSecret();
  const token = sessionTokenFromRequest(req);
  const accountId = secret && token ? readSession(token, secret) : null;
  const account = accountId ? await loadAccount(accountId) : null;
  if (!account) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const which = (body as { messenger?: unknown }).messenger;
  if (which !== "telegram" && which !== "max") {
    return NextResponse.json({ ok: false, error: "bad_messenger" }, { status: 400 });
  }
  const next = await unlinkMessenger(account.id, which);
  if (!next) return accountUnavailable();
  return NextResponse.json({ ok: true, account: toPublicAccount(next) });
}
