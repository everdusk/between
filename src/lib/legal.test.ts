import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LOCALES } from "./i18n";
import { isLegalPath, isQuietPath } from "./landing";
import { LEGAL_EMAIL, LEGAL_INN, LEGAL_NAME, legalDocument } from "./legal";
import { translate } from "./messages";

const BINDING = "Если формулировки разойдутся, главный текст — на русском языке.";

function textOf(kind: "terms" | "privacy", id: (typeof LOCALES)[number]["id"]): string {
  const doc = legalDocument(kind, id);
  return [doc.title, doc.updated, ...(doc.preface ?? []), ...doc.sections.flatMap((section) => [section.heading, ...section.paragraphs])].join("\n");
}

describe("legal documents", () => {
  it("names the operator in every language", () => {
    assert.equal(LOCALES.length, 12);
    for (const { id } of LOCALES) {
      for (const kind of ["terms", "privacy"] as const) {
        const doc = legalDocument(kind, id);
        assert.equal(doc.sections.length, 14, `${id} ${kind}`);
        const text = textOf(kind, id);
        assert.ok(text.includes(LEGAL_INN), `${id} ${kind} inn`);
        assert.ok(text.includes(LEGAL_EMAIL), `${id} ${kind} email`);
        assert.ok(text.includes("Ляторовская"), `${id} ${kind} name`);
        assert.equal(/\bVK\b|Сбер|Sber|Яндекс ID|Yandex ID/.test(text), false, `${id} ${kind} oauth`);
        assert.equal(text.includes("Telegram Stars"), false, `${id} ${kind} stars`);
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
    const terms = textOf("terms", "ru");
    assert.ok(terms.includes("Условия являются публичной офертой"));
    assert.ok(terms.includes("Оплата в Веб-версии выполняется через платёжный сервис ЮKassa."));
    assert.ok(terms.includes("Настоящие Условия не распространяются на Telegram-версию."));
    assert.ok(terms.includes("номер 112"));
    const privacy = textOf("privacy", "ru");
    assert.ok(privacy.includes("Федеральным законом от 27.07.2006 № 152-ФЗ"));
    assert.ok(privacy.includes("Настоящая Политика на Telegram-версию не распространяется."));
    assert.ok(privacy.includes("Роскомнадзор"));
    assert.ok(privacy.includes("ЮKassa"));
    assert.equal(terms.includes("Telegram Stars"), false);
  });

  it("recognizes the public paths", () => {
    assert.equal(isLegalPath("/terms/"), true);
    assert.equal(isLegalPath("/privacy"), true);
    assert.equal(isLegalPath("/journal"), false);
    assert.equal(isQuietPath("/reset"), true);
    assert.equal(isQuietPath("/delete"), true);
    assert.equal(isQuietPath("/open"), true);
    assert.equal(isQuietPath("/subscribe"), true);
    assert.equal(isLegalPath("/delete"), false);
    assert.equal(isQuietPath("/journal"), false);
  });
});
