import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadWeekPdfFile, saveWeekPdfFile, type WeekPdfStored } from "./week-pdf-file";

function memory() {
  const values = new Map<string, WeekPdfStored>();
  return {
    values,
    set: async (key: string, value: WeekPdfStored) => {
      values.set(key, value);
    },
    get: async (key: string) => values.get(key) ?? null,
  };
}

describe("week pdf file", () => {
  const bytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

  it("stores a sheet and reads the same bytes back", async () => {
    const redis = memory();
    const id = await saveWeekPdfFile(redis, bytes, "between-2026-11-05_2026-11-11.pdf");
    assert.match(id, /^[a-f0-9]{32}$/);
    const loaded = await loadWeekPdfFile(redis, id);
    assert.equal(loaded?.filename, "between-2026-11-05_2026-11-11.pdf");
    assert.deepEqual(loaded?.bytes, Buffer.from(bytes));
  });

  it("refuses a file that is not a pdf and a guessed id", async () => {
    const redis = memory();
    await assert.rejects(() => saveWeekPdfFile(redis, Uint8Array.from([1, 2, 3, 4, 5]), "notes.pdf"));
    assert.equal(await loadWeekPdfFile(redis, "not-an-id"), null);
    assert.equal(redis.values.size, 0);
  });

  it("replaces a name that is not the sheet's ascii pattern", async () => {
    const redis = memory();
    const id = await saveWeekPdfFile(redis, bytes, "неделя.pdf");
    const loaded = await loadWeekPdfFile(redis, id);
    assert.equal(loaded?.filename, "between-week.pdf");
  });
});
