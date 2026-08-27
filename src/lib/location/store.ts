"use client";

import { create } from "zustand";

import { BUSINESS_CITIES, type BusinessCity } from "@/lib/constants/cities";

const STORAGE_KEY = "bookly.selectedCity";

/**
 * Batch 17 — the one real geographic signal the product has: the city the visitor picked in
 * the hero search bar. It drives the homepage "Services near you" row. Persisted to
 * localStorage so the choice survives a reload (the same lightweight convenience pattern the
 * auth token-memory / PWA-install code uses). No coordinates, no geolocation prompt.
 */
export interface LocationState {
  selectedCity: BusinessCity | null;
  setSelectedCity: (city: BusinessCity | null) => void;
}

/** Maps a free-form label from the search bar ("Pafos, Cyprus", "larnaca") to the canonical
 * `BusinessCity` the backend validates, or null when it isn't one of the six real cities. */
export const resolveBusinessCity = (input: string | null | undefined): BusinessCity | null => {
  if (!input) return null;
  const head = input.split(",")[0]?.trim().toLowerCase() ?? "";
  if (head === "pafos") return "Paphos";
  return BUSINESS_CITIES.find((city) => city.toLowerCase() === head) ?? null;
};

const readPersistedCity = (): BusinessCity | null => {
  if (typeof window === "undefined") return null;
  try {
    return resolveBusinessCity(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
};

export const useLocationStore = create<LocationState>((set) => ({
  selectedCity: readPersistedCity(),
  setSelectedCity: (city) => {
    if (typeof window !== "undefined") {
      try {
        if (city) window.localStorage.setItem(STORAGE_KEY, city);
        else window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Non-fatal — persistence is a convenience, not a requirement.
      }
    }
    set({ selectedCity: city });
  },
}));
