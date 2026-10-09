import {
  describeWeekAccess,
  normalizeWeekAccess,
  type WeekAccessRecord,
  type WeekAccessView,
} from "./week-access";

const LOCAL_KEY = "between:week-access";

export function readLocalWeekAccess(): WeekAccessRecord {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return { openedAt: null, paidUntil: null, introSeen: false };
    return normalizeWeekAccess(JSON.parse(raw));
  } catch {
    return { openedAt: null, paidUntil: null, introSeen: false };
  }
}

export function writeLocalWeekAccess(record: WeekAccessRecord): void {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(normalizeWeekAccess(record)));
}

export function localWeekView(record: WeekAccessRecord, now = new Date()): WeekAccessView {
  return describeWeekAccess(record, now);
}

function isView(value: unknown): value is WeekAccessView {
  if (!value || typeof value !== "object") return false;
  const status = (value as { status?: unknown }).status;
  return status === "new" || status === "trial" || status === "paid" || status === "locked";
}

async function readAccess(res: Response): Promise<WeekAccessView | null> {
  if (!res.ok) return null;
  const data = (await res.json()) as { ok?: boolean; access?: unknown };
  if (!data.ok || !isView(data.access)) return null;
  return data.access;
}

export async function fetchWeekAccess(initData: string): Promise<WeekAccessView | null> {
  try {
    const res = await fetch("/api/week-access", {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
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

export async function createWeekInvoice(initData: string): Promise<string | null> {
  try {
    const res = await fetch("/api/week-invoice", {
      method: "POST",
      headers: { "X-Telegram-Init-Data": initData },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; url?: unknown };
    return data.ok && typeof data.url === "string" && data.url ? data.url : null;
  } catch {
    return null;
  }
}
