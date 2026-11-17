import { WebApp } from "@/components/web-app";
import { rubPriceFromEnv, starPriceFromEnv } from "@/lib/week-access";

export default function Home() {
  return <WebApp starPrice={starPriceFromEnv(process.env.WEEK_STAR_PRICE)} rubPrice={rubPriceFromEnv(process.env.WEEK_RUB_PRICE)} />;
}
