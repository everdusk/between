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

const INVOICE: Record<PremiumPlan, { title: string; description: string; label: string }> = {
  month: {
    title: "Between · Неделя",
    description: "Спектр недели и бриф к сеансу. Подписка на 30 дней, продлевается сама.",
    label: "30 дней",
  },
  quarter: {
    title: "Between · 3 месяца",
    description: "Спектр недели и бриф к сеансу на 90 дней. Скидка 20%.",
    label: "3 месяца",
  },
  year: {
    title: "Between · Год",
    description: "Спектр недели и бриф к сеансу на 365 дней. Скидка 50%.",
    label: "Год",
  },
};

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
  try {
    const body = (await req.json()) as { plan?: unknown };
    plan = readPlan(body?.plan);
  } catch {
    plan = "month";
  }

  const monthly = starPriceFromEnv(process.env.WEEK_STAR_PRICE);
  const amount = planPrice(monthly, plan);
  const copy = INVOICE[plan];
  const created = await telegramCall<string>("createInvoiceLink", {
    title: copy.title,
    description: copy.description,
    payload: WEEK_PLAN_PAYLOAD[plan],
    provider_token: "",
    currency: "XTR",
    prices: [{ label: copy.label, amount }],
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
