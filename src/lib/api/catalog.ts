import { apiRequest } from "@/lib/api/client";
import type { BusinessCity } from "@/lib/constants/cities";

/**
 * Batch 9 — the customer-facing "browse a known Business and book" read client. Matches
 * api/src/modules/catalog/catalog.dto.ts exactly. CUSTOMER-only on the backend, mounted at its
 * own `/catalog` prefix (never `/businesses/...`) specifically so it never collides with the
 * Business-Owner-only `/businesses/...` surface — see the backend route's own comment.
 *
 * Full marketplace discovery (search, categories, ratings, geo-distance, "recommended"/
 * "trending") has no backend support and is explicitly out of scope — this client only resolves
 * a Business the caller already has the id for (e.g. from a link), matching what the booking
 * wizard needs.
 */

export type CatalogVisitType = "AT_BUSINESS_LOCATION" | "TRAVEL_TO_CUSTOMER";

export interface CatalogBusinessAddress {
  city: string;
  area: string;
  streetName: string;
  streetNumber: string;
  floorUnit?: string;
  aptRoom?: string;
}

export interface CatalogBusiness {
  id: string;
  name: string;
  category: string;
  subcategories: string[];
  briefDescription: string;
  visitType: CatalogVisitType;
  timezone: string;
  address: CatalogBusinessAddress;
}

export type CatalogServicePricingMode = "FIXED" | "HOURLY" | "PER_PERSON" | "PACKAGE";

export interface CatalogService {
  id: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  isFeatured: boolean;
  isPackageDeal: boolean;
  pricingMode?: CatalogServicePricingMode;
  fixedPricing?: { priceCents: number; durationMin: number; discountPercent?: number };
  hourlyPricing?: { ratePerHourCents: number; minHours: number; maxHours: number };
  perPersonPricing?: {
    ratePerPersonCents: number;
    minPersons: number;
    maxPersons: number;
    durationMin: number;
  };
  packagePricing?: {
    bundlePriceCents: number;
    sessionsInPackage: number;
    durationMin: number;
    discountPercent?: number;
  };
  servedCities: string[];
  assignedStaffMembershipIds: string[];
}

export interface CatalogStaffMember {
  id: string;
  firstName: string;
  lastName?: string;
}

export interface BusinessCatalog {
  business: CatalogBusiness;
  services: CatalogService[];
  staff: CatalogStaffMember[];
}

export interface CatalogAddon {
  id: string;
  name: string;
  description?: string;
  priceCents?: number;
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  eligibleStaffMembershipIds: string[];
  remainingCapacity?: number;
  source: "AUTO" | "MANUAL";
}

export interface AvailabilityDay {
  date: string;
  isOpen: boolean;
  slots: AvailabilitySlot[];
}

export interface AvailabilityResult {
  businessId: string;
  serviceId: string;
  timezone: string;
  capacityMax: number;
  days: AvailabilityDay[];
}

export const ANY_STAFF = "ANY";

export const catalogApi = {
  getBusinessCatalog: (businessId: string) =>
    apiRequest<BusinessCatalog>({ method: "GET", url: `/catalog/businesses/${businessId}` }),

  listServiceAddons: (businessId: string, serviceId: string) =>
    apiRequest<{ addons: CatalogAddon[] }>({
      method: "GET",
      url: `/catalog/businesses/${businessId}/services/${serviceId}/addons`,
    }),

  getServiceAvailability: (
    businessId: string,
    serviceId: string,
    params: {
      fromDate: string;
      toDate: string;
      staffMembershipId?: string;
      partySize?: number;
      customerCity?: BusinessCity;
    },
  ) =>
    apiRequest<AvailabilityResult>({
      method: "GET",
      url: `/catalog/businesses/${businessId}/services/${serviceId}/availability`,
      params,
    }),
};
