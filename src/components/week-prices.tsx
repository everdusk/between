"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_RUB_PRICE, DEFAULT_STAR_PRICE } from "@/lib/week-access";

const WeekPrices = createContext({ starPrice: DEFAULT_STAR_PRICE, rubPrice: DEFAULT_RUB_PRICE });

/** Prices read from the server env. The client bundle cannot see `WEEK_RUB_PRICE`. */
export function WeekPriceProvider({
  starPrice,
  rubPrice,
  children,
}: {
  starPrice: number;
  rubPrice: number;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ starPrice, rubPrice }), [starPrice, rubPrice]);
  return <WeekPrices.Provider value={value}>{children}</WeekPrices.Provider>;
}

export function useWeekPrices(): { starPrice: number; rubPrice: number } {
  return useContext(WeekPrices);
}
