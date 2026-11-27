import { applyReviewVerdict, recordReview, visiblePilotTopic } from "./theme-review";
import { entriesForTheme, judgeStamp } from "./themes";
import type { JournalEntry, TherapyStore } from "./types";
import { PICKER_FEELINGS, type Feeling } from "./types";
import type { Intake } from "./companion-intake";
import type { TesterInstructions } from "./companion-training";
import { hasAddressEvidence, type AddressGender } from "./companion-address";
import { companionDisplayText } from "./companion-reply";

type Turn = { user: string; reply: string; messageId?: number; retryOf?: string; replyTo?: { author: "assistant" | "user"; text: string } };
type ConversationNote = Pick<JournalEntry, "id" | "updatedAt">;
export type CompanionState = {
  testerInstructions?: TesterInstructions;
  name?: string;
  address?: string;
  gender?: AddressGender;
  genderSource?: "request" | "self";
  intake?: Intake;
  recent: Turn[];
  followUp?: { text: string; due: string };
  conversation?: { lastTurnAt: string; notes: ConversationNote[] };
};

export function recentCompanionNotes(
  state: CompanionState,
  at: string,
): ConversationNote[] {
  const conversation = state.conversation;
  return conversation &&
    Date.parse(at) - Date.parse(conversation.lastTurnAt) < 30 * 60_000
    ? conversation.notes
    : [];
}

