export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mood: MoodLevel;
  body: string;
  tags: string[];
  updatedAt: string; // ISO
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

export interface WeekPrep {
  weekKey: string;
  talkNotes: string;
  updatedAt: string;
}

export interface TherapyStore {
  version: 1;
  entries: JournalEntry[];
  sessions: SessionNote[];
  weekPreps: WeekPrep[];
}

export const MOOD_LABELS: Record<MoodLevel, string> = {
  1: "Очень тяжело",
  2: "Тяжело",
  3: "Нейтрально",
  4: "Легче",
  5: "Хорошо",
};

export const STORAGE_KEY = "therapy-helper:v1";

export function emptyStore(): TherapyStore {
  return { version: 1, entries: [], sessions: [], weekPreps: [] };
}
