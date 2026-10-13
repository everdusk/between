import type { Feeling } from "@/lib/types";
import { fill, localeMeta, type LocaleId } from "@/lib/i18n";
import { ar } from "./ar";
import { en } from "./en";
import { es } from "./es";
import { fa } from "./fa";
import { hi } from "./hi";
import { id } from "./id";
import { pt } from "./pt";
import { ru, type Catalog, type MessageKey } from "./ru";
import { tr } from "./tr";
import { uk } from "./uk";
import { uz } from "./uz";
import { vi } from "./vi";

export type { Catalog, MessageKey };

const CATALOGS: Record<LocaleId, Catalog> = {
  ru,
  en,
  hi,
  id,
  pt,
  ar,
  es,
  vi,
  uk,
  tr,
  fa,
  uz,
};

const PLURAL: Record<Intl.LDMLPluralRule, "One" | "Two" | "Few" | "Many" | "Other" | "Zero"> = {
  zero: "Zero",
  one: "One",
  two: "Two",
  few: "Few",
  many: "Many",
  other: "Other",
};

export function translate(
  locale: LocaleId,
  key: MessageKey,
  vars?: Record<string, string | number | undefined>,
): string {
  const template = CATALOGS[locale][key] ?? CATALOGS.ru[key];
  return vars ? fill(template, vars) : template;
}

export function countPhrase(locale: LocaleId, count: number, stem: "day" | "note"): string {
  const rule = new Intl.PluralRules(localeMeta(locale).intl).select(count);
  const key = `${stem}${PLURAL[rule]}` as MessageKey;
  return `${count} ${translate(locale, key)}`;
}

const FEELING_KEY = {
  тревожно: "feelingAnxious",
  спокойно: "feelingCalm",
  злость: "feelingAnger",
  грусть: "feelingSadness",
  радость: "feelingJoy",
  усталость: "feelingTired",
  стыд: "feelingShame",
  пусто: "feelingEmpty",
  напряжение: "feelingTension",
  тяжело: "feelingHeavy",
} as const satisfies Record<Feeling, MessageKey>;

export function feelingLabel(locale: LocaleId, feeling: Feeling): string {
  return translate(locale, FEELING_KEY[feeling]);
}

export function catalogKeys(): MessageKey[] {
  return Object.keys(ru) as MessageKey[];
}

export function catalogsShareKeys(): boolean {
  const expected = catalogKeys().length;
  return (Object.keys(CATALOGS) as LocaleId[]).every(
    (locale) => Object.keys(CATALOGS[locale]).length === expected,
  );
}
