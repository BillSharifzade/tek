"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CITIES = ["Душанбе", "Худжанд"] as const;
export type City = (typeof CITIES)[number];

interface CityState {
  city: City;
  setCity: (c: City) => void;
}

export const useCity = create<CityState>()(
  persist(
    (set) => ({
      city: "Душанбе",
      setCity: (city) => set({ city }),
    }),
    { name: "tek_city_v1" },
  ),
);

/** "В Душанбе" / "В Худжанде" */
export function inCity(city: string): string {
  if (city === "Душанбе") return "В Душанбе";
  if (city === "Худжанд") return "В Худжанде";
  return `В ${city}`;
}
