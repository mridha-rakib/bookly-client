import { apiRequest } from "@/lib/api/client";

// Gap Elimination is Business-scoped (confirmed product rule — one toggle above the whole
// Services catalogue, not per-Service). Matches
// api/src/modules/business-booking-settings/business-booking-settings.schema.ts.
export interface BusinessBookingSettings {
  businessId: string;
  gapEliminationEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const bookingSettingsApi = {
  getBookingSettings: (businessId: string) =>
    apiRequest<BusinessBookingSettings>({
      method: "GET",
      url: `/businesses/${businessId}/booking-settings`,
    }),

  updateBookingSettings: (businessId: string, gapEliminationEnabled: boolean) =>
    apiRequest<BusinessBookingSettings>({
      method: "PUT",
      url: `/businesses/${businessId}/booking-settings`,
      data: { gapEliminationEnabled },
    }),
};

// P0.5 — owner-only Business VAT position. Matches
// api/src/modules/business-booking-settings/business-tax-settings.ts.
export type BusinessTaxStatus =
  | "NOT_CONFIGURED"
  | "VAT_REGISTERED"
  | "VAT_EXEMPT"
  | "NOT_VAT_REGISTERED";

export type BusinessFeeTaxBlocker =
  | "BUSINESS_TAX_SETTINGS_NOT_CONFIGURED"
  | "BUSINESS_TAX_ACCOUNT_UNAVAILABLE"
  | "BUSINESS_DECLARED_NO_VAT_REGISTRATION";

export interface BusinessTaxSettings {
  businessId: string;
  status: BusinessTaxStatus;
  countryCode: "CY" | null;
  vatNumber: string | null;
  updatedAt: string | null;
  /** The Business has declared a valid VAT position. */
  setupComplete: boolean;
  /** Whether Bookly calculates VAT on this Business's fees — separate from setupComplete. */
  feeVatCalculationEnabled: boolean;
  feeVatBlocker: BusinessFeeTaxBlocker;
}

export type UpdateBusinessTaxSettingsInput =
  | { status: "VAT_REGISTERED"; countryCode: "CY"; vatNumber: string }
  | { status: "VAT_EXEMPT" | "NOT_VAT_REGISTERED"; countryCode: "CY" };

export const taxSettingsApi = {
  getTaxSettings: (businessId: string) =>
    apiRequest<BusinessTaxSettings>({
      method: "GET",
      url: `/businesses/${businessId}/tax-settings`,
    }),

  updateTaxSettings: (businessId: string, input: UpdateBusinessTaxSettingsInput) =>
    apiRequest<BusinessTaxSettings>({
      method: "PUT",
      url: `/businesses/${businessId}/tax-settings`,
      data: input,
    }),
};
