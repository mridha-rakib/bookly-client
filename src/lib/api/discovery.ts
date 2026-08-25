import { apiRequest } from "@/lib/api/client";
import type { BusinessCity } from "@/lib/constants/cities";

/** Batch 16 — Explore's real backend. Genuinely public — no auth required (matches
 * api/src/modules/discovery/discovery.route.ts). */

export type DiscoveryVisitType = "AT_BUSINESS_LOCATION" | "TRAVEL_TO_CUSTOMER";
export type DiscoverySortOption =
  | "mostRelevant"
  | "ratingHighToLow"
  | "priceLowToHigh"
  | "priceHighToLow";
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
}

export interface DiscoveryListResult {
  businesses: DiscoveryBusinessCard[];
  pagination: { page: number; limit: number; total: number };
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
      },
    }),

  listCategories: () =>
    apiRequest<{ categories: string[] }>({ method: "GET", url: "/discovery/categories" }),
};
