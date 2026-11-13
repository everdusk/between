import { JournalApp } from "./journal-app";
import { rubPriceFromEnv, starPriceFromEnv } from "@/lib/week-access";

export default function JournalPage() {
  return (
    <JournalApp
      starPrice={starPriceFromEnv(process.env.WEEK_STAR_PRICE)}
      rubPrice={rubPriceFromEnv(process.env.WEEK_RUB_PRICE)}
    />
  );
}
