import type { LocaleId } from "./i18n";
import { translate } from "./messages";
import { planPrice, rubPriceFromEnv, starPriceFromEnv } from "./week-access";

/** Welcome caption, including the prices the app already charges. */
export function welcomeCaption(locale: LocaleId, kind: "telegram" | "max" = "telegram"): string {
  const stars = starPriceFromEnv(process.env.WEEK_STAR_PRICE);
  const rub = rubPriceFromEnv(process.env.WEEK_RUB_PRICE);
  const body = translate(locale, kind === "max" ? "botHelpMax" : "botHelp");
  const price = translate(locale, "botHelpPrice", {
    monthStars: planPrice(stars, "month"),
    monthRub: planPrice(rub, "month"),
    quarterStars: planPrice(stars, "quarter"),
    quarterRub: planPrice(rub, "quarter"),
    yearStars: planPrice(stars, "year"),
    yearRub: planPrice(rub, "year"),
  });
  return `${body}\n\n${price}`;
}
