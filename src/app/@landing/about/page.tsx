import { LandingPage } from "@/components/landing-page";
import { landingJsonLd } from "@/lib/landing-seo";

export default function AboutLanding() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: landingJsonLd() }} />
    <LandingPage />
  </>;
}