/** The first turn after a check-in can be a short answer to the mood prompt. */
export function recentMoodCheckin(store: TherapyStore, state: CompanionState, at: string) {
  const now = Date.parse(at);
  const since = Math.max(now - 30 * 60_000, Date.parse(state.conversation?.lastTurnAt ?? "") || 0);
  let latest: JournalEntry | undefined;
  for (const entry of store.entries) {
    if (entry.source !== "checkin" || !entry.feelings.length || store.droppedEntryIds?.includes(entry.id)) continue;
    const updated = Date.parse(entry.updatedAt);
    if (updated > since && updated <= now && (!latest || updated > Date.parse(latest.updatedAt))) latest = entry;
  }
  return latest?.feelings[0];
}

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
  currentNotes: ConversationNote[] = [],
) {
  const query = words(text);
  const visible = store.themes.filter(visiblePilotTopic);
  const compactTopic = (t: (typeof visible)[number]) => ({
    id: t.id, title: t.title.slice(0, 160), status: t.status,
  });
  const active = visible.filter(t => t.status === "active");
  if (/^(?:да|нет|точно|угу|спасибо|ага|понятно)[.! ]*$/iu.test(text.trim()))
    return { topics: active.map(compactTopic), notes: [] };
  const browse = /(?:^|[^а-яё])(?:тем(?:ы|ам|ами|ах|у)|к терапии|на подумать)(?![а-яё])/iu.test(text);
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
  const currentIds = new Set(currentNotes.map((note) => note.id));
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
  for (const id of currentIds) hits.add(id);
  const matches = visible
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
    .slice(0, 5);
  const detailed = new Set(matches.map(({ t }) => t.id));
  // Include the active index even when the request is colloquial or misspelled.
  const topics = visible
    .filter(t => browse || t.status === "active" || detailed.has(t.id))
    .map(t => {
      const topic = compactTopic(t);
      if (!browse && !detailed.has(t.id)) return topic;
      return {
        ...topic,
        summary: t.summary !== t.title ? t.summary.slice(0, 220) : undefined,
        outcome: t.outcome?.slice(0, 200),
        history: t.review?.filter(e => e.text).slice(-2).map(e => e.text!.slice(0, 220)),
      };
    });
  const chosen = new Map<string, JournalEntry>();
  for (const entry of entries) {
    if (currentIds.has(entry.id)) chosen.set(entry.id, entry);
  }
  for (const r of ranked.filter((item) => recall || item.rank > 0).slice(0, 3))
    chosen.set(r.e.id, r.e);
  const sourceThemes = browse
    ? [...matches.map(m => m.t), ...active.filter(t => !detailed.has(t.id))]
    : matches.map(m => m.t);
  const sourceTopics = new Map<string, string[]>();
  for (const t of sourceThemes.slice(0, 5)) {
    const linked = entriesForTheme(t, entries, store.themeLinks);
    const ids = new Set(linked.map(e => e.id));
    const entry = ranked.find(r => ids.has(r.e.id))?.e;
    if (entry) {
      chosen.set(entry.id, entry);
      sourceTopics.set(entry.id, [...(sourceTopics.get(entry.id) ?? []), t.id]);
    }
  }
  return {
    topics,
    notes: [...chosen.values()].map((e) => ({
      id: e.id,
      date: e.date,
      topicIds: sourceTopics.get(e.id),
      text: e.body.slice(0, 650),
      ...(currentIds.has(e.id) && { currentConversation: true }),
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

export function companionEnvelope(raw: string) {
  const textBlock = raw
    .trim()
    .match(/^\x60{3}(?:json)?\s*([\s\S]*?)\s*\x60{3}$/i);
  const parsed = JSON.parse(textBlock?.[1] ?? raw);
  // AI Tunnel can wrap the final JSON after a server-side file search.
  return (
    parsed?.reply === undefined && typeof parsed?.answer === "string"
      ? JSON.parse(parsed.answer)
      : parsed);
}

export function readCompanionReply(
  raw: string,
  text: string,
  context: ReturnType<typeof companionContext>,
  noteSource = explicitNote(text) || text,
) {
  const data = companionEnvelope(raw);
  if (typeof data?.reply !== "string" || !data.reply.trim())
    throw new Error("empty companion reply");
  const notes: CompanionNote[] = [];
  const clean = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  for (const value of Array.isArray(data.notes) ? data.notes.slice(0, 2) : []) {
    const quote = clean(value?.quote, 1200);
    if (
      !quote ||
      !noteSource.includes(quote) ||
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
    reply: companionDisplayText(clean(data.reply, 3100)),
    usedCards: data.usedCards as unknown,
    noCardReason: data.noCardReason as unknown,
    notes,
    followUp: companionDisplayText(clean(data.followUp, 250)),
    gender:
      (data.gender === "feminine" || data.gender === "masculine") &&
      typeof data.genderQuote === "string" &&
      data.genderQuote.trim() &&
      hasAddressEvidence(text, data.genderQuote.trim())
        ? (data.gender as CompanionState["gender"])
        : undefined,
  };
}

export function applyCompanionNotes(
  store: TherapyStore,
  text: string,
  notes: CompanionNote[],
  msgId: number,
  date: string,
  at: string,
  currentNotes: ConversationNote[] = [],
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
    const continued =
      !direct && n.kind === "development"
        ? currentNotes.find((note) => note.id === n.beforeId)
        : undefined;
    if (continued) {
      const previous = next.entries.find((entry) => entry.id === continued.id);
      const original = store.entries.find((entry) => entry.id === continued.id);
      // An edit or deletion in the journal takes priority over an automatic append.
      if (
        !previous ||
        original?.updatedAt !== continued.updatedAt ||
        previous.body.split("\n\n").includes(body)
      )
        continue;
      const linked = next.themes.filter(
        (theme) =>
          theme.quotes.some((quote) => quote.entryId === previous.id) ||
          next.themeLinks.some(
            (link) => link.entryId === previous.id && link.themeId === theme.id,
          ),
      );
      if (
        n.topicId &&
        linked.length &&
        !linked.some((theme) => theme.id === n.topicId)
      )
        continue;
      const updated = {
        ...previous,
        body: previous.body + "\n\n" + body,
        updatedAt: at,
        feelings: n.feeling
          ? [...new Set([...previous.feelings, n.feeling])]
          : previous.feelings,
      };
      next = {
        ...next,
        entries: next.entries.map((entry) =>
          entry.id === previous.id ? updated : entry,
        ),
        judgeSettled: linked.length
          ? [...next.judgeSettled, judgeStamp(updated)]
          : next.judgeSettled,
        themes: next.themes.map((theme) =>
          linked.includes(theme) && !theme.dismissed
            ? recordReview(theme, {
                id: "detail:" + id,
                at,
                kind: "note",
                entryId: previous.id,
                text: n.detail || body,
              })
            : theme,
        ),
      };
      continue;
    }
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

/** Only entries written by this companion turn, including appends. */
export function companionEntryPatch(
  previous: JournalEntry[],
  next: JournalEntry[],
) {
  const byId = new Map(previous.map((entry) => [entry.id, entry]));
  return next.filter((entry) => byId.get(entry.id) !== entry);
}

export function emptyCompanion(): CompanionState {
  return { recent: [] };
}
