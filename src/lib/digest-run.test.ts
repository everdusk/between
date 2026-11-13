import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDigestRun, parseDigestRun } from "./digest";

describe("digest run summary", () => {
  it("reads a stored run and ignores junk", () => {
    const run = parseDigestRun({ at: "2026-11-09T10:00:03.000Z", users: "12", sent: 3, skipped: 9, failed: 0, errors: 0, ms: 2400 });
    assert.ok(run);
    assert.equal(run.users, 12);
    assert.equal(run.sent, 3);
    assert.equal(parseDigestRun({ users: 1 }), null);
    assert.equal(parseDigestRun("nope"), null);
    assert.equal(parseDigestRun({ at: "not a date" }), null);
  });

  it("tells the owner when polls last went out and when the schedule stopped", () => {
    const fresh = formatDigestRun(
      { at: "2026-11-09T10:00:03.000Z", users: 12, sent: 3, skipped: 9, failed: 1, errors: 0, ms: 2400 },
      new Date("2026-11-09T10:40:00.000Z"),
    );
    assert.match(fresh, /^Опросы\n/);
    assert.match(fresh, /Последний прогон 9 ноя 13:00 по Москве/);
    assert.match(fresh, /Людей 12, отправлено 3, не в срок 9/);
    assert.match(fresh, /Не доставлено 1/);
    assert.doesNotMatch(fresh, /Ошибок/);
    assert.doesNotMatch(fresh, /молчит/);
    assert.match(fresh, /Заняло 2\.4 с/);

    const stale = formatDigestRun(
      { at: "2026-11-08T10:00:03.000Z", users: 12, sent: 0, skipped: 12, failed: 0, errors: 2, ms: 900 },
      new Date("2026-11-09T10:40:00.000Z"),
    );
    assert.match(stale, /Расписание молчит 24 ч\. Проверьте QStash\./);
    assert.match(stale, /Ошибок 2/);

    assert.match(formatDigestRun(null), /Ещё ни одного прогона/);
  });
});
