import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LOCALES } from "./i18n";
import { isLegalPath, isQuietPath } from "./landing";
import { LEGAL_EMAIL, LEGAL_INN, LEGAL_NAME, legalDocument } from "./legal";
import { translate } from "./messages";

const BINDING = "Если формулировки разойдутся, главный текст — на русском языке.";

describe("legal documents", () => {
  it("names the operator in every language", () => {
    assert.equal(LOCALES.length, 12);
    for (const { id } of LOCALES) {
      for (const kind of ["terms", "privacy"] as const) {
        const doc = legalDocument(kind, id);
        assert.equal(doc.sections.length, 6, `${id} ${kind}`);
        const text = doc.sections.flatMap((section) => [section.heading, ...section.paragraphs]).join("\n");
        assert.ok(text.includes(LEGAL_INN), `${id} ${kind} inn`);
        assert.ok(text.includes(LEGAL_EMAIL), `${id} ${kind} email`);
        assert.ok(text.includes("Ляторовская"), `${id} ${kind} name`);
        assert.equal(/\bVK\b|Сбер|Sber|Яндекс ID|Yandex ID/.test(text), false, `${id} ${kind} oauth`);
        if (id === "ru") {
          assert.ok(text.includes(LEGAL_NAME));
          assert.ok(text.includes("самозанятая"));
          assert.equal(text.includes(BINDING), false);
        } else {
          assert.ok(text.includes(BINDING), `${id} ${kind} binding`);
        }
      }
      const support = translate(id, "botPaySupport");
      assert.equal(support.includes("between-journal.ru"), false, id);
      assert.equal(support.includes(LEGAL_INN), false, id);
    }
  });

  it("recognizes the public paths", () => {
    assert.equal(isLegalPath("/terms/"), true);
    assert.equal(isLegalPath("/privacy"), true);
    assert.equal(isLegalPath("/journal"), false);
    assert.equal(isQuietPath("/reset"), true);
    assert.equal(isQuietPath("/delete"), true);
    assert.equal(isLegalPath("/delete"), false);
    assert.equal(isQuietPath("/journal"), false);
  });
});
