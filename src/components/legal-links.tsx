"use client";

import { useI18n } from "@/components/locale-provider";
import { LEGAL_INN } from "@/lib/legal";
import { JOURNAL_PRIVACY } from "@/lib/legal";
import { TELEGRAM_PRIVACY } from "@/lib/telegram-privacy";
import { ATTRIBUTION_PRIVACY } from "@/lib/legal-attribution";

export function LegalLinks({ className, telegram }: { className?: string; telegram?: boolean }) {
  const { t, locale } = useI18n();
  if (telegram) {
    const doc = TELEGRAM_PRIVACY[locale];
    return <details className={className}><summary className="cursor-pointer underline">{doc.title}</summary>
      <article className="mt-3 space-y-3 text-start text-sm">{doc.sections.map(section=><section key={section.heading}><h3 className="font-semibold">{section.heading}</h3>{section.paragraphs.map(p=><p key={p}>{p}</p>)}</section>)}<p>{JOURNAL_PRIVACY[locale]}</p><p>{ATTRIBUTION_PRIVACY[locale].paragraph}</p></article>
    </details>;
  }
  return (
    <p className={className}>
      <a href="/terms" className="underline underline-offset-4">
        {t("legalTerms")}
      </a>
      <span aria-hidden> · </span>
      <a href="/privacy" className="underline underline-offset-4">
        {t("legalPrivacy")}
      </a>
      <span aria-hidden> · </span>
      {t("legalInn", { inn: LEGAL_INN })}
    </p>
  );
}

export function LegalAgree({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={className}>
      {t("legalAgree")}{" "}
      <a href="/terms" className="underline underline-offset-4">
        {t("legalTermsInline")}
      </a>{" "}
      {t("legalAnd")}{" "}
      <a href="/privacy" className="underline underline-offset-4">
        {t("legalPrivacyInline")}
      </a>
      .
    </p>
  );
}
