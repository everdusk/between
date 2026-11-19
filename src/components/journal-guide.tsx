import type { ReactNode } from "react";
import { guides } from "@/lib/guides";
import { GuideStart } from "./guide-start";
import "./journal-guide.css";

export function JournalGuide({ topic, children }: { topic: keyof typeof guides; children: ReactNode }) {
  const other = guides[topic === "emotions" ? "therapy" : "emotions"];
  return <main className="journal-guide">
    <div className="guide-column">
      <header><a href="/" aria-label="Between — на главную">Between</a></header>
      <article>
        <h1>{guides[topic].title}</h1>
        {children}
        <GuideStart placement={topic === "emotions" ? "guide_emotions" : "guide_therapy"} />
      </article>
      <footer>Читайте также<br /><a href={other.path}>{other.title}</a></footer>
    </div>
  </main>;
}
