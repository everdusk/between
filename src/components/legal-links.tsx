"use client";

import { useI18n } from "@/components/locale-provider";

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
      <a href="/personal-data" className="underline underline-offset-4">{t("legalProcessing")}</a>
    </p>
  );
}

export function LegalAgree({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={className}>
      {t("legalAgree")}{" "}
      <a href="/personal-data" className="underline underline-offset-4">{t("legalProcessingInline")}</a>
      {t("legalAgreeAlso")}{" "}
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
