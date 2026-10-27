import type { CatalogService } from "@/lib/api/catalog";

/** What the Venue stepper has stored for one Service. A missing field means the Customer has
 * not touched that stepper, NOT that the quantity is absent. */
export type VenuePricingInput = { hours?: number; personCount?: number };

const clamp = (value: number | undefined, min: number, max: number): number => {
  const candidate = typeof value === "number" && Number.isFinite(value) ? value : min;
  return Math.min(Math.max(candidate, min), Math.max(min, max));
};

/** The single source of truth for the quantity this Service is booked with. The stepper
 * display, price estimate, availability quantities and booking request all read
 * it, so what the Customer sees is exactly what is sent.
 *
 * Mirrors BookingCreationService's own branching: a Package Deal takes no quantity (checked
 * first), HOURLY takes only `hours`, PER_PERSON takes only `personCount`, FIXED takes neither.
 * An untouched stepper resolves to the Service minimum (the value the UI already displays).
 * A stored value outside the Service's current min/max (e.g. after a catalog change) is
 * clamped. The server still validates everything; this only stops the client from sending an
 * incomplete or inconsistent request. */
export function effectivePricingInput(
  service: CatalogService,
  stored: VenuePricingInput | undefined,
): VenuePricingInput {
  if (service.isPackageDeal) return {};
  if (service.pricingMode === "HOURLY" && service.hourlyPricing) {
    const { minHours, maxHours } = service.hourlyPricing;
    return { hours: clamp(stored?.hours, minHours, maxHours) };
  }
  if (service.pricingMode === "PER_PERSON" && service.perPersonPricing) {
    const { minPersons, maxPersons } = service.perPersonPricing;
    return { personCount: clamp(stored?.personCount, minPersons, maxPersons) };
  }
  return {};
}

/** One stepper press (+1 / -1) from the effective value, kept inside the Service's min/max. */
export function stepPricingInput(
  service: CatalogService,
  stored: VenuePricingInput | undefined,
  delta: 1 | -1,
): VenuePricingInput {
  const current = effectivePricingInput(service, stored);
  if (current.hours !== undefined) return effectivePricingInput(service, { hours: current.hours + delta });
  if (current.personCount !== undefined) {
    return effectivePricingInput(service, { personCount: current.personCount + delta });
  }
  return current;
}

/** The availability `partySize` for this Service: the effective person count for a PER_PERSON
 * (group) Service, otherwise undefined so the parameter is omitted. The API only accepts a party
 * size up to the Service's capacity, which is 1 for every non-group Service. */
export function availabilityPartySize(
  service: CatalogService,
  stored: VenuePricingInput | undefined,
): number | undefined {
  return effectivePricingInput(service, stored).personCount;
}

/** Same duration authority as the visible stepper and booking payload. */
export function availabilityHours(
  service: CatalogService,
  stored: VenuePricingInput | undefined,
): number | undefined {
  return effectivePricingInput(service, stored).hours;
}
