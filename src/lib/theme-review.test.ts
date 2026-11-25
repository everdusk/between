import assert from "node:assert/strict";
import { it } from "node:test";
import { matchReviewOwner } from "./review-owner";
import {
  applyReviewVerdict,
  archivedForEntry,
  checkInTopic,
  readReview,
  recordReview,
  reviewFacts,
  visibleDiscussedTopic,
  visiblePilotTopic,
} from "./theme-review";
import { addManualTheme, dismissTheme, discussTheme, type JudgeVerdict } from "./themes";
import { emptyStore, type JournalEntry } from "./types";
import { mergeStores } from "./journal-api";
import { normalizeStore } from "./migrate";

const theme = addManualTheme(
  [],
  "Ошибки на работе",
  "2026-10-20",
  "2026-10-20T12:00:00Z",
)[0];
const note = (id: string, date: string, body: string): JournalEntry => ({
  id,
  date,
  createdAt: date + "T12:00:00Z",
  updatedAt: date + "T12:00:00Z",
  body,
  feelings: [],
  tags: [],
  source: "app",
});
const old = note("old", "2026-10-20", "Я боялась ошибиться.");
const fresh = note("new", "2026-11-23", "После ошибки я вернулась к задаче.");
const other = note("other", "2026-11-23", "Мы поссорились с подругой.");

