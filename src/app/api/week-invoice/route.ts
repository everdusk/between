import { NextResponse } from "next/server";
import { telegramCall } from "@/lib/telegram-bot";
import { validateInitData } from "@/lib/telegram-auth";
import {
  SUBSCRIPTION_PERIOD_SEC,
  WEEK_INVOICE_PAYLOAD,
  starPriceFromEnv,
} from "@/lib/week-access";

export async function POST(req: Request) {
  const token = process.env.BOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
  }
  const initData = req.headers.get("x-telegram-init-data");
  if (!initData) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const validated = validateInitData(initData);
  if (!validated) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const starPrice = starPriceFromEnv(process.env.WEEK_STAR_PRICE);
  const created = await telegramCall<string>("createInvoiceLink", {
    title: "Between · Неделя",
    description: "Спектр недели и бриф к сеансу. Подписка на 30 дней, продлевается сама.",
    payload: WEEK_INVOICE_PAYLOAD,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: "Неделя", amount: starPrice }],
    subscription_period: SUBSCRIPTION_PERIOD_SEC,
  });

  if (!created.ok || !created.result) {
    return NextResponse.json(
      { ok: false, error: created.ok ? "no_link" : created.description },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    url: created.result,
    starPrice,
    userId: validated.user.id,
  });
}
