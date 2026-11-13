import type { LocaleId } from "./i18n";
import { translate } from "./messages";
import { rubPriceFromEnv, starPriceFromEnv } from "./week-access";

/** Welcome caption. Telegram uses WEEK_STAR_PRICE, MAX uses WEEK_RUB_PRICE. */
export function welcomeCaption(locale: LocaleId, kind: "telegram" | "max" = "telegram"): string {
  const price =
    kind === "max"
      ? rubPriceFromEnv(process.env.WEEK_RUB_PRICE)
      : starPriceFromEnv(process.env.WEEK_STAR_PRICE);
  return translate(locale, kind === "max" ? "botHelpMax" : "botHelp", { price });
}
