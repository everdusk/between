"use client";

import { useLayoutEffect } from "react";
import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { LocaleProvider, useI18n } from "@/components/locale-provider";
import "@/app/journal/theme.css";
import { LEGAL_SURFACE_CSS } from "@/lib/landing";
import { LEGAL_INN, legalDocument, type LegalKind } from "@/lib/legal";
import { markSplashReady } from "@/lib/splash";

function LegalArticle({ kind }: { kind: LegalKind }) {
  const { locale, t } = useI18n();
  const doc = legalDocument(kind, locale);
  const otherHref = kind === "terms" ? "/privacy" : "/terms";
  const otherLabel = kind === "terms" ? t("legalPrivacy") : t("legalTerms");

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-between", "app");
    root.setAttribute("data-journal", "web");
    root.setAttribute("data-scheme", "night");
    root.removeAttribute("data-splash");
    const style = document.getElementById("between-surface");
    if (style) style.textContent = LEGAL_SURFACE_CSS;
    markSplashReady();
  }, []);

  return (
    <article className="fixed inset-0 z-20 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-5 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-lg text-foreground">
            Between
          </Link>
          <LanguageSwitch />
        </header>
        <p className="mt-8 text-sm">
          <Link href={otherHref} className="underline underline-offset-4">
            {otherLabel}
          </Link>
        </p>
        {doc.preface?.map((line) => (
          <p key={line} className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {line}
          </p>
        ))}
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{doc.updated}</p>
        <div className="mt-8 space-y-7">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl leading-snug">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">{t("legalInn", { inn: LEGAL_INN })}</p>
      </div>
    </article>
  );
}

export function LegalDocument({ kind }: { kind: LegalKind }) {
  return (
    <LocaleProvider telegramLanguage={null} initData="">
      <LegalArticle kind={kind} />
    </LocaleProvider>
  );
}
