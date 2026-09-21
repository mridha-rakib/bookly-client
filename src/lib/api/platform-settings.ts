import { apiRequest } from "@/lib/api/client";

/**
 * Batch 21 — the real Super Admin Platform Settings backend. Replaces the previous
 * frontend-only mock/local-state "Platform Configuration" card.
 *
 * `fixed` values come straight from backend constants (deposit clamp, cancellation %-bounds,
 * cancellation tiers, the 90-minute resolution duration) — never editable here. `editable`
 * values (max services per booking, per-category no-show windows) are persisted server-side.
 */

export const platformCategoryKeys = [
  "BEAUTY_WELLNESS",
  "HEALTH_FITNESS",
  "SPORTS_ACTIVITIES",
  "AUTOMOTIVE",
  "PETS_HOME",
  "EXPERIENCES_TOURS",
  "ENTERTAINMENT_EVENTS",
  "CREATIVE_EDUCATION",
  "PROFESSIONAL_SERVICES_CONSULTING_COACHING",
] as const;
export type PlatformCategoryKey = (typeof platformCategoryKeys)[number];

export interface NoShowCategoryWindow {
  categoryKey: PlatformCategoryKey;
  opensAfterMinutes: number;
  closesAfterMinutes: number;
}

export interface PlatformSettings {
  fixed: {
    depositPercent: number;
    depositMinCents: number;
    depositMaxCents: number;
    cancellationPercentageMin: number;
    cancellationPercentageMax: number;
    noShowResolutionMinutes: number;
    cancellationTiers: string[];
  };
  session: {
    refreshTokenTtlDays: number;
    accessTokenTtlMinutes: number;
  };
  categories: Array<{ key: PlatformCategoryKey; label: string }>;
  editable: {
    maxServicesPerBooking: number;
    structuralMaxServicesPerBooking: number;
    noShowCategoryWindows: NoShowCategoryWindow[];
  };
}

export interface UpdatePlatformSettingsInput {
  maxServicesPerBooking?: number;
  noShowCategoryWindows?: NoShowCategoryWindow[];
}

export interface PublicBookingConfig {
  maxServicesPerBooking: number;
}

/**
 * THE canonical Business Owner registration category + subcategory taxonomy — see
 * api/src/modules/platform-settings/business-taxonomy.ts. Platform-owned, read-only: there is
 * no create/update/delete for it anywhere in the product. Every frontend surface that shows
 * business categories (registration, the marketing list-your-business page, the category icon
 * map) should derive from this fetched data rather than keeping its own hardcoded array.
 */
export interface BusinessTaxonomySubcategory {
  key: string;
  label: string;
}

export interface BusinessTaxonomyCategory {
  key: PlatformCategoryKey;
  label: string;
  subcategories: BusinessTaxonomySubcategory[];
}

export const platformSettingsApi = {
  get: () =>
    apiRequest<PlatformSettings>({ method: "GET", url: "/super-admin/settings/platform" }),

  update: (input: UpdatePlatformSettingsInput) =>
    apiRequest<PlatformSettings>({
      method: "PATCH",
      url: "/super-admin/settings/platform",
      data: input,
    }),

  /** Anonymous — used by the customer / business booking UIs to mirror the server limit. */
  getPublicBookingConfig: () =>
    apiRequest<PublicBookingConfig>({ method: "GET", url: "/platform/booking-config" }),

  /** Anonymous, read-only — GET only, no admin mutation exists for this taxonomy. */
  getBusinessTaxonomy: () =>
    apiRequest<BusinessTaxonomyCategory[]>({
      method: "GET",
      url: "/platform/business-taxonomy",
    }),
};
