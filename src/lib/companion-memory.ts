import { applyReviewVerdict, recordReview } from "./theme-review";
import { judgeStamp, visibleTopic } from "./themes";
import type { JournalEntry, TherapyStore } from "./types";
import { PICKER_FEELINGS, type Feeling } from "./types";

type Turn = { user: string; reply: string };
export type CompanionState = {
  name?: string;
  address?: string;
  recent: Turn[];
  followUp?: { text: string; due: string };
};

function words(text: string) {
  return new Set(
    (
      text
        .toLowerCase()
        .replace(/ё/g, "е")
        .match(/[а-яa-z]{4,}/g) ?? []
    )
      .map((word) => word.slice(0, 5))
      .filter(
        (word) =>
          ![
            "сегод",
            "можно",
            "когда",
            "потом",
            "меня",
            "очень",
            "снова",
          ].includes(word),
      ),
  );
}

export function companionContext(
  store: TherapyStore,
  text: string,
  previous?: Turn,
) {
  const query = words(text);
  if (/^(?:да|нет|точно|угу|спасибо|ага|понятно)[.! ]*$/iu.test(text.trim()))
    return { topics: [], notes: [] };
  const recall =
    /(?:вспомни|что я (?:писал|рассказывал)|мои (?:записи|темы)|мы обсуждали)/iu.test(
      text,
    );
  const prior = words(previous?.user ?? "");
  const score = (body: string) =>
    [...words(body)].reduce(
      (n, w) => n + (query.has(w) ? 4 : 0) + (prior.has(w) ? 1 : 0),
      0,
    );
  const entries = store.entries.filter(
    (e) => e.body.trim() && !store.droppedEntryIds?.includes(e.id),
  );
  const ranked = entries
    .map((e) => ({
      e,
      rank: score(e.body + " " + (e.reflection?.insight ?? "")),
    }))
    .sort(
      (a, b) => b.rank - a.rank || b.e.createdAt.localeCompare(a.e.createdAt),
    );
  const hits = new Set(
    ranked
      .filter((r) => r.rank > 0)
      .slice(0, 4)
      .map((r) => r.e.id),
  );
  const topics = store.themes
    .filter(visibleTopic)
    .map((t) => ({
      t,
      rank:
        score(t.title + " " + t.summary) +
        (store.themeLinks.some((l) => l.themeId === t.id && hits.has(l.entryId))
          ? 8
          : 0),
    }))
    .filter((item) => recall || item.rank > 0)
    .sort((a, b) => b.rank - a.rank || b.t.lastSeen.localeCompare(a.t.lastSeen))
    .slice(0, 5)
    .map(({ t }) => ({
      id: t.id,
      title: t.title.slice(0, 100),
      status: t.status,
      outcome: t.outcome?.slice(0, 200),
      history: t.review
        ?.filter((e) => e.text)
        .slice(-2)
        .map((e) => e.text!.slice(0, 220)),
    }));
  const chosen = new Map<string, JournalEntry>();
  for (const r of ranked.filter((item) => recall || item.rank > 0).slice(0, 3))
    chosen.set(r.e.id, r.e);
  for (const t of topics.slice(0, 3)) {
    const entry = ranked.find((r) =>
      store.themeLinks.some((l) => l.themeId === t.id && l.entryId === r.e.id),
    );
    if (entry) chosen.set(entry.e.id, entry.e);
  }
  return {
    topics,
    notes: [...chosen.values()].map((e) => ({
      id: e.id,
      date: e.date,
      text: e.body.slice(0, 650),
      feelings: e.feelings,
      reflection: e.reflection?.insight.slice(0, 180),
    })),
  };
}

export type CompanionNote = {
  feeling?: Feeling;
  quote: string;
  detail: string;
  topicId: string;
  title: string;
  kind: string;
  beforeId: string;
  question: string;
};
export function explicitNote(text: string) {
  const match =
    /^(?:пожалуйста[, ]+)?(?:запиши|сохрани|запомни)(?=\s|[:—,])(?:\s+(?:в дневник|как заметку))?\s*[:—,]?\s*([\s\S]+)$/iu.exec(
      text.trim(),
    );
  return match?.[1].trim() ?? "";
}

