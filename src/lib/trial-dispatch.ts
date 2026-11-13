import { formatLongDate } from "./dates";
import type { LocaleId } from "./i18n";
import { translate } from "./messages";
import { subscribeOpenKeyboard, sendMaxDocument, sendMaxMessage, weekOpenKeyboard as maxWeekKeyboard } from "./max-bot";
import { periodBrief } from "./period-brief";
import { claimDigestSlot, releaseDigestSlot, saveWeekAccess } from "./redis";
import { renderSessionPdf } from "./session-pdf";
import { prepareSessionSheet, rememberSessionSheet } from "./session-sheet";
import { appUrl } from "./telegram-auth";
import { sendTelegramDocument, subscribeKeyboard, telegramRequest, weekOpenKeyboard } from "./telegram-bot";
import { dueCycle, type CycleItem } from "./trial-cycle";
import type { SessionPlan, TherapyStore } from "./types";
import { planPrice, rubPriceFromEnv, stampCycle, starPriceFromEnv, type CycleStamp, type WeekAccessRecord, type WeekAccessStatus } from "./week-access";

const STAMP: Partial<Record<CycleItem["kind"], CycleStamp>> = {
  slice: "sliceAt",
  paywall: "paywallAt",
  day5: "day5At",
  nudge1: "nudge1At",
  nudge2: "nudge2At",
  "renew-soon": "renewSoonAt",
  "renew-last": "renewLastAt",
  expired: "expiredNoticeAt",
};

function monthPrice(): string {
  const stars = planPrice(starPriceFromEnv(process.env.WEEK_STAR_PRICE), "month");
  const rub = planPrice(rubPriceFromEnv(process.env.WEEK_RUB_PRICE), "month");
  return `${stars} Stars / ${rub} ₽`;
}

function dated(locale: LocaleId, key: string | undefined): string {
  return key ? formatLongDate(key, locale) : "";
}

export function cycleText(
  item: CycleItem,
  locale: LocaleId,
  store: TherapyStore,
  dateKey: string,
  now: Date,
  trialHint: boolean,
): string {
  const brief = () => periodBrief(store, locale, dateKey, now);
  const price = monthPrice();
  if (item.kind === "digest-full") {
    const lead = translate(locale, "botDigestFull", { time: item.time ?? "" });
    return trialHint ? `${lead}\n${translate(locale, "botDigestHint")}` : lead;
  }
  if (item.kind === "digest-mini") {
    const snap = brief();
    const lead = translate(locale, "botDigestMini", { time: item.time ?? "", ...snap });
    return trialHint ? `${lead}\n${translate(locale, "botDigestHint")}` : lead;
  }
  if (item.kind === "slice") {
    const snap = brief();
    return translate(locale, "botSlice", snap);
  }
  if (item.kind === "day5") return translate(locale, "botDay5", { date: dated(locale, item.when), price });
  if (item.kind === "paywall") {
    const key = item.variant === "ahead" ? "botPaywallAhead" : item.variant === "had" ? "botPaywallHad" : "botPaywallNone";
    return translate(locale, key, { date: dated(locale, item.when), price });
  }
  if (item.kind === "nudge1") {
    return item.when
      ? translate(locale, "botNudgePay", { date: dated(locale, item.when) })
      : translate(locale, "botNudgePayPlain");
  }
  if (item.kind === "nudge2") return translate(locale, "botNudgeSession");
  if (item.kind === "renew-soon") return translate(locale, "botRenewSoon", { date: dated(locale, item.when) });
  if (item.kind === "renew-last") return translate(locale, "botRenewLast", { date: dated(locale, item.when) });
  if (item.kind === "expired") return translate(locale, "botExpired");
  if (item.kind === "session-ask") return translate(locale, "botSessionAsk", { days: item.days ?? "" });
  return translate(locale, "botMidpoint");
}

