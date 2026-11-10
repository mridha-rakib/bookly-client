import { apiRequest } from "@/lib/api/client";
import type { BusinessCity } from "@/lib/constants/cities";

/** Batch 16 — Explore's real backend. Genuinely public — no auth required (matches
 * api/src/modules/discovery/discovery.route.ts). */

export type DiscoveryVisitType = "AT_BUSINESS_LOCATION" | "TRAVEL_TO_CUSTOMER";
export type DiscoverySortOption =
  | "mostRelevant"
  | "ratingHighToLow"
  | "priceLowToHigh"
  | "priceHighToLow"
  // P2.2.3 — Explore quick actions / nearest-first (server-ranked).
  | "recommended"
  | "trending"
  | "distance";

export type DiscoveryAvailabilityWindow = "ANY" | "MORNING" | "AFTERNOON" | "EVENING";
export type DiscoveryPricingMode = "FIXED" | "HOURLY" | "PER_PERSON";

export interface DiscoveryBusinessCard {
  id: string;
  name: string;
  category: string;
  subcategories: string[];
  city: BusinessCity;
  visitType: DiscoveryVisitType;
  averageRating: number | null;
  reviewCount: number;
  startingPriceCents: number | null;
  startingPricingMode: DiscoveryPricingMode | null;
  imageUrl?: string;
  isAvailable: boolean;
  /** Real persisted business coordinate — undefined when the business has none. Never
   * geocoded/fabricated client-side. */
  location?: { lat: number; lng: number };
  /** P2.2.3 — straight-line km from the visitor's chosen location (only when one was sent). */
  distanceKm?: number;
  /** P2.2.3 — under the availability filter: the earliest bookable slot found for the chosen
   * date/window. An indication only; booking re-checks it. */
  availability?: { serviceId: string; serviceName: string; firstSlotStartAt: string };
}

export interface DiscoveryListMeta {
  sort: string;
  personalized?: boolean;
  trending?: { from: string; to: string; timezone: string; statuses: string[] };
  distance?: { unit: "km"; measure: "STRAIGHT_LINE_TO_BUSINESS_LOCATION"; radiusKm: number | null };
  availability?: {
    date: string;
    window: DiscoveryAvailabilityWindow;
    serviceQuery: string | null;
    candidatesChecked: number;
    candidateLimitReached: boolean;
    travelBusinessesNeedCity: number;
  };
}

export interface DiscoveryListResult {
  businesses: DiscoveryBusinessCard[];
  pagination: { page: number; limit: number; total: number };
  meta?: DiscoveryListMeta;
}

/** Public landing "Trusted by local businesses" card — only the fields that section renders.
 * `imageUrl` is undefined when the business has no stored cover photo. */
export interface FoundingPartnerCard {
  id: string;
  name: string;
  city: BusinessCity;
  imageUrl?: string;
}

/** Batch 17 — the homepage's three discovery rows, all real data (see
 * api/src/modules/discovery/discovery.types.ts for the exact ranking of each). Same card shape
 * as Explore — deliberately no `distance` (the product stores no visitor coordinates). */
export interface HomeSectionsResult {
  recommended: DiscoveryBusinessCard[];
  nearYou: DiscoveryBusinessCard[];
  popular: DiscoveryBusinessCard[];
  meta: {
    personalized: boolean;
    nearYouCity: BusinessCity | null;
  };
}

export interface HomeSectionsParams {
  /** The city the visitor picked in the hero search bar — drives "Services near you". */
  city?: BusinessCity;
  /** Optional real category strings that narrow "Recommended" for logged-out visitors. */
  category?: string[];
  limit?: number;
}

export interface DiscoverySearchParams {
  q?: string;
  city?: BusinessCity[];
  visitType?: DiscoveryVisitType;
  category?: string[];
  minRating?: number;
  sort?: DiscoverySortOption;
  page?: number;
  limit?: number;
  /** P2.2.3 — explicit visitor location (never stored by Bookly). */
  origin?: { lat: number; lng: number };
  radiusKm?: number;
  /** P2.2.3 — availability context (Business-local date + window, optional service text). */
  availability?: { date: string; window: DiscoveryAvailabilityWindow; service?: string };
}

export const discoveryApi = {
  search: (params: DiscoverySearchParams = {}) =>
    apiRequest<DiscoveryListResult>({
      method: "GET",
      url: "/discovery/businesses",
      params: {
        ...(params.q ? { q: params.q } : {}),
        ...(params.city && params.city.length > 0 ? { city: params.city.join(",") } : {}),
        ...(params.visitType ? { visitType: params.visitType } : {}),
        ...(params.category && params.category.length > 0
          ? { category: params.category.join(",") }
          : {}),
        ...(params.minRating ? { minRating: String(params.minRating) } : {}),
        ...(params.sort ? { sort: params.sort } : {}),
        ...(params.page ? { page: String(params.page) } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
        ...(params.origin ? { nearLat: String(params.origin.lat), nearLng: String(params.origin.lng) } : {}),
        ...(params.origin && params.radiusKm ? { radiusKm: String(params.radiusKm) } : {}),
        ...(params.availability
          ? {
              availDate: params.availability.date,
              availWindow: params.availability.window,
              ...(params.availability.service ? { availService: params.availability.service } : {}),
            }
          : {}),
      },
    }),

  homeSections: (params: HomeSectionsParams = {}) =>
    apiRequest<HomeSectionsResult>({
      method: "GET",
      url: "/discovery/home-sections",
      params: {
        ...(params.city ? { city: params.city } : {}),
        ...(params.category && params.category.length > 0
          ? { category: params.category.join(",") }
          : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  listCategories: () =>
    apiRequest<{ categories: string[] }>({ method: "GET", url: "/discovery/categories" }),

  listFoundingPartners: () =>
    apiRequest<{ businesses: FoundingPartnerCard[] }>({
      method: "GET",
      url: "/discovery/founding-partners",
    }),
};
