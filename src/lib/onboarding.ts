import { weekdayName, weekdayShort } from "./dates";
import type { LocaleId } from "./i18n";
import { feelingLabel, translate } from "./messages";
import { PICKER_FEELINGS, type CheckinSlot, type Feeling } from "./types";

/** Monday = 0. Dates are only there so weekday labels follow the locale. */
const DAY_KEYS = [
  "2026-01-05",
  "2026-01-06",
  "2026-01-07",
  "2026-01-08",
  "2026-01-09",
  "2026-01-10",
  "2026-01-11",
] as const;

/** Hours offered for a weekly session. One clock time applies to every chosen day. */
export const ONBOARD_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] as const;

const STEPS = ["therapist", "days", "time", "mood", "note", "done"] as const;

export type OnboardStep = (typeof STEPS)[number];

export type OnboardState = {
  step: OnboardStep;
  days: number[];
  /** Set once a clock time is chosen, so a repeated mood question can name the plan. */
  time?: string;
  /** How the person reached the mood question. */
  via?: "plan" | "skip";
  feeling?: Feeling;
  /** When this pass of the questionnaire started. */
  since?: string;
  reminded?: boolean;
};

export type OnboardButton = { text: string; data: string };

export type OnboardAction =
  | { kind: "yes" }
  | { kind: "no" }
  | { kind: "toggle"; day: number }
  | { kind: "days-done" }
  | { kind: "time"; time: string }
  | { kind: "mood"; index: number };

export type OnboardMove =
  | { ok: false; reason: "stale" | "need-day" }
  | {
      ok: true;
      state: OnboardState;
      /** Day taps only refresh the keyboard. */
      markupOnly?: boolean;
      plan?: { days: number[]; time: string };
      feeling?: Feeling;
    };

export function freshOnboarding(): OnboardState {
  return { step: "therapist", days: [] };
}

export function parseOnboarding(raw: unknown): OnboardState | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as {
    step?: unknown;
    days?: unknown;
    time?: unknown;
    via?: unknown;
    feeling?: unknown;
    since?: unknown;
    reminded?: unknown;
  };
  if (typeof row.step !== "string" || !STEPS.includes(row.step as OnboardStep)) return null;
  const days = Array.isArray(row.days)
    ? [...new Set(row.days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))].sort(
        (a, b) => a - b,
      )
    : [];
  const time = typeof row.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.time) ? row.time : undefined;
  const via = row.via === "plan" || row.via === "skip" ? row.via : undefined;
  const feeling = PICKER_FEELINGS.find((item) => item === row.feeling);
  const since = typeof row.since === "string" && Number.isFinite(Date.parse(row.since)) ? row.since : undefined;
  return { step: row.step as OnboardStep, days, time, via, feeling, since, reminded: row.reminded === true };
}

export function parseOnboardCallback(data: string): OnboardAction | null {
  if (data === "ob:y") return { kind: "yes" };
  if (data === "ob:n") return { kind: "no" };
  if (data === "ob:ok") return { kind: "days-done" };
  const day = /^ob:d:([0-6])$/.exec(data);
  if (day) return { kind: "toggle", day: Number(day[1]) };
  const hour = /^ob:h:(0[9]|1\d|2[01])$/.exec(data);
  if (hour) return { kind: "time", time: `${hour[1]}:00` };
  const mood = /^ob:f:(\d)$/.exec(data);
  if (!mood) return null;
  const index = Number(mood[1]);
  if (!PICKER_FEELINGS[index]) return null;
  return { kind: "mood", index };
}

/** Morning before noon, day until 17:00, then evening. The week spectrum reads this slot. */
export function checkinSlotForHour(hour: number): CheckinSlot {
  if (hour < 12) return "morning";
  if (hour < 17) return "day";
  return "evening";
}

export function scheduleWhen(days: number[], time: string, locale: LocaleId): string {
  const names = [...days].sort((a, b) => a - b).map((day) => weekdayName(day, locale));
  return `${names.join(", ")} · ${time}`;
}

