import { type LocaleId } from "./i18n";
import { WEB_PRIVACY, WEB_TERMS } from "./legal-web";

export const LEGAL_INN = "770507475005";
export const LEGAL_NAME = "Ляторовская Анастасия Борисовна";
export const LEGAL_TERMS_URL = "https://www.between-journal.ru/terms";
export const LEGAL_PRIVACY_URL = "https://www.between-journal.ru/privacy";
export const LEGAL_EMAIL = "help@between-journal.ru";
export const LEGAL_DELETE_URL = "https://www.between-journal.ru/delete";

export type LegalKind = "terms" | "privacy";
export type LegalSection = { heading: string; paragraphs: string[] };
export type LegalDoc = { title: string; updated: string; preface?: string[]; sections: LegalSection[] };

/** Site and MAX share this edition. Telegram builds its own documents inside the client. */
export function legalDocument(kind: LegalKind, locale: LocaleId): LegalDoc {
  const book = kind === "terms" ? WEB_TERMS : WEB_PRIVACY;
  return book[locale] ?? book.ru;
}

export function legalLocales(): LocaleId[] {
  return Object.keys(WEB_TERMS) as LocaleId[];
}
