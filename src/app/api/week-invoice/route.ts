import { NextResponse } from "next/server";
import { telegramCall } from "@/lib/telegram-bot";
import { validateInitData } from "@/lib/telegram-auth";
import {
  SUBSCRIPTION_PERIOD_SEC,
  WEEK_PLAN_PAYLOAD,
  planPrice,
  starPriceFromEnv,
  type PremiumPlan,
} from "@/lib/week-access";

import { translate } from "@/lib/messages";

function readPlan(raw: unknown): PremiumPlan {
  if (raw === "quarter" || raw === "year" || raw === "month") return raw;
  return "month";
}

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

  let plan: PremiumPlan = "month";
  let locale: "en" | "ru" = /^en(?:-|$)/i.test(validated.user.language_code ?? "") ? "en" : "ru";
  try {
    const body = (await req.json()) as { plan?: unknown; locale?: unknown };
    if (body?.locale === "en" || body?.locale === "ru") locale = body.locale;
    plan = readPlan(body?.plan);
  } catch {
    plan = "month";
  }

  const monthly = starPriceFromEnv(process.env.WEEK_STAR_PRICE);
  const amount = planPrice(monthly, plan);
  const label = translate(locale, plan === "month" ? "payStars" : plan === "quarter" ? "payQuarter" : "payYear", { price: amount });
  const created = await telegramCall<string>("createInvoiceLink", {
    title: "Between",
    description: label + ". " + translate(locale, plan === "month" ? "starsRenewal" : "starsOnce"),
    payload: WEEK_PLAN_PAYLOAD[plan],
    provider_token: "",
    currency: "XTR",
    prices: [{ label, amount }],
    ...(plan === "month" ? { subscription_period: SUBSCRIPTION_PERIOD_SEC } : {}),
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
    starPrice: amount,
    plan,
    userId: validated.user.id,
  });
}
