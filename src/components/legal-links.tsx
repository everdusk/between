"use client";

import { useI18n } from "@/components/locale-provider";
import { LEGAL_INN } from "@/lib/legal";

export function LegalLinks({ className, telegram }: { className?: string; telegram?: boolean }) {
  const { t } = useI18n();
  if (telegram) return null;
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
      . <span className="whitespace-nowrap">{t("legalInn", { inn: LEGAL_INN })}</span>
    </p>
  );
}
