import { apiRequest } from "@/lib/api/client";
import type { VisitType } from "@/lib/api/auth";

export type BusinessStatus = "PENDING" | "APPROVED" | "WARNING" | "SUSPENDED";
export type BusinessRelationship = "OWNER" | "LINKED";
export type BusinessCity = "Larnaca" | "Limassol" | "Nicosia" | "Paphos";

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

// Card shape returned by GET /businesses/my-profile (primary + secondary[]).
export interface BusinessCard {
  id: string;
  name: string;
  status: BusinessStatus;
  visitType: VisitType;
  category: string;
  subcategories: string[];
  address: BusinessCardAddress;
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
};
