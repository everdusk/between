import { LandingPage } from "@/components/landing-page";
import { LANDING_OPEN_URL } from "@/lib/landing";
import { landingQrSvg } from "@/lib/landing-qr";

export default async function AboutLanding() {
  return <LandingPage qr={await landingQrSvg(LANDING_OPEN_URL)} />;
}
