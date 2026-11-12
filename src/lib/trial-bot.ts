import type { LocaleId } from "./i18n";
import { translate } from "./messages";
import { loadUserStore, loadWeekAccess, saveWeekAccess } from "./redis";
import { describeSessionPlan } from "./session-plan";
import {
  accessForUser,
  openWeekAccess,
  pauseWeek,
  resumeWeek,
  type WeekAccessIdentity,
} from "./week-access";

export async function ensureTrial(owner: string, now = new Date()): Promise<void> {
  const current = await loadWeekAccess(owner);
  if (current.openedAt) return;
  await saveWeekAccess(owner, openWeekAccess(current, now));
}

export async function sessionMenu(
  owner: string,
  identity: WeekAccessIdentity,
  locale: LocaleId,
  now = new Date(),
): Promise<{ text: string; rows: { text: string; data: string }[][] }> {
  const store = await loadUserStore(owner);
  const loaded = await loadWeekAccess(owner);
  const view = accessForUser(loaded, identity, process.env.WEEK_EXEMPT_USER_IDS, now).view;
  const plan = store.sessionPlan;
  const text = plan ? describeSessionPlan(plan, now) : translate(locale, "botSessionsEmpty");
  const rows: { text: string; data: string }[][] = [
    [{ text: translate(locale, "botSessionsChange"), data: "ps:edit" }],
  ];
  if (view.paused) rows.push([{ text: translate(locale, "botSessionsResume"), data: "ps:0" }]);
  else if (view.status === "paid") rows.push([{ text: translate(locale, "botSessionsPause"), data: "ps:1" }]);
  return { text, rows };
}

export async function applyPause(
  owner: string,
  identity: WeekAccessIdentity,
  pause: boolean,
  locale: LocaleId,
  now = new Date(),
): Promise<string> {
  const loaded = await loadWeekAccess(owner);
  const resolved = accessForUser(loaded, identity, process.env.WEEK_EXEMPT_USER_IDS, now);
  const record = resolved.record;
  if (!pause) {
    await saveWeekAccess(owner, resumeWeek(record, now));
    return translate(locale, "botResumed");
  }
  const next = pauseWeek(record, now);
  if (!next) return translate(locale, "botPausePaid");
  await saveWeekAccess(owner, next);
  return translate(locale, "botPaused");
}
