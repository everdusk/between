export const FEELINGS = [
  "тревожно",
  "спокойно",
  "злость",
  "грусть",
  "радость",
  "усталость",
  "стыд",
  "пусто",
  "напряжение",
  "тяжело",
] as const;

export type Feeling = (typeof FEELINGS)[number];

/** Feelings offered in the picker and the bot. «Тяжело» only keeps old 1–2 scores. */
export const PICKER_FEELINGS = [
  "тревожно",
  "спокойно",
  "злость",
  "грусть",
  "радость",
  "усталость",
  "стыд",
  "пусто",
  "напряжение",
] as const satisfies readonly Feeling[];

export type EntrySource = "app" | "bot" | "checkin";

export type CheckinSlot = "morning" | "day" | "evening";

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  body: string;
  feelings: Feeling[];
  tags: string[];
  /** Themes read from the note. Replaced when the note is read again. */
  autoThemes?: string[];
  /** Lines the person typed. They stay when themes are read again. */
  userTags?: string[];
  /** Therapy themes the person took off this note. */
  themeHidden?: string[];
  source: EntrySource;
  slot?: CheckinSlot;
}

export interface SessionNote {
  id: string;
  date: string; // YYYY-MM-DD
  summary: string;
  insights: string;
  homework: string;
  weekKey: string; // YYYY-Www for the week this session relates to
  updatedAt: string;
}

export type BacklogPriority = "high" | "mid" | "low";

/** auto — taken from notes; user — written by hand and kept beside the generated list. */
export type BacklogOrigin = "auto" | "user";

export interface BacklogItem {
  id: string;
  text: string;
  priority: BacklogPriority;
  done: boolean;
  origin?: BacklogOrigin;
}

/** rules — old generated list; model — the same list tightened by a model; user — lines the person wrote or kept. */
export type BacklogSource = "rules" | "model" | "user";

export type SessionThemeStatus = "active" | "discussed" | "archived";

export interface ThemeQuote {
  entryId: string;
  text: string;
  date: string;
  intensity: number;
}

/** Entry↔theme link. One entry belongs to at most one theme. */
export interface ThemeLink {
  entryId: string;
  themeId: string;
  confidence: number;
}

/**
 * A therapy topic at pattern level. Notes never sit in the backlog themselves;
 * the backlog is the list of these themes.
 */
export interface SessionTheme {
  id: string;
  userId: string;
  title: string;
  status: SessionThemeStatus;
  count: number;
  firstSeen: string;
  lastSeen: string;
  peakIntensity: number;
  peakFeeling?: Feeling;
  reopened: boolean;
  dismissed: boolean;
  confidence: number;
  /** One line for the judge. Built from the title. */
  summary: string;
  quotes: ThemeQuote[];
  /** Added by hand from the existing field. The judge does not recreate it. */
  manual?: boolean;
  updatedAt: string;
}

export interface WeekPrep {
  weekKey: string;
  talkNotes: string;
  updatedAt: string;
  briefText?: string;
  briefStamp?: string;
  /** The one model paragraph in the brief. The rest is a template. */
  patternText?: string;
  patternStamp?: string;
  backlog?: BacklogItem[];
  backlogStamp?: string;
  backlogSource?: BacklogSource;
  /** Generated lines the person removed. They stay out when the list rebuilds. */
  backlogHidden?: string[];
  themeStamp?: string;
  themeSource?: "model" | "rules";
}

/** 0 = Monday … 6 = Sunday */
export interface SessionPlan {
  mode: "once" | "weekly";
  date: string;
  time: string; // HH:mm
  weekday: number;
  updatedAt: string;
}

export interface NotifyPrefs {
  moodPolls: boolean;
  eveningNudge: boolean;
  updatedAt: string;
}

export interface TherapyStore {
  version: 2;
  entries: JournalEntry[];
  sessions: SessionNote[];
  weekPreps: WeekPrep[];
  sessionPlan: SessionPlan | null;
  notify: NotifyPrefs;
  themes: SessionTheme[];
  themeLinks: ThemeLink[];
  /** `${entryId}:${updatedAt}` already given to the judge, including “not a theme”. */
  judgeSettled: string[];
}

export const STORAGE_KEY = "therapy-helper:v1";

export const DEFAULT_TIME_ZONE = "Europe/Moscow";

export function emptyNotify(): NotifyPrefs {
  return { moodPolls: true, eveningNudge: true, updatedAt: "" };
}

export function emptyStore(): TherapyStore {
  return {
    version: 2,
    entries: [],
    sessions: [],
    weekPreps: [],
    sessionPlan: null,
    notify: emptyNotify(),
    themes: [],
    themeLinks: [],
    judgeSettled: [],
  };
}
