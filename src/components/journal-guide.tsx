/* eslint-disable @next/next/no-html-link-for-pages -- The homepage selects the public landing or saved diary in its document boot script. */
import type { ReactNode } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { guideIndex, guides, guideSchema, type GuideTopic } from "@/lib/guides";
import { BrandLogo } from "./brand-logo";
import { SchemeSwitch } from "./scheme-switch";
import { GuideStart } from "./guide-start";
import "./journal-guide.css";

export function GuideFrame({ children }: { children: ReactNode }) {
  return <div className="journal-guide">
    <header className="guide-masthead">
      <a href="/" aria-label="Between — на главную"><BrandLogo /></a>
      <SchemeSwitch />
    </header>
    <main className="guide-main">{children}</main>
  </div>;
}

export function GuideCards({ except }: { except?: GuideTopic }) {
  return <ul className="guide-cards">{Object.entries(guides).filter(([key]) => key !== except).map(([, guide]) =>
    <li key={guide.path}><a className="glass" href={guide.path}>
      <span>{guide.shortTitle}<ArrowUpRight size={18} aria-hidden /></span>
      <p>{guide.description}</p>
    </a></li>
  )}</ul>;
}

export function JournalGuide({ topic, children }: { topic: GuideTopic; children: ReactNode }) {
  const guide = guides[topic];
  return <GuideFrame>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideSchema(topic)).replace(/</g, "\\u003c") }} />
    <article>
      <header className="guide-title">
        <nav className="guide-crumbs" aria-label="Навигационная цепочка">
          <a href="/">Главная</a><ChevronRight aria-hidden size={14} /><a href={guideIndex.path}>Статьи</a>
          <ChevronRight aria-hidden size={14} /><span aria-current="page">{guide.shortTitle}</span>
        </nav>
        <h1>{guide.title}</h1>
        <p className="guide-byline">Редакция Between</p>
      </header>
      <div className="guide-prose glass-strong">{children}<GuideStart placement={`guide_${topic}`} /></div>
    </article>
    <nav className="guide-related" aria-label="Читайте также"><h2>Читайте также</h2><GuideCards except={topic} /></nav>
  </GuideFrame>;
}
