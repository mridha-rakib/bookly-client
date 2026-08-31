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
};
