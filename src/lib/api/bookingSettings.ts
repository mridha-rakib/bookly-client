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