it("keeps removed topics out of Discussed even when they were previously discussed or resolved", () => {
  const closedAt = "2026-11-03T08:00:00Z";
  const removedAt = "2026-11-24T08:00:00Z";
  const discussed = discussTheme([theme], theme.id, true, closedAt)[0];
  const resolved = recordReview(theme, {
    id: "resolution",
    kind: "resolved",
    text: "Я поговорила с командой.",
    at: closedAt,
  });
  assert.equal(visibleDiscussedTopic(discussed, true), true);
  assert.equal(visibleDiscussedTopic(resolved, true), true);
  assert.equal(visibleDiscussedTopic(resolved), false);
  assert.equal(visiblePilotTopic(resolved), true);

  const removed = [theme, discussed, resolved].map(item => dismissTheme([item], item.id, removedAt)[0]);
  const persisted = normalizeStore({ ...emptyStore(), themes: removed })!.themes;
  assert.equal(persisted.length, 3);
  for (const item of persisted) {
    assert.equal(item.dismissedAt, removedAt);
    assert.equal(visibleDiscussedTopic(item, true), false);
    assert.equal(visiblePilotTopic(item), false);
    assert.equal(archivedForEntry(item, fresh), false);
  }
  const olderRemoval = { ...removed[1], dismissedAt: undefined };
  assert.equal(visibleDiscussedTopic(olderRemoval, true), false);
  assert.equal(visiblePilotTopic(olderRemoval), false);
});
it("enrols just the signed owner and keeps the original numeric identity after a handle changes", async () => {
  let id: string | null = null;
  const ledger = {
    read: async () => id,
    bind: async (candidate: string) => {
      id ??= candidate;
    },
  };
  const actor = {
    telegramUserId: 1,
    telegramUsername: "aliatorovskaia",
    messenger: "telegram" as const,
  };
  assert.equal(
    await matchReviewOwner({ ...actor, messenger: "web" }, ledger),
    false,
  );
  assert.equal(
    await matchReviewOwner({ ...actor, telegramUsername: "someone" }, ledger),
    false,
  );
  assert.equal(await matchReviewOwner(actor, ledger), true);
  assert.equal(
    await matchReviewOwner({ ...actor, telegramUserId: 2 }, ledger),
    false,
  );
  assert.equal(
    await matchReviewOwner(
      { ...actor, messenger: "web", telegramUsername: "newname" },
      ledger,
    ),
    true,
  );
  assert.equal(
    await matchReviewOwner({ ...actor, telegramUserId: null }, ledger),
    false,
  );
  assert.equal(
    await matchReviewOwner(actor, {
      ...ledger,
      read: async () => {
        throw Error();
      },
    }),
    false,
  );
});
it("requires an answer to archive, snoozes Yes for fourteen days, and preserves reflections through sync", () => {
  assert.equal(checkInTopic([theme], "2026-11-03")?.id, theme.id);
  const at = "2026-11-03T08:00:00Z";
  const yes = recordReview(theme, { id: "yes", kind: "still", at });
  assert.equal(yes.status, "active");
  assert.equal(checkInTopic([yes], "2026-11-16"), undefined);
  assert.equal(checkInTopic([yes], "2026-11-17")?.id, theme.id);
  assert.equal(
    recordReview(theme, { id: "no", kind: "resolved", text: "  ", at }),
    theme,
  );
  const archived = recordReview(theme, {
    id: "no",
    kind: "resolved",
    text: "Я поговорила с командой.",
    at,
  });
  assert.equal(archived.dismissed, true);
  assert.equal(archived.status, "archived");
  const merged = mergeStores(
    { ...emptyStore(), themes: [archived] },
    { ...emptyStore(), themes: [yes] },
  );
  assert.deepEqual(
    normalizeStore(merged)
      ?.themes[0].review?.map((e) => e.id)
      .sort(),
    ["no", "yes"],
  );
});
it("returns archived topics only for new, evidenced recurrences and keeps a positive example in the archive", () => {
  const archived = dismissTheme([theme], theme.id, "2026-11-01T10:00:00Z")[0];
  const state = {
    themes: [{ ...archived, outcome: "Я поговорила с командой." }],
    links: [],
  };
  const verdict: JudgeVerdict = {
    matchTheme: theme.id,
    newTheme: null,
    confidence: 0.94,
    intensity: 8,
    quote: fresh.body,
    reason: "",
    relevant: true,
    archiveRelation: "returned",
  };
  assert.equal(
    applyReviewVerdict(state, old, { ...verdict, quote: old.body }).touchedId,
    null,
  );
  assert.equal(
    applyReviewVerdict(state, fresh, { ...verdict, quote: "выдумка" }).state,
    state,
  );
  assert.equal(
    applyReviewVerdict(state, fresh, { ...verdict, archiveRelation: undefined })
      .state,
    state,
  );
  const improved = applyReviewVerdict(state, fresh, {
    ...verdict,
    archiveRelation: "improved",
  }).state;
  assert.equal(improved.themes[0].status, "archived");
  assert.equal(improved.links[0].entryId, fresh.id);
  const returned = applyReviewVerdict(state, fresh, verdict).state;
  assert.equal(returned.themes[0].status, "active");
  assert.equal(returned.themes[0].dismissed, false);
  assert.equal(returned.themes[0].dismissedAt, undefined);
  assert.equal(returned.themes[0].review?.[0].text, state.themes[0].outcome);
});
it("keeps independent entries in scope and rejects a fabricated comparison or reversed chronology", () => {
  const links = [old, fresh].map((e) => ({
    themeId: theme.id,
    entryId: e.id,
    confidence: 1,
  }));
  const facts = reviewFacts(
    [old, fresh, other],
    [fresh, other],
    [theme],
    links,
    theme,
  );
  assert.deepEqual(facts.notes.map((n) => n.id).sort(), [
    "new",
    "old",
    "other",
  ]);
  const change = {
    theme: theme.id,
    before: old.id,
    after: fresh.id,
    text: "Реакция изменилась.",
    question: "Что помогло вернуться?",
  };
  const report = readReview(
    JSON.stringify({
      lines: [
        { entries: ["other"], text: other.body },
        { entries: ["invented"], text: "нет" },
      ],
      changes: [
        change,
        { ...change, before: "other" },
        { ...change, before: "new", after: "old" },
      ],
      question: "Всё ещё тревожит?",
    }),
    facts,
  )!;
  assert.deepEqual(report.changes, [change]);
  assert.equal(report.lines.length, 1);
});
