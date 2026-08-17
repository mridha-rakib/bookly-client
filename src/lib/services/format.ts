import type { AssignedServiceStaff, Service } from "@/lib/api/services";
import type { BusinessCity } from "@/lib/constants/cities";

/** Integer-cents <-> "12.00" euro text, matching the existing convention in
 * DashboardCreateBusiness.tsx's Travel Fees section (centsToFeeText/feeTextToCents). */
export const centsToEuroText = (cents: number): string => (cents / 100).toFixed(2);

export const euroTextToCents = (value: string): number | null => {
  const normalized = value.trim();

  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
    return null;
  }

  return Math.round(Number(normalized) * 100);
};

export const formatEuro = (cents: number): string => `€${centsToEuroText(cents)}`;

/** Price + suffix shown at the top of a Service card, e.g. "€120", "€50 /per hour". */
export const formatServicePrice = (service: Service): { amount: string; suffix?: string } => {
  if (service.isPackageDeal && service.packagePricing) {
    return { amount: formatEuro(service.packagePricing.bundlePriceCents) };
  }
  if (service.pricingMode === "FIXED" && service.fixedPricing) {
    return { amount: formatEuro(service.fixedPricing.priceCents) };
  }
  if (service.pricingMode === "HOURLY" && service.hourlyPricing) {
    return { amount: formatEuro(service.hourlyPricing.ratePerHourCents), suffix: "/per hour" };
  }
  if (service.pricingMode === "PER_PERSON" && service.perPersonPricing) {
    return { amount: formatEuro(service.perPersonPricing.ratePerPersonCents), suffix: "/per person" };
  }
  return { amount: "—" };
};

/** Duration shown on the card, e.g. "90 min" — package/fixed/per-person all carry a per-
 * session duration; hourly has none (min/max hours is shown separately). */
export const formatServiceDuration = (service: Service): string | undefined => {
  const durationMin =
    service.packagePricing?.durationMin ??
    service.fixedPricing?.durationMin ??
    service.perPersonPricing?.durationMin;
  return durationMin !== undefined ? `${durationMin} min` : undefined;
};

/** Min/Max row — hours for HOURLY, persons for PER_PERSON, absent otherwise. */
export const formatServiceMinMax = (service: Service): string | undefined => {
  if (service.pricingMode === "HOURLY" && service.hourlyPricing) {
    return `${service.hourlyPricing.minHours}-${service.hourlyPricing.maxHours} hours`;
  }
  if (service.pricingMode === "PER_PERSON" && service.perPersonPricing) {
    return `${service.perPersonPricing.minPersons}-${service.perPersonPricing.maxPersons} person`;
  }
  return undefined;
};

export const formatDiscount = (service: Service): string | undefined => {
  const percent = service.packagePricing?.discountPercent ?? service.fixedPricing?.discountPercent;
  return percent !== undefined ? `${percent}% Discount` : undefined;
};

export const formatAssignedStaffSummary = (
  staff: AssignedServiceStaff[],
): { primary: string; suffix?: string } => {
  if (staff.length === 0) {
    return { primary: "Not assigned" };
  }
  const [first, ...rest] = staff;
  const primary = rest.length > 0 ? `${first!.name}, ${rest[0]!.name}` : first!.name;
  const shown = rest.length > 0 ? 2 : 1;
  const remaining = staff.length - shown;
  return remaining > 0 ? { primary, suffix: `+${remaining}` } : { primary };
};

export const formatCitiesSummary = (cities: BusinessCity[]): { primary?: string; suffix?: string } => {
  if (cities.length === 0) {
    return {};
  }
  const [first, ...rest] = cities;
  return rest.length > 0 ? { primary: first, suffix: `+${rest.length}` } : { primary: first };
};
