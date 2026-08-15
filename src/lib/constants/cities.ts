// Canonical business city list. Keep in sync with `businessCities` in
// api/src/modules/business/business.types.ts — both must agree so that a
// frontend selection is always accepted by backend validation.
export const BUSINESS_CITIES = [
  "Larnaca",
  "Limassol",
  "Nicosia",
  "Paphos",
  "Ayia Napa",
  "Protaras",
] as const;

export type BusinessCity = (typeof BUSINESS_CITIES)[number];
