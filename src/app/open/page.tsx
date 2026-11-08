import type { Metadata } from "next";
import { OpenFork } from "@/components/landing-open";

export const metadata: Metadata = {
  title: { absolute: "Где открыть Between" },
  description: "Откройте дневник Between в Telegram или в MAX. MAX работает без VPN.",
  alternates: { canonical: "/open" },
  robots: { index: false, follow: false },
};

export default function OpenPage() {
  return <OpenFork />;
}