export function applyOnboarding(state: OnboardState, action: OnboardAction): OnboardMove {
  if (state.step === "done") return { ok: false, reason: "stale" };
  if (action.kind === "yes" || action.kind === "no") {
    if (state.step !== "therapist") return { ok: false, reason: "stale" };
    if (action.kind === "yes") return { ok: true, state: { step: "days", days: [] } };
    return { ok: true, state: { step: "mood", days: [], via: "skip" } };
  }
  if (action.kind === "toggle") {
    if (state.step !== "days") return { ok: false, reason: "stale" };
    const days = state.days.includes(action.day)
      ? state.days.filter((day) => day !== action.day)
      : [...state.days, action.day].sort((a, b) => a - b);
    return { ok: true, state: { ...state, days }, markupOnly: true };
  }
  if (action.kind === "days-done") {
    if (state.step !== "days") return { ok: false, reason: "stale" };
    if (state.days.length === 0) return { ok: false, reason: "need-day" };
    return { ok: true, state: { step: "time", days: state.days } };
  }
  if (action.kind === "time") {
    if (state.step !== "time" || state.days.length === 0) return { ok: false, reason: "stale" };
    return {
      ok: true,
      state: { step: "mood", days: state.days, time: action.time, via: "plan" },
      plan: { days: state.days, time: action.time },
    };
  }
  if (state.step !== "mood") return { ok: false, reason: "stale" };
  const feeling = PICKER_FEELINGS[action.index];
  if (!feeling) return { ok: false, reason: "stale" };
  return { ok: true, state: { ...state, step: "note", feeling }, feeling };
}

export function onboardPrompt(
  state: OnboardState,
  locale: LocaleId,
): { text: string; rows: OnboardButton[][] } | null {
  if (state.step === "done") return null;
  if (state.step === "therapist") {
    return { text: translate(locale, "botAskTherapist"), rows: therapistRows(locale) };
  }
  if (state.step === "days") {
    return { text: translate(locale, "botAskDays"), rows: dayRows(locale, state.days) };
  }
  if (state.step === "time") {
    return { text: translate(locale, "botAskTime"), rows: timeRows() };
  }
  if (state.step === "mood") {
    const text =
      state.via === "plan" && state.time
        ? translate(locale, "botPlanSaved", { when: scheduleWhen(state.days, state.time, locale) })
        : translate(locale, "botNoTherapist");
    return { text, rows: moodRows(locale) };
  }
  return {
    text: translate(locale, "botAskNote", {
      feeling: state.feeling ? feelingLabel(locale, state.feeling) : "—",
    }),
    rows: [],
  };
}

/** The question again, with a line that a typed message is not a button. */
export function onboardReminder(state: OnboardState, locale: LocaleId): { text: string; rows: OnboardButton[][] } | null {
  const prompt = onboardPrompt(state, locale);
  if (!prompt || state.step === "note") return prompt;
  return { ...prompt, text: `${translate(locale, "botPickButton")}\n\n${prompt.text}` };
}

function therapistRows(locale: LocaleId): OnboardButton[][] {
  return [[
    { text: translate(locale, "botTherapistYes"), data: "ob:y" },
    { text: translate(locale, "botTherapistNo"), data: "ob:n" },
  ]];
}

function dayRows(locale: LocaleId, selected: number[]): OnboardButton[][] {
  const buttons = DAY_KEYS.map((key, index) => ({
    text: `${selected.includes(index) ? "✓ " : ""}${weekdayShort(key, locale)}`,
    data: `ob:d:${index}`,
  }));
  return [buttons.slice(0, 4), buttons.slice(4), [{ text: translate(locale, "botDaysReady"), data: "ob:ok" }]];
}

function timeRows(): OnboardButton[][] {
  const buttons = ONBOARD_HOURS.map((hour) => {
    const label = `${String(hour).padStart(2, "0")}:00`;
    return { text: label, data: `ob:h:${label.slice(0, 2)}` };
  });
  const rows: OnboardButton[][] = [];
  for (let index = 0; index < buttons.length; index += 3) rows.push(buttons.slice(index, index + 3));
  return rows;
}

function moodRows(locale: LocaleId): OnboardButton[][] {
  const rows: OnboardButton[][] = [];
  for (let index = 0; index < PICKER_FEELINGS.length; index += 3) {
    rows.push(
      PICKER_FEELINGS.slice(index, index + 3).map((feeling, offset) => ({
        text: feelingLabel(locale, feeling),
        data: `ob:f:${index + offset}`,
      })),
    );
  }
  return rows;
}