async function deliverText(input: {
  channel: "telegram" | "max";
  userId: string;
  maxId: number | null;
  text: string;
  markup: unknown;
}): Promise<boolean> {
  if (input.channel === "max" && input.maxId) {
    return sendMaxMessage(input.maxId, input.text, input.markup as never);
  }
  return telegramRequest("sendMessage", {
    chat_id: Number(input.userId),
    text: input.text,
    ...(input.markup ? { reply_markup: input.markup } : {}),
  });
}

function markupFor(item: CycleItem, channel: "telegram" | "max", locale: LocaleId): unknown {
  const url = appUrl();
  const later = item.kind === "paywall" || item.kind === "nudge1";
  const pay = item.kind === "paywall" || item.kind === "nudge1" || item.kind === "nudge2" || item.kind.startsWith("renew") || item.kind === "expired" || item.kind === "day5";
  if (channel === "max") {
    if (pay) return subscribeOpenKeyboard(locale, later) ?? undefined;
    if (item.kind === "digest-full" || item.kind === "digest-mini" || item.kind === "slice") return maxWeekKeyboard(locale) ?? undefined;
    return undefined;
  }
  if (pay) return subscribeKeyboard(url, locale, later);
  if (item.kind === "digest-full" || item.kind === "digest-mini" || item.kind === "slice") return weekOpenKeyboard(url, locale);
  return undefined;
}

async function deliverFile(input: {
  channel: "telegram" | "max";
  userId: string;
  maxId: number | null;
  owner: string;
  store: TherapyStore;
  locale: LocaleId;
  dateKey: string;
  now: Date;
  caption: string;
  markup: unknown;
}): Promise<boolean> {
  const sheet = await prepareSessionSheet(input.store, input.locale, input.dateKey, input.now, input.owner);
  await rememberSessionSheet(input.owner, sheet, input.now);
  const pdf = await renderSessionPdf(input.store, input.locale, input.dateKey, input.now, sheet);
  if (input.channel === "max" && input.maxId) {
    return sendMaxDocument(input.maxId, pdf.filename, pdf.bytes, input.caption, input.markup as never);
  }
  return sendTelegramDocument(Number(input.userId), pdf.filename, pdf.bytes, input.caption, input.markup);
}

/** Sends the session file, the day-7 slice, paywall, nudges and renewal notes that are due. */
export async function deliverCycle(input: {
  channel: "telegram" | "max";
  userId: string;
  owner: string;
  maxId: number | null;
  record: WeekAccessRecord;
  status: WeekAccessStatus;
  store: TherapyStore;
  plan: SessionPlan | null | undefined;
  dateKey: string;
  hour: number;
  now: Date;
  timeZone: string;
  locale: LocaleId;
  onboardingOpen: boolean;
}): Promise<number> {
  const items = dueCycle({
    record: input.record,
    status: input.status,
    plan: input.plan,
    dateKey: input.dateKey,
    hour: input.hour,
    now: input.now,
    timeZone: input.timeZone,
    onboardingOpen: input.onboardingOpen,
  });
  let sent = 0;
  let record = input.record;
  for (const item of items) {
    if (item.slot) {
      const claimed = await claimDigestSlot(input.userId, input.dateKey, item.slot);
      if (!claimed) continue;
    }
    const text = cycleText(item, input.locale, input.store, input.dateKey, input.now, input.status === "trial");
    const markup = markupFor(item, input.channel, input.locale);
    let ok = false;
    try {
      if (item.kind === "digest-full" || item.kind === "slice") {
        ok = await deliverFile({ ...input, caption: text, markup });
        if (!ok) ok = await deliverText({ ...input, text, markup });
      } else {
        ok = await deliverText({ ...input, text, markup });
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      if (item.slot) await releaseDigestSlot(input.userId, input.dateKey, item.slot);
      continue;
    }
    sent += 1;
    const field = STAMP[item.kind];
    if (field) {
      record = stampCycle(record, field, input.now);
      await saveWeekAccess(input.owner, record);
    }
  }
  return sent;
}
