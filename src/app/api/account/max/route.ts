import { NextResponse } from "next/server";
import { accountReady, accountUnavailable, withSession } from "@/lib/account-http";
import { validateMaxInitData } from "@/lib/max-auth";
import { loginTokenFromStart } from "@/lib/web-account";
import { ensureMaxAccount, finishMaxLogin, toPublicAccount } from "@/lib/web-account-store";

/** Sign in from inside MAX. The launch string is checked with MAX_BOT_TOKEN. */
export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const initData = (body as { initData?: unknown }).initData;
  if (typeof initData !== "string") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const validated = validateMaxInitData(initData, process.env.MAX_BOT_TOKEN);
  if (!validated) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const loginToken = validated.startParam ? loginTokenFromStart(validated.startParam) : null;
  const finished = loginToken
    ? await finishMaxLogin(loginToken, validated.user.id, validated.user.username)
    : null;
  const account = finished ?? (await ensureMaxAccount(validated.user.id, validated.user.username));
  if (!account) return accountUnavailable();
  return withSession(
    NextResponse.json({ ok: true, account: toPublicAccount(account) }),
    account.id,
  );
}
