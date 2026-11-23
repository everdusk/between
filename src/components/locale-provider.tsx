"use client";

import type { LocaleId } from "@/lib/i18n";
import { countPhrase, feelingLabel, translate, type MessageKey } from "@/lib/messages";
import type { CheckinSlot, Feeling } from "@/lib/types";

const slotKeys = { morning: "slotMorning", day: "slotDay", evening: "slotEvening" } as const;
const russian = {
  locale: "ru" as LocaleId,
  t: (key: MessageKey, vars?: Record<string, string | number | undefined>) => translate("ru", key, vars),
  count: (amount: number, stem: "day" | "note") => countPhrase("ru", amount, stem),
  feeling: (feeling: Feeling) => feelingLabel("ru", feeling),
  slot: (slot: CheckinSlot) => translate("ru", slotKeys[slot]),
};

export function useI18n() {
  return russian;
}
