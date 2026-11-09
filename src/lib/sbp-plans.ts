import { DEFAULT_RUB_PRICE, planPrice, type PremiumPlan } from "./week-access";

/**
 * Browser and MAX ruble tariffs. Same formula as before the checkout mockup:
 * a month is full price, three months are 20% off, a year is 50% off.
 */
export type SbpPlanId = PremiumPlan;

export type SbpPlan = {
  rub: number;
  perMonth: number;
  title: string;
  span: string;
  popular?: boolean;
  off?: number;
};

export function sbpCatalog(monthly = DEFAULT_RUB_PRICE): Record<SbpPlanId, SbpPlan> {
  const month = planPrice(monthly, "month");
  const quarter = planPrice(monthly, "quarter");
  const year = planPrice(monthly, "year");
  return {
    month: { rub: month, perMonth: month, title: "Месяц", span: "на месяц" },
    quarter: {
      rub: quarter,
      perMonth: Math.round(quarter / 3),
      title: "3 месяца",
      span: "на 3 месяца",
      popular: true,
    },
    year: {
      rub: year,
      perMonth: Math.round(year / 12),
      title: "Год",
      span: "на год",
      off: 50,
    },
  };
}

export const SBP_PLANS = sbpCatalog();

export function isSbpPlan(value: unknown): value is SbpPlanId {
  return value === "month" || value === "quarter" || value === "year";
}

export function sbpMoney(rub: number): string {
  return `${rub}.00`;
}
