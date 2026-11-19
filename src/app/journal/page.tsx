import { JournalApp } from "./journal-app";
import type { Metadata } from "next";
import { rubPriceFromEnv, starPriceFromEnv } from "@/lib/week-access";

export const metadata: Metadata = {
  title: "Мой дневник — Between",
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};

export default function JournalPage() {
  return (
    <JournalApp
      starPrice={starPriceFromEnv(process.env.WEEK_STAR_PRICE)}
      rubPrice={rubPriceFromEnv(process.env.WEEK_RUB_PRICE)}
    />
  );
}
