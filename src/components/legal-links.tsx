"use client";

import { useI18n } from "@/components/locale-provider";
import { LEGAL_INN, type LegalSurface } from "@/lib/legal";

function legalHref(path: "/terms" | "/privacy", surface: LegalSurface): string {
  return surface === "telegram" ? `${path}?from=telegram` : path;
}

export function LegalLinks({ className, surface = "web" }: { className?: string; surface?: LegalSurface }) {
  const { t } = useI18n();
  return (
    <p className={className}>
      <a href={legalHref("/terms", surface)} className="underline underline-offset-4">
        {t("legalTerms")}
      </a>
      <span aria-hidden> · </span>
      <a href={legalHref("/privacy", surface)} className="underline underline-offset-4">
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
