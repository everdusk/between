import { GuideCards, GuideFrame } from "@/components/journal-guide";
import { guideIndex, guideMetadata } from "@/lib/guides";

export const metadata = guideMetadata();

export default function GuideIndexPage() {
  return <GuideFrame>
    <header className="guide-title">
      <h1>{guideIndex.title}</h1>
      <p className="guide-intro">С чего начать запись, как разобраться в своих чувствах и что взять на встречу с психологом.</p>
    </header>
    <GuideCards />
  </GuideFrame>;
}
