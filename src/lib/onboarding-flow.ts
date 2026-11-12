import { trackBotFunnel, type BotFunnelChoice } from "./bot-funnel";
import { saveWeeklyPlanForOwner, addCheckinForOwner } from "./journal-server";
import { getRedis, getUserTimezone } from "./redis";
import { trackServerEvent } from "./analytics";
import type { LocaleId } from "./i18n";
import { translate } from "./messages";
import {
  applyOnboarding,
  checkinSlotForHour,
  freshOnboarding,
  onboardPrompt,
  onboardReminder,
  parseOnboardCallback,
  parseOnboarding,
  type OnboardAction,
  type OnboardButton,
  type OnboardMove,
  type OnboardState,
} from "./onboarding";
import { zonedParts } from "./zoned";

export type OnboardView = { text: string; rows: OnboardButton[][] };

export type OnboardAnswer =
  | { type: "ignore" }
  | { type: "update"; text: string; rows: OnboardButton[][]; markupOnly?: boolean };

function trackedChoice(action: OnboardAction, move: OnboardMove): BotFunnelChoice | null {
  if (!move.ok || move.markupOnly) return null;
  if (action.kind === "yes") return { step: "yes" };
  if (action.kind === "no") return { step: "no" };
  if (action.kind === "days-done") return { step: "days", days: move.state.days };
  if (action.kind === "time") return { step: "time", hour: Number(action.time.slice(0, 2)) };
  if (action.kind === "mood" && move.feeling) return { step: "mood", feeling: move.feeling };
  return null;
}

function key(owner: string): string {
  return `between:onboard:${owner}`;
}

export async function loadOnboarding(owner: string): Promise<OnboardState | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<unknown>(key(owner));
  if (raw == null) return null;
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return parseOnboarding(parsed);
}

async function saveOnboarding(owner: string, state: OnboardState): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(key(owner), state);
}

/** Starts the questions after the welcome. A finished questionnaire stays finished. */
export async function openOnboarding(owner: string, locale: LocaleId): Promise<OnboardView | null> {
  if (!getRedis()) return null;
  const current = await loadOnboarding(owner);
  if (current?.step === "done") return null;
  const state = { ...freshOnboarding(), since: new Date().toISOString() };
  await saveOnboarding(owner, state);
  return onboardPrompt(state, locale);
}

export async function answerOnboarding(
  owner: string,
  locale: LocaleId,
  data: string,
  channel: { userId: number; messenger: "telegram" | "max" },
): Promise<OnboardAnswer> {
  const action = parseOnboardCallback(data);
  const current = await loadOnboarding(owner);
  if (!action || !current) return { type: "ignore" };
  const move = applyOnboarding(current, action);
  if (!move.ok) {
    if (move.reason !== "need-day") return { type: "ignore" };
    const prompt = onboardPrompt(current, locale);
    if (!prompt) return { type: "ignore" };
    return {
      type: "update",
      text: `${translate(locale, "botNeedDay")}\n\n${prompt.text}`,
      rows: prompt.rows,
    };
  }
  try {
    if (move.plan) {
      const saved = await saveWeeklyPlanForOwner(owner, move.plan.days, move.plan.time);
      if (!saved) return { type: "ignore" };
    }
    if (move.feeling) {
      const hour = zonedParts(new Date(), await getUserTimezone(owner)).hour;
      await addCheckinForOwner(owner, checkinSlotForHour(hour), move.feeling);
      await trackServerEvent({ userId: channel.userId, event: "mood", messenger: channel.messenger });
    }
    await saveOnboarding(owner, { ...move.state, since: current.since, reminded: current.reminded });
    const choice = trackedChoice(action, move);
    if (choice) {
      await trackBotFunnel({ userId: channel.userId, messenger: channel.messenger, choice });
    }
  } catch {
    return { type: "ignore" };
  }
  const prompt = onboardPrompt(move.state, locale);
  if (!prompt) return { type: "ignore" };
  return { type: "update", text: prompt.text, rows: prompt.rows, markupOnly: move.markupOnly };
}

/** The open question, asked again when a message arrives before the buttons are done. */
export async function remindOnboarding(owner: string, locale: LocaleId): Promise<OnboardView | null> {
  const state = await loadOnboarding(owner);
  if (!state) return null;
  return onboardReminder(state, locale);
}

/** What a plain message should do while the questions are open. */
export async function onboardingNoteIntent(owner: string): Promise<"free" | "block" | "finish"> {
  const state = await loadOnboarding(owner);
  if (!state || state.step === "done") return "free";
  if (state.step === "note") return "finish";
  return "block";
}

export async function markQuizReminded(owner: string): Promise<void> {
  const state = await loadOnboarding(owner);
  if (!state || state.step === "done") return;
  await saveOnboarding(owner, { ...state, reminded: true });
}

export function quizReminderDue(state: OnboardState | null, now: Date, hour: number): boolean {
  if (!state || state.step === "done" || state.reminded) return false;
  if (hour < 9 || hour >= 22) return false;
  const since = state.since ? Date.parse(state.since) : NaN;
  if (!Number.isFinite(since)) return false;
  return now.getTime() - since >= 24 * 60 * 60 * 1000;
}

export async function finishOnboarding(owner: string): Promise<void> {
  const current = await loadOnboarding(owner);
  await saveOnboarding(owner, { step: "done", days: current?.days ?? [] });
}
