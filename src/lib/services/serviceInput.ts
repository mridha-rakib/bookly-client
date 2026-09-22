import type { Service, ServiceFixedPricing, ServiceInput, ServicePerPersonPricing, ServicePackagePricing } from "@/lib/api/services";

/**
 * Maps an already-persisted Service DTO back into the exact `ServiceInput` shape its own
 * PATCH endpoint requires. Needed because Service update is full-replace, not a partial
 * merge (see service.schema.ts / service.repository.ts on the API side) — any editor that
 * only shows a subset of a Service's fields (Business Profile's Booking Time Control shows
 * only scheduling) must still resend every other field unchanged, or risk losing it.
 *
 * Deliberately separate from ServiceForm's own `buildServiceInput`, which builds a Service
 * from its text-based form state — that function must keep building from the form exactly
 * as it does today (ServiceForm shows every field, so it has no "fields I can't see" problem
 * to solve), so re-deriving edit-mode saves through this mapper instead would be a real
 * behavior change to already-working code for no benefit. This mapper exists only for a
 * consumer that edits a strict subset of a full Service.
 */
export const serviceToInput = (service: Service): ServiceInput => {
  const base: ServiceInput = {
    status: service.status === "ARCHIVED" ? "INACTIVE" : service.status,
    isFeatured: service.isFeatured,
    isPackageDeal: service.isPackageDeal,
    ...(service.serviceCategoryId ? { serviceCategoryId: service.serviceCategoryId } : {}),
    ...(service.subcategory ? { subcategory: service.subcategory } : {}),
    name: service.name,
    ...(service.packageServicesName ? { packageServicesName: service.packageServicesName } : {}),
    ...(service.description ? { description: service.description } : {}),
    sessionExpiryAlert: service.sessionExpiryAlert,
    scheduleMode: service.scheduleMode,
    ...(service.scheduleMode === "MANUAL" ? { manualSchedule: service.manualSchedule } : {}),
    servedCities: service.servedCities,
    assignedStaffMembershipIds: service.assignedStaff.map((staff) => staff.membershipId)
  };

  if (service.isPackageDeal) {
    return { ...base, ...(service.packagePricing ? { packagePricing: service.packagePricing } : {}) };
  }

  return {
    ...base,
    ...(service.pricingMode ? { pricingMode: service.pricingMode } : {}),
    ...(service.pricingMode === "FIXED" && service.fixedPricing ? { fixedPricing: service.fixedPricing } : {}),
    ...(service.pricingMode === "HOURLY" && service.hourlyPricing ? { hourlyPricing: service.hourlyPricing } : {}),
    ...(service.pricingMode === "PER_PERSON" && service.perPersonPricing
      ? { perPersonPricing: service.perPersonPricing }
      : {})
  };
};

export type ActiveBookingIntervalConfig = {
  /** The Service's own duration for whichever pricing block is active — the fallback value
   * AvailabilityService itself uses when `bookingIntervalMin` is unset. */
  durationMin: number;
  bookingIntervalMin: number | undefined;
  /** Builds the ServiceInput patch that updates only the interval within the currently
   * active pricing block, preserving every other field of that block untouched. */
  apply: (rawMinutesText: string) => Partial<ServiceInput>;
};

const parseIntervalText = (text: string): number | undefined => {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : undefined;
};

/**
 * Returns null when the Service has no real `bookingIntervalMin` concept to edit — currently
 * only HOURLY pricing (no such field exists on `ServiceHourlyPricing` — see service.model.ts)
 * or a Service whose active pricing block hasn't been configured yet. Never fabricates a
 * control for a field the persisted model doesn't support.
 */
export const getActiveBookingIntervalConfig = (service: Service): ActiveBookingIntervalConfig | null => {
  if (service.isPackageDeal) {
    const pricing = service.packagePricing;
    if (!pricing) return null;
    return {
      durationMin: pricing.durationMin,
      bookingIntervalMin: pricing.bookingIntervalMin,
      apply: (rawMinutesText) => buildPackagePatch(pricing, parseIntervalText(rawMinutesText))
    };
  }

  switch (service.pricingMode) {
    case "FIXED": {
      const pricing = service.fixedPricing;
      if (!pricing) return null;
      return {
        durationMin: pricing.durationMin,
        bookingIntervalMin: pricing.bookingIntervalMin,
        apply: (rawMinutesText) => buildFixedPatch(pricing, parseIntervalText(rawMinutesText))
      };
    }
    case "PER_PERSON": {
      const pricing = service.perPersonPricing;
      if (!pricing) return null;
      return {
        durationMin: pricing.durationMin,
        bookingIntervalMin: pricing.bookingIntervalMin,
        apply: (rawMinutesText) => buildPerPersonPatch(pricing, parseIntervalText(rawMinutesText))
      };
    }
    default:
      // HOURLY has no bookingIntervalMin field at all; pricingMode unset means the Service
      // isn't configured enough yet to safely edit its interval from here.
      return null;
  }
};

// Each builder drops the pricing block's OWN `bookingIntervalMin` before re-spreading it —
// clearing the control back to "Default" must actually omit the field from the payload, not
// silently resend whatever value the fetched Service already had.

const omitBookingInterval = <T extends { bookingIntervalMin?: number }>(pricing: T): T => {
  const clone = { ...pricing };
  delete clone.bookingIntervalMin;
  return clone;
};

const buildFixedPatch = (pricing: ServiceFixedPricing, bookingIntervalMin: number | undefined): Partial<ServiceInput> => ({
  fixedPricing: { ...omitBookingInterval(pricing), ...(bookingIntervalMin !== undefined ? { bookingIntervalMin } : {}) }
});

const buildPerPersonPatch = (
  pricing: ServicePerPersonPricing,
  bookingIntervalMin: number | undefined
): Partial<ServiceInput> => ({
  perPersonPricing: {
    ...omitBookingInterval(pricing),
    ...(bookingIntervalMin !== undefined ? { bookingIntervalMin } : {})
  }
});

const buildPackagePatch = (
  pricing: ServicePackagePricing,
  bookingIntervalMin: number | undefined
): Partial<ServiceInput> => ({
  packagePricing: {
    ...omitBookingInterval(pricing),
    ...(bookingIntervalMin !== undefined ? { bookingIntervalMin } : {})
  }
});
