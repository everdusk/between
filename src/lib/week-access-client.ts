import { journalAuthHeaders } from "./journal-api";
import {
  DEFAULT_RUB_PRICE,
  type PremiumPlan,
  type WeekAccessView,
} from "./week-access";

function isView(value: unknown): value is WeekAccessView {
  if (!value || typeof value !== "object") return false;
  const status = (value as { status?: unknown }).status;
  return status === "new" || status === "trial" || status === "paid" || status === "locked";
}

async function readAccess(res: Response): Promise<WeekAccessView | null> {
  if (!res.ok) return null;
  const data = (await res.json()) as { ok?: boolean; access?: unknown };
  if (!data.ok || !isView(data.access)) return null;
  if (typeof data.access.rubPrice !== "number") data.access.rubPrice = DEFAULT_RUB_PRICE;
  return data.access;
}

export async function fetchWeekAccess(initData: string, maxInitData = ""): Promise<WeekAccessView | null> {
  try {
    const res = await fetch("/api/week-access", {
      method: "GET",
      headers: journalAuthHeaders(initData, maxInitData),
      cache: "no-store",
    });
    return await readAccess(res);
  } catch {
    return null;
  }
}

export async function postWeekAccess(
  initData: string,
  action: "open" | "seen",
): Promise<WeekAccessView | null> {
  try {
    const res = await fetch("/api/week-access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData,
      },
      body: JSON.stringify({ action }),
    });
    return await readAccess(res);
  } catch {
    return null;
  }
}

/** Browser session or signed MAX launch. The server owns the trial dates. */
export async function postSessionWeekAccess(
  action: "open" | "seen",
  maxInitData = "",
): Promise<WeekAccessView | null> {
  try {
    const res = await fetch("/api/week-access", {
      method: "POST",
      headers: journalAuthHeaders("", maxInitData, true),
      body: JSON.stringify({ action }),
    });
    return await readAccess(res);
  } catch {
    return null;
  }
}

export async function createWeekInvoice(
  initData: string,
  plan: PremiumPlan,
  locale: "en" | "ru",
): Promise<string | null> {
  try {
    const res = await fetch("/api/week-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData,
      },
      body: JSON.stringify({ plan, locale }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; url?: unknown };
    return data.ok && typeof data.url === "string" && data.url ? data.url : null;
  } catch {
    return null;
  }
}
