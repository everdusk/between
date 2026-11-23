"use client";

import { BrandLogo } from "./brand-logo";
import { useLayoutEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/components/locale-provider";
import "@/app/journal/theme.css";
import { LEGAL_SURFACE_CSS } from "@/lib/landing";
import { legalDocument, type LegalKind } from "@/lib/legal";
import { markSplashReady } from "@/lib/splash";

export function LegalDocument({ kind }: { kind: LegalKind }) {
  const { locale, t } = useI18n();
  const doc = legalDocument(kind, locale);
  const links = [["terms", "legalTerms"], ["privacy", "legalPrivacy"], ["personal-data", "legalProcessing"]] as const;

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
          <a href="/" className="font-display text-lg text-foreground">
            <BrandLogo />
          </a>
        </header>
        <nav className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {links.filter(([path]) => path !== kind).map(([path, label]) =>
            <Link key={path} href={`/${path}`} className="underline underline-offset-4">{t(label)}</Link>)}
        </nav>
        {doc.preface?.map((line) => (
          <p key={line} className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {line}
          </p>
        ))}
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{doc.updated}</p>
        <div className="mt-8 space-y-7">
          {doc.paragraphs?.map(paragraph => <p key={paragraph} className="text-sm leading-relaxed text-foreground/90">{paragraph}</p>)}
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
      </div>
    </article>
  );
}