export function readCompanionReply(
  raw: string,
  text: string,
  context: ReturnType<typeof companionContext>,
) {
  const textBlock = raw
    .trim()
    .match(/^\x60{3}(?:json)?\s*([\s\S]*?)\s*\x60{3}$/i);
  const data = JSON.parse(textBlock?.[1] ?? raw);
  if (typeof data?.reply !== "string" || !data.reply.trim())
    throw new Error("empty companion reply");
  const notes: CompanionNote[] = [];
  const clean = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  for (const value of Array.isArray(data.notes) ? data.notes.slice(0, 2) : []) {
    const quote = clean(value?.quote, 1200);
    if (
      !quote ||
      !text.includes(quote) ||
      !["situation", "development", "progress"].includes(value.kind)
    )
      continue;
    notes.push({
      quote,
      ...(PICKER_FEELINGS.includes(value.feeling) &&
        typeof value.feelingQuote === "string" &&
        value.feelingQuote.trim() &&
        quote.includes(value.feelingQuote.trim()) && {
          feeling: value.feeling,
        }),
      detail: clean(value.detail, 400),
      kind: value.kind,
      title: clean(value.title, 80),
      topicId: context.topics.some((t) => t.id === value.topicId)
        ? value.topicId
        : "",
      beforeId: context.notes.some((n) => n.id === value.beforeId)
        ? value.beforeId
        : "",
      question: clean(value.question, 200),
    });
  }
  return {
    reply: clean(data.reply, 3100),
    notes,
    followUp: clean(data.followUp, 250),
  };
}

export function applyCompanionNotes(
  store: TherapyStore,
  text: string,
  notes: CompanionNote[],
  msgId: number,
  date: string,
  at: string,
) {
  const direct = explicitNote(text);
  if (
    !direct &&
    /(?:не\s+(?:надо\s+|нужно\s+)?(?:записыва(?:й|ть)|сохраня(?:й|ть)|запомина(?:й|ть))|не для дневника)/iu.test(
      text,
    )
  )
    return store;
  const additions = direct ? [{ ...notes[0], quote: direct }] : notes;
  let next = store;
  for (const [i, n] of additions.entries()) {
    const body = n.quote;
    const id = "companion-tg-" + msgId + "-" + i;
    if (
      next.entries.some((e) => e.id === id) ||
      next.droppedEntryIds?.includes(id)
    )
      continue;
    if (!direct && next.entries.some((e) => e.date === date && e.body === body))
      continue;
    const entry: JournalEntry = {
      id,
      date,
      createdAt: at,
      updatedAt: at,
      body,
      source: "bot",
      feelings: n.feeling ? [n.feeling] : [],
      tags: [],
    };
    next = { ...next, entries: [entry, ...next.entries] };
    if (!n.topicId && !n.title) continue;
    const priorLinked =
      next.themeLinks.some(
        (l) => l.themeId === n.topicId && l.entryId === n.beforeId,
      ) ||
      next.themes
        .find((t) => t.id === n.topicId)
        ?.quotes.some((q) => q.entryId === n.beforeId);
    const progress =
      n.kind === "progress" &&
      priorLinked &&
      next.entries.some((e) => e.id === n.beforeId && e.createdAt < at);
    if (
      n.kind === "progress" &&
      !progress &&
      next.themes.some(
        (t) => t.id === n.topicId && (t.dismissed || t.status === "archived"),
      )
    )
      continue;
    const { state } = applyReviewVerdict(
      { themes: next.themes, links: next.themeLinks },
      entry,
      {
        relevant: true,
        quote: body.slice(0, 140),
        reason: n.detail ?? "",
        intensity: 5,
        confidence: 0.9,
        matchTheme: n.topicId || null,
        newTheme: n.title || null,
        archiveRelation: progress ? "improved" : "returned",
      },
    );
    const link = state.links.find((l) => l.entryId === id);
    if (!link) continue;
    next = {
      ...next,
      themeLinks: state.links,
      judgeSettled: [...next.judgeSettled, judgeStamp(entry)],
      themes: state.themes.map((t) =>
        t.id !== link.themeId
          ? t
          : recordReview(t, {
              id: progress
                ? "observed:" + n.beforeId + ":" + id
                : "detail:" + id,
              at,
              entryId: id,
              kind: progress ? "observed" : "note",
              text: n.detail || body,
              ...(progress && {
                beforeId: n.beforeId,
                question: n.question || "Что помогло в этот раз?",
              }),
            }),
      ),
    };
  }
  return next;
}

export function emptyCompanion(): CompanionState {
  return { recent: [] };
}
