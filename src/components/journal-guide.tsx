import type { ReactNode } from "react";
import { guides } from "@/lib/guides";
import { GuideStart } from "./guide-start";
import "./journal-guide.css";

export function JournalGuide({ topic, children }: { topic: keyof typeof guides; children: ReactNode }) {
  return <main className="journal-guide">
    <div className="guide-column">
      <header><a href="/" aria-label="Between — на главную">Between</a></header>
      <article>
        <h1>{guides[topic].title}</h1>
        {children}
        <GuideStart placement={`guide_${topic}`} />
      </article>
      <footer>Читайте также<ul>{Object.entries(guides).filter(([key]) => key !== topic).map(([, guide]) =>
        <li key={guide.path}><a href={guide.path}>{guide.title}</a></li>)}</ul></footer>
    </div>
  </main>;
}
