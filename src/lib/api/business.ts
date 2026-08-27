import { apiRequest } from "@/lib/api/client";
import type { VisitType } from "@/lib/api/auth";
import type { BusinessCity } from "@/lib/constants/cities";

export type { BusinessCity } from "@/lib/constants/cities";
export type BusinessStatus = "PENDING" | "APPROVED" | "WARNING" | "SUSPENDED";
export type BusinessRelationship = "OWNER" | "LINKED";
export type BusinessMediaRole = "PROFILE" | "GALLERY";

export interface BusinessPhone {
  countryCode: string;
  nationalNumber: string;
  e164: string;
}

export interface BusinessCardAddress {
  city: string;
  area: string;
}

export interface BusinessAddress {
  city: string;
  area: string;
  streetName: string;
  streetNumber: string;
  floorUnit?: string;
  aptRoom?: string;
}

export interface BusinessLocation {
  lat: number;
  lng: number;
  searchQuery?: string;
}

export interface BusinessProfileMedia {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessMedia extends BusinessProfileMedia {
  businessId: string;
  role: BusinessMediaRole;
  originalFileName?: string;
  sortOrder: number;
}

export interface BusinessTravelCitySetting {
  city: BusinessCity;
  active: boolean;
  feeCents: number;
}

export interface BusinessTravelSettings {
  businessId: string;
  cities: BusinessTravelCitySetting[];
  createdAt?: string;
  updatedAt?: string;
}

// Card shape returned by GET /businesses/my-profile (primary + secondary[]).
export interface BusinessCard {
  id: string;
  name: string;
  status: BusinessStatus;
  visitType: VisitType;
  category: string;
  subcategories: string[];
  address: BusinessCardAddress;
  profileMedia?: BusinessProfileMedia;
  createdAt: string;
}

export interface BusinessProfileResponse {
  primary: BusinessCard | null;
  secondary: BusinessCard[];
}

// Full shape returned by GET /businesses/:businessId
export interface BusinessDetail {
  id: string;
  name: string;
  ownerName: string;
  status: BusinessStatus;
  visitType: VisitType;
  phone: BusinessPhone;
  address: BusinessAddress;
  location?: BusinessLocation;
  briefDescription: string;
  category: string;
  subcategories: string[];
  instagramHandle?: string;
  facebookPageUrl?: string;
  relationship: BusinessRelationship;
  createdAt: string;
  updatedAt: string;
}

// Matches api/src/modules/business/business.schema.ts updateBusinessBodySchema.
export interface UpdateBusinessInput {
  name?: string;
  ownerName?: string;
  countryCode?: string;
  nationalNumber?: string;
  visitType?: VisitType;
  city?: BusinessCity;
  area?: string;
  streetName?: string;
  streetNumber?: string;
  floorUnit?: string;
  aptRoom?: string;
  briefDescription?: string;
  category?: string;
  subcategories?: string[];
  coordinates?: { lat: number; lng: number };
  searchQuery?: string;
  instagramHandle?: string;
  facebookPageUrl?: string;
}

// Response of GET /businesses/:businessId/integrations/google-calendar/status.
export interface GoogleCalendarStatus {
  connected: boolean;
  googleAccountEmail?: string;
  status?: "CONNECTED" | "ERROR";
  connectedAt?: string;
}

// Response of POST /businesses/links/verification and .../:verificationId/resend.
export interface BusinessLinkVerificationChallenge {
  verificationId: string;
  expiresAt: string;
  resendAvailableAt: string;
}

export const businessApi = {
  getMyProfile: () =>
    apiRequest<BusinessProfileResponse>({ method: "GET", url: "/businesses/my-profile" }),

  getBusiness: (businessId: string) =>
    apiRequest<BusinessDetail>({ method: "GET", url: `/businesses/${businessId}` }),

  updateBusiness: (businessId: string, input: UpdateBusinessInput) =>
    apiRequest<BusinessDetail>({
      method: "PATCH",
      url: `/businesses/${businessId}`,
      data: input,
    }),

  getBusinessMedia: (businessId: string) =>
    apiRequest<BusinessMedia[]>({ method: "GET", url: `/businesses/${businessId}/media` }),

  uploadBusinessMedia: (businessId: string, file: File) => {
    const data = new FormData();
    data.append("file", file);

    return apiRequest<BusinessMedia>({
      method: "POST",
      url: `/businesses/${businessId}/media`,
      data,
    });
  },

  deleteBusinessMedia: (businessId: string, mediaId: string) =>
    apiRequest<undefined>({
      method: "DELETE",
      url: `/businesses/${businessId}/media/${mediaId}`,
    }),

  setBusinessProfileMedia: (businessId: string, mediaId: string) =>
    apiRequest<BusinessMedia>({
      method: "PATCH",
      url: `/businesses/${businessId}/media/${mediaId}/profile`,
    }),

  getBusinessTravelSettings: (businessId: string) =>
    apiRequest<BusinessTravelSettings>({
      method: "GET",
      url: `/businesses/${businessId}/travel-settings`,
    }),

  updateBusinessTravelSettings: (businessId: string, cities: BusinessTravelCitySetting[]) =>
    apiRequest<BusinessTravelSettings>({
      method: "PUT",
      url: `/businesses/${businessId}/travel-settings`,
      data: { cities },
    }),

  // Step 1 of linking: sends an OTP to the entered target account email. Does not
  // create a BusinessAccess relationship yet — see verifyBusinessLink.
  requestBusinessLinkVerification: (email: string) =>
    apiRequest<BusinessLinkVerificationChallenge>({
      method: "POST",
      url: "/businesses/links/verification",
      data: { email },
    }),

  resendBusinessLinkVerification: (verificationId: string) =>
    apiRequest<BusinessLinkVerificationChallenge>({
      method: "POST",
      url: `/businesses/links/verification/${verificationId}/resend`,
    }),

  // Step 2: verifies the OTP and, only on success, creates the BusinessAccess link.
  verifyBusinessLink: (verificationId: string, code: string) =>
    apiRequest<BusinessCard>({
      method: "POST",
      url: `/businesses/links/verification/${verificationId}/verify`,
      data: { code },
    }),

  unlinkBusiness: (businessId: string) =>
    apiRequest<undefined>({ method: "DELETE", url: `/businesses/links/${businessId}` }),

  getGoogleCalendarStatus: (businessId: string) =>
    apiRequest<GoogleCalendarStatus>({
      method: "GET",
      url: `/businesses/${businessId}/integrations/google-calendar/status`,
    }),

  // Returns the real Google consent URL — the frontend navigates the browser to it itself
  // (this API only accepts a Bearer token, which a plain window.location navigation can't
  // carry, so the URL has to be fetched via an authenticated request first).
  getGoogleCalendarAuthUrl: (businessId: string) =>
    apiRequest<{ authUrl: string }>({
      method: "GET",
      url: `/businesses/${businessId}/integrations/google-calendar/connect`,
    }),

  disconnectGoogleCalendar: (businessId: string) =>
    apiRequest<undefined>({
      method: "DELETE",
      url: `/businesses/${businessId}/integrations/google-calendar`,
    }),
};
