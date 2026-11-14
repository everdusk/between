import { formatLongDate } from "./dates";
import type { LocaleId } from "./i18n";
import { translate } from "./messages";
import { subscribeOpenKeyboard, sendMaxDocument, sendMaxMessage, weekOpenKeyboard as maxWeekKeyboard } from "./max-bot";
import { periodBrief } from "./period-brief";
import { claimDigestSlot, releaseDigestSlot, stampWeekAccess } from "./redis";
import { notificationChoiceRows } from "./notification-preferences";
import { maxOnboardKeyboard } from "./max-bot";
import { onboardReplyMarkup } from "./telegram-bot";
import { renderSessionPdf } from "./session-pdf";
import { prepareSessionSheet, rememberSessionSheet } from "./session-sheet";
import { appUrl } from "./telegram-auth";
import { sendTelegramDocument, subscribeKeyboard, telegramRequest, weekOpenKeyboard } from "./telegram-bot";
import { dueCycle, pingsReduced, type CycleItem } from "./trial-cycle";
import type { SessionPlan, TherapyStore } from "./types";
import { planPrice, rubPriceFromEnv, starPriceFromEnv, type CycleStamp, type WeekAccessRecord, type WeekAccessStatus } from "./week-access";

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
    const lead = translate(locale, "botDigestFull", { time: item.time ?? "", date: dated(locale, item.when ?? dateKey) });
    return trialHint ? `${lead}\n${translate(locale, "botDigestHint")}` : lead;
  }
  if (item.kind === "digest-mini") {
    const snap = brief();
    const lead = translate(locale, "botDigestMini", { time: item.time ?? "", date: dated(locale, item.when ?? dateKey), ...snap });
    return trialHint ? `${lead}\n${translate(locale, "botDigestHint")}` : lead;
  }
  if (item.kind === "slice") {
    const snap = brief();
    const slice = translate(locale, "botSlice", snap);
    return item.includePaywall ? `${slice}\n\n${cycleText({ ...item, kind: "paywall" }, locale, store, dateKey, now, trialHint)}` : slice;
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
  if (item.kind === "quiet-offer") return translate(locale, "botQuietOffer");
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
  if (item.kind === "quiet-offer") return channel === "max" ? maxOnboardKeyboard(notificationChoiceRows(locale)) : onboardReplyMarkup(notificationChoiceRows(locale));
  const url = appUrl();
  const later = item.kind === "paywall" || item.kind === "nudge1";
  const pay = item.includePaywall || item.kind === "paywall" || item.kind === "nudge1" || item.kind === "nudge2" || item.kind.startsWith("renew") || item.kind === "expired" || item.kind === "day5";
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
  const reduced = pingsReduced(input.record.openedAt, input.store.entries, input.now, input.store.notify.updatedAt);
  const items = input.store.notify.serviceReminders === false ? [] : dueCycle({
    record: input.record,
    status: input.status,
    plan: input.plan,
    dateKey: input.dateKey,
    hour: input.hour,
    now: input.now,
    timeZone: input.timeZone,
    onboardingOpen: input.onboardingOpen,
    engaged: input.store.entries.length > 0,
  }).filter((item) => !reduced || (item.kind !== "session-ask" && item.kind !== "midpoint"));
  if (!items.length && !input.onboardingOpen && reduced && input.hour === 18 && (input.store.notify.moodPolls || input.store.notify.eveningNudge)) {
    const latest = input.store.entries.map((entry) => entry.createdAt).sort().at(-1) ?? input.record.openedAt;
    items.push({ kind: "quiet-offer", slot: `inactive:${latest}:${input.store.notify.updatedAt ?? ""}` });
  }
  let sent = 0;
  for (const item of items) {
    const slot = item.slot ?? `cycle:${item.kind}:${item.kind.startsWith("renew") || item.kind === "expired" ? input.record.paidUntil : input.record.openedAt}`;
    const claimDay = item.slot?.startsWith("session:") ? "session" : item.kind === "quiet-offer" || !item.slot ? "cycle" : input.dateKey;
    if (!await claimDigestSlot(input.owner, claimDay, slot, 365 * 86400)) continue;
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
      await releaseDigestSlot(input.owner, claimDay, slot);
      continue;
    }
    sent += 1;
    const field = STAMP[item.kind];
    if (field) {
      await stampWeekAccess(input.owner, item.includePaywall ? [field, "paywallAt"] : [field], input.now, input.record);
    }
  }
  return sent;
}
