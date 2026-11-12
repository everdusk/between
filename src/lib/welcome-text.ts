import type { LocaleId } from "./i18n";
import { translate } from "./messages";
import { rubPriceFromEnv } from "./week-access";

/** Welcome caption. The monthly ruble price comes from WEEK_RUB_PRICE. */
export function welcomeCaption(locale: LocaleId, kind: "telegram" | "max" = "telegram"): string {
  return translate(locale, kind === "max" ? "botHelpMax" : "botHelp", {
    price: rubPriceFromEnv(process.env.WEEK_RUB_PRICE),
  });
}
