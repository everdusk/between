import { LandingPage } from "@/components/landing-page";
import { LANDING_OPEN_URL } from "@/lib/landing";
import { landingQrSvg } from "@/lib/landing-qr";

/** The public page. The journal routes leave this slot empty. */
export default async function LandingSlot() {
  const qr = await landingQrSvg(LANDING_OPEN_URL);
  return <LandingPage qr={qr} />;
}
