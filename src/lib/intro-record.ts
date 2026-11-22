import { PICKER_FEELINGS, type TherapyStore } from "./types";
import { toDateKey } from "./dates";
import { scenes } from "./intro-scenes";
import { feelingLabel } from "./messages";
import { validMessengerChoices, type MessengerChoice } from "./intro-messengers";

import { checkinEntry, type IntroCheckin } from "./intro-checkin";

export type IntroMood = (typeof PICKER_FEELINGS)[number] | "unknown";
export function recentReasonQuestion(mood: IntroMood, language: "ru" | "en") {
  if (mood === "unknown") return language === "ru"
    ? "Как бы вы описали последние дни своими словами?"
    : "How would you describe the past few days in your own words?";
  return language === "ru"
    ? "Как вам кажется, с чем связано это чувство?"
    : "What do you think might be behind this feeling?";
}
export type IntroRecord = IntroCheckin | LegacyIntroRecord;
export type LegacyIntroRecord = {
  kind?: undefined;
  language?: "ru" | "en";
  attempt: string;
  messengers?: MessengerChoice[];
  name?: string;
  gender?: "male" | "female" | "neutral";
  therapy: "yes" | "regular" | "starting" | "paused" | "no";
  recent: IntroMood;
  recentReason?: string;
  current: IntroMood;
  markedAt: string;
  date: string;
  recalled: boolean;
  situation: string;
  clarification: string;
  answer: string;
  observation: string;
  prompt: string;
};

export function readIntro(value: unknown): IntroRecord | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const mood = (m: unknown) => m === "unknown" || PICKER_FEELINGS.some(f => f === m);
  if (typeof r.attempt !== "string" || !/^[0-9a-f-]{36}$/i.test(r.attempt) ||
      (r.gender !== undefined && !["male","female","neutral"].includes(String(r.gender))) ||
      !["yes","regular","starting","paused","no"].includes(String(r.therapy)) ||
      !mood(r.recent) || !mood(r.current) ||
      typeof r.markedAt !== "string" || !Number.isFinite(Date.parse(r.markedAt)) ||
      typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null;
  if (r.kind === "checkin") {
    const validNote = (s: unknown): s is string => typeof s === "string" && Boolean(s.trim()) && s.length <= 1000;
    if ((r.language !== "ru" && r.language !== "en") || (r.therapy !== "yes" && r.therapy !== "no") ||
        !validNote(r.recentReason) || (r.current !== r.recent && !validNote(r.currentReason))) return null;
    return {kind: "checkin", attempt: r.attempt, language: r.language, therapy: r.therapy,
      recent: r.recent as IntroMood, current: r.current as IntroMood, markedAt: r.markedAt, date: r.date,
      recentReason: r.recentReason.trim(),
      ...(r.current !== r.recent && typeof r.currentReason === "string" ? {currentReason: r.currentReason.trim()} : {}),
      ...(validMessengerChoices(r.messengers) ? {messengers: r.messengers} : {})};
  }
  if (r.kind !== undefined || typeof r.recalled !== "boolean" || !["situation","clarification","answer","observation","prompt"].every(k =>
        typeof r[k] === "string" && r[k].trim() && r[k].length <= 2500)) return null;
  const record = Object.fromEntries(["attempt","therapy","recent","current","markedAt","date","recalled","situation","clarification","answer","observation","prompt"].map(k=>[k,r[k]])) as LegacyIntroRecord;
  if (r.gender === "male" || r.gender === "female" || r.gender === "neutral") record.gender = r.gender;
  if (typeof r.name === "string" && r.name.trim() && r.name.length <= 60) record.name = r.name;
  if (r.language === "ru" || r.language === "en") record.language = r.language;
  if (validMessengerChoices(r.messengers)) record.messengers = r.messengers;
  if (typeof r.recentReason === "string" && r.recentReason.trim() && r.recentReason.length <= 1000) {
    record.recentReason = r.recentReason.trim();
  }
  return record;
}

