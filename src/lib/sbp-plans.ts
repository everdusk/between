/** Ruble prices from the checkout mockup. Stars keep their own formula. */
export const SBP_PLANS = {
  month: { rub: 299, perMonth: 299, title: "Месяц", span: "на месяц" },
  quarter: { rub: 750, perMonth: 250, title: "3 месяца", span: "на 3 месяца", popular: true },
  year: { rub: 2388, perMonth: 199, title: "Год", span: "на год", off: 33 },
} as const;

export type SbpPlanId = keyof typeof SBP_PLANS;

export function isSbpPlan(value: unknown): value is SbpPlanId {
  return value === "month" || value === "quarter" || value === "year";
}

export function sbpMoney(rub: number): string {
  return `${rub}.00`;
}
