import { NextResponse } from "next/server";
import { accountReady, accountUnavailable } from "@/lib/account-http";
import { passwordProblem, readSession, sessionSecret, sessionTokenFromRequest } from "@/lib/web-account";
import { changeAccountPassword, toPublicAccount } from "@/lib/web-account-store";

/** Signed-in email account replaces its password. The current one is checked, never logged. */
export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  const secret = sessionSecret();
  const token = sessionTokenFromRequest(req);
  const accountId = secret && token ? readSession(token, secret) : null;
  if (!accountId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const payload = body as { current?: unknown; next?: unknown };
  if (typeof payload.current !== "string" || payload.current.length === 0) {
    return NextResponse.json({ ok: false, error: "bad_password" }, { status: 401 });
  }
  if (passwordProblem(payload.next)) {
    return NextResponse.json({ ok: false, error: "short_password" }, { status: 400 });
  }
  const account = await changeAccountPassword(accountId, payload.current, payload.next as string);
  if (account === null) return accountUnavailable();
  if (account === "bad") return NextResponse.json({ ok: false, error: "bad_password" }, { status: 401 });
  return NextResponse.json({ ok: true, account: toPublicAccount(account) });
}