export function introTranscript(r: LegacyIntroRecord) {
  const language = r.language ?? (/[а-яё]/i.test(r.prompt) ? "ru" : "en");
  const ru = language === "ru";
  const mood = (value: IntroMood, unknown: string) => value === "unknown" ? unknown : feelingLabel(language, value);
  const focus = r.recalled ? r.recent : r.current;
  const therapy = ru ? {yes:"Да",regular:"Да, регулярно",starting:"Только начинаю",paused:"Сейчас на паузе",no:"Нет"}
    : {yes:"Yes",regular:"Yes, regularly",starting:"Just starting",paused:"Taking a break",no:"No"};
  const gender = ru ? {male:"Мужчина",female:"Женщина",neutral:"Предпочитаю не указывать"}
    : {male:"Man",female:"Woman",neutral:"Prefer not to say"};
  const answers = [
    [ru ? "Вы сейчас занимаетесь с психотерапевтом?" : "Are you seeing a therapist?", therapy[r.therapy]],
    ...(r.messengers ? [[ru ? "Какими мессенджерами вы пользуетесь?" : "Which messaging apps do you use?",
      r.messengers.map(m => ({telegram:"Telegram", max:"MAX", whatsapp:"WhatsApp", none:ru?"Не пользуюсь":"None"})[m]).join(", ")]] : []),
    ...(r.gender ? [[ru ? "Вы мужчина или женщина?" : "How do you describe yourself?", gender[r.gender]]] : []),
    ...(r.name ? [[ru ? "Как к вам обращаться?" : "What should we call you?", r.name]] : []),
    [ru ? "В последнее время" : "Lately", mood(r.recent, ru ? "Не помню" : "I don’t remember")],
    ...(r.recentReason ? [[recentReasonQuestion(r.recent, language), r.recentReason]] : []),
    [ru ? "Прямо сейчас" : "Right now", mood(r.current, ru ? "Пока не могу назвать" : "Hard to name")],
    ...(r.current === "unknown" && r.recent !== "unknown" ? [[ru ? "Выбранный момент" : "Chosen moment", r.recalled ? (ru ? "Из недавнего" : "A recent moment") : (ru ? "Прямо сейчас" : "Right now")]] : []),
    [scenes[focus].title[ru ? 0 : 1], r.situation],
    [r.clarification, r.answer],
  ];
  return {
    title: ru ? "Моё первое наблюдение" : "My first observation",
    history: ru ? "Ход анкеты" : "Questionnaire answers",
    text: answers.map(pair => pair.join("\n")).join("\n\n"),
  };
}

export function introEntryBody(record: LegacyIntroRecord, finalAnswer: string) {
  const transcript = introTranscript(record);
  return [transcript.title, record.observation, record.prompt, finalAnswer, transcript.history, transcript.text].join("\n\n");
}

export type IntroDraft = IntroRecord & {
  note?: {body: string; markedAt: string; date: string};
};

export function readIntroDraft(value: unknown): IntroDraft | null {
  const record = readIntro(value);
  if (!record || record.kind === "checkin" || !value || typeof value !== "object" || !("note" in value)) return record;
  const note = value.note;
  if (!note || typeof note !== "object" || !("body" in note) || typeof note.body !== "string" || !note.body.trim() ||
      !("markedAt" in note) || typeof note.markedAt !== "string" || !Number.isFinite(Date.parse(note.markedAt)) ||
      !("date" in note) || typeof note.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(note.date)) return null;
  return {...record, note: {body: note.body, markedAt: note.markedAt, date: note.date}};
}

export function applyIntro(store: TherapyStore, {note, ...record}: IntroDraft): TherapyStore {
  if (store.introductions?.some(r => r.attempt === record.attempt)) return store;
  if (record.kind === "checkin") {
    const entry = checkinEntry(record);
    const exists = store.droppedEntryIds?.includes(entry.id) || store.entries.some(e => e.id === entry.id);
    return {...store, entries: exists ? store.entries : [...store.entries, entry],
      introductions: [...(store.introductions ?? []), record],
      profile: {...store.profile, therapy: record.therapy === "yes", updatedAt: new Date().toISOString()}};
  }
  const id = "intro-mood-" + record.attempt;
  const mood = record.current;
  const entries = mood === "unknown" || store.droppedEntryIds?.includes(id) || store.entries.some(e=>e.id===id)
    ? store.entries : [...store.entries, {id, date: record.date, createdAt: record.markedAt, updatedAt: record.markedAt,
        source: "app" as const, body:"", tags:[], feelings:[mood]}];
  const noteId = "intro-answer-" + record.attempt;
  const addNote = note && !store.droppedEntryIds?.includes(noteId) && !entries.some(e => e.id === noteId);
  return {...store, entries: addNote ? [...entries, {id: noteId, date: note.date, createdAt: note.markedAt,
    updatedAt: note.markedAt, body: introEntryBody(record, note.body), source: "app", tags: [], feelings: []}] : entries,
    introductions:[...(store.introductions ?? []), record],
    profile:{...store.profile, therapy:record.therapy==="yes" || record.therapy==="regular" || record.therapy==="starting", updatedAt:new Date().toISOString()}};
}

export function markMoment() {
  const now = new Date();
  return {markedAt:now.toISOString(), date:toDateKey(now)};
}

