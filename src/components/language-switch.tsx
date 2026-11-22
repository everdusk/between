"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { FieldSelect } from "@/components/ui/field-select";
import { LOCALES } from "@/lib/i18n";
import { telegramSelection } from "@/lib/telegram";

export function LanguageSwitch({ inline = false }: { inline?: boolean }) {
  const { t, locale, setLocale, publicLanguages } = useI18n();
  const options = LOCALES
    .filter(item => !publicLanguages || item.id === "ru" || item.id === "en")
    .map(item => ({ value: item.id, label: item.label, dir: item.dir }));

  return (
    <FieldSelect label={t("language")} value={locale} options={options}
      leadingIcon={<Languages aria-hidden size={16} />}
      triggerClassName={`glass-chrome preference-control ${inline ? "" : "language-compact"}`}
      onOpenChange={open => { if (open) telegramSelection(); }}
      onChange={next => { telegramSelection(); setLocale(next); }} />
  );
}
