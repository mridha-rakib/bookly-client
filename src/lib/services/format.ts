import type { AssignedServiceStaff, Service } from "@/lib/api/services";
import type { BusinessCity } from "@/lib/constants/cities";

/** The subset of pricing fields formatServicePrice/formatServiceDuration actually read —
 * satisfied structurally by both the Owner-management `Service` type AND the read-only
 * `CatalogService` shape (see @/lib/api/catalog.ts), so both callers share one formatter
 * instead of duplicating this pricing-display logic per DTO shape. */
type ServicePricingFields = Pick<
  Service,
  "isPackageDeal" | "pricingMode" | "fixedPricing" | "hourlyPricing" | "perPersonPricing" | "packagePricing"
>;

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
export const formatServicePrice = (service: ServicePricingFields): { amount: string; suffix?: string } => {
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
export const formatServiceDuration = (service: ServicePricingFields): string | undefined => {
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
  // A stored 0% is a valid (if pointless) value — don't show a "0% Discount" badge for it.
  return percent !== undefined && percent > 0 ? `${percent}% Discount` : undefined;
};

/** Owner-facing original/bundle/savings breakdown for a package Service — only available once
 * `normalPricePerSessionCents` has been entered (see service.model.ts's own doc comment on that
 * field). `discountPercent` is read straight from the service, never recomputed client-side: the
 * backend already computes the canonical, correctly-rounded value whenever
 * normalPricePerSessionCents is present (service.service.ts's resolvePackagePricing), so re-deriving
 * it here would risk a rounding mismatch between server and display. Legacy packages (no
 * normalPricePerSessionCents) return undefined — callers must fall back to the plain
 * bundle-price-only display, never a fabricated original price. */
export type PackagePriceBreakdown = {
  normalTotalCents: number;
  bundlePriceCents: number;
  savingsCents: number;
  discountPercent: number;
  pricePerSessionCents: number;
  sessionsInPackage: number;
};

export const formatPackagePriceBreakdown = (
  service: ServicePricingFields,
): PackagePriceBreakdown | undefined => {
  const pricing = service.packagePricing;
  if (!service.isPackageDeal || !pricing || pricing.normalPricePerSessionCents === undefined) {
    return undefined;
  }

  const normalTotalCents = pricing.normalPricePerSessionCents * pricing.sessionsInPackage;

  return {
    normalTotalCents,
    bundlePriceCents: pricing.bundlePriceCents,
    savingsCents: normalTotalCents - pricing.bundlePriceCents,
    discountPercent: pricing.discountPercent ?? 0,
    pricePerSessionCents: pricing.normalPricePerSessionCents,
    sessionsInPackage: pricing.sessionsInPackage,
  };
};

/** Privacy-friendly compact display: "Rakib Mahmud Mridha" -> "Rakib M." (first name + last
 * word's initial). A single-word name is shown as-is — there's no surname to abbreviate. */
export const formatStaffDisplayName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) {
    return parts[0] ?? fullName;
  }
  const first = parts[0]!;
  const lastInitial = parts[parts.length - 1]![0];
  return `${first} ${lastInitial}.`;
};

export const formatAssignedStaffSummary = (
  staff: AssignedServiceStaff[],
): { primary: string; suffix?: string } => {
  if (staff.length === 0) {
    return { primary: "Not assigned" };
  }
  const names = staff.map((member) => formatStaffDisplayName(member.name));
  const [first, ...rest] = names;
  const primary = rest.length > 0 ? `${first}, ${rest[0]}` : first!;
  const shown = rest.length > 0 ? 2 : 1;
  const remaining = staff.length - shown;
  return remaining > 0 ? { primary, suffix: `+${remaining}` } : { primary };
};

/** `feeCentsByCity` is a read-only display join against BusinessTravelSettings, passed down from
 * a single list-level query (see ServicesListPage) — never fetched per-card, and never persisted
 * onto the Service. Omitted entirely (e.g. no query result yet) still renders the plain city
 * names, matching the pre-fee-display behavior. */
export const formatCitiesSummary = (
  cities: BusinessCity[],
  feeCentsByCity?: Map<string, number>,
): {
  primary?: string;
  primaryFeeCents?: number;
  suffix?: string;
  others: Array<{ city: BusinessCity; feeCents?: number }>;
} => {
  if (cities.length === 0) {
    return { others: [] };
  }
  const [first, ...rest] = cities;
  return {
    primary: first,
    primaryFeeCents: feeCentsByCity?.get(first),
    suffix: rest.length > 0 ? `+${rest.length}` : undefined,
    others: rest.map((city) => ({ city, feeCents: feeCentsByCity?.get(city) })),
  };
};
