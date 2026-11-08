import { NextResponse } from "next/server";
import { actorFromRequest } from "@/lib/account-actor";
import { feedbackLetter, mailConfigFromEnv, sendFeedbackMail, type FeedbackIdentity } from "@/lib/otp-mail";
import { loadAccount } from "@/lib/web-account-store";

const HELP = "help@between-journal.ru";

function cleanMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const message = value.replace(/\r\n/g, "\n").replace(/[^\S\n]+/g, " ").trim();
  if (message.length < 2 || message.length > 2000) return null;
  return message;
}

/** A note from the journal, sent from the same mailbox as the sign-in codes. */
export async function POST(req: Request) {
  if (!mailConfigFromEnv()) {
    return NextResponse.json({ ok: false, error: "mail_off" }, { status: 503 });
  }
  const actor = await actorFromRequest(req);
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const message = cleanMessage((body as { message?: unknown }).message);
  if (!message) return NextResponse.json({ ok: false, error: "bad_message" }, { status: 400 });

  const accountId = actor.id.startsWith("web:") ? actor.id.slice(4) : null;
  const account = accountId ? await loadAccount(accountId) : null;
  const platform: FeedbackIdentity["platform"] =
    actor.messenger === "telegram" ? "Telegram" : actor.messenger === "max" ? "MAX" : "сайт";
  const maxUserId =
    account?.maxUserId ?? (actor.messenger === "max" && typeof actor.analyticsId === "number" ? actor.analyticsId : null);
  const letter = feedbackLetter(
    {
      platform,
      journalId: actor.id,
      telegramUserId: account?.telegramUserId ?? actor.telegramUserId,
      telegramUsername: account?.telegramUsername ?? actor.telegramUsername,
      maxUserId,
      email: account?.email ?? null,
    },
    message,
  );
  try {
    const sent = await sendFeedbackMail(HELP, letter);
    if (!sent) return NextResponse.json({ ok: false, error: "mail_off" }, { status: 503 });
  } catch {
    return NextResponse.json({ ok: false, error: "mail_fail" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
