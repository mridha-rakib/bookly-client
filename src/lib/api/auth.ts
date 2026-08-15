import { apiRequest } from "@/lib/api/client";
import type { BusinessCity } from "@/lib/constants/cities";

export type UserRole = "CUSTOMER" | "BUSINESS_OWNER" | "SUPERVISOR" | "STAFF" | "SUPER_ADMIN";
export type UserStatus = "ACTIVE" | "DORMANT" | "SUSPENDED";
export type Gender = "male" | "female" | "other";
export type Portal = "customer" | "professional";
export type VisitType = "AT_BUSINESS_LOCATION" | "TRAVEL_TO_CUSTOMER";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export interface AuthProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  gender: Gender;
  phone?: {
    countryCode: string;
    nationalNumber: string;
    e164: string;
  };
}

export interface AuthBusiness {
  id: string;
  name: string;
  status: string;
  visitType: VisitType;
}

export interface CurrentUserResponse {
  user: AuthUser & {
    emailVerifiedAt?: string;
    phoneVerifiedAt?: string;
  };
  profile: AuthProfile | null;
  business: AuthBusiness | null;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: AuthUser;
  business?: {
    id: string;
    status: string;
  };
}

export interface EntryResponse {
  nextStep: "PASSWORD_LOGIN" | "EMAIL_VERIFICATION" | "PORTAL_MISMATCH";
  sessionId?: string;
  currentStep?: string;
}

export interface StepResponse {
  sessionId: string;
  nextStep?: string;
  expiresAt?: string;
}

export interface RegistrationProgress {
  sessionId: string;
  portal: "CUSTOMER" | "PROFESSIONAL";
  intendedRole: UserRole;
  currentStep: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  expiresAt: string;
  // Authoritative identity/contact data captured earlier in registration (profile
  // submission + phone OTP verification). firstName/lastName/phone are only present
  // once those steps have actually completed.
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: { countryCode: string; nationalNumber: string };
}

export interface ProfileInput {
  sessionId: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  countryCode: string;
  phone: string;
  password: string;
  agreeTerms: boolean;
}

export interface BusinessDetailsInput {
  sessionId: string;
  businessName: string;
  ownerName: string;
  city: BusinessCity;
  countryCode: string;
  mobileNumber: string;
  area: string;
  streetName: string;
  streetNumber: string;
  floorUnit?: string;
  aptRoom?: string;
  briefDesc: string;
  coordinates?: { lat: number; lng: number };
  searchQuery?: string;
}

export interface CategorySelectionInput {
  sessionId: string;
  selectedCategory: string;
  selectedSubcategories: string[];
}

export const authApi = {
  customerEntry: (email: string) =>
    apiRequest<EntryResponse>({
      method: "POST",
      url: "/auth/customer/entry",
      data: { email },
    }),

  professionalEntry: (input: { email: string; visitType: VisitType }) =>
    apiRequest<EntryResponse>({
      method: "POST",
      url: "/auth/professional/entry",
      data: input,
    }),

  customerLogin: (input: { email: string; password: string }) =>
    apiRequest<AuthResponse>({
      method: "POST",
      url: "/auth/customer/login",
      data: input,
    }),

  professionalLogin: (input: { email: string; password: string }) =>
    apiRequest<AuthResponse>({
      method: "POST",
      url: "/auth/professional/login",
      data: input,
    }),

  superAdminLogin: (input: { email: string; password: string }) =>
    apiRequest<AuthResponse>({
      method: "POST",
      url: "/auth/super-admin/login",
      data: input,
    }),

  refresh: () =>
    apiRequest<AuthResponse>({
      method: "POST",
      url: "/auth/refresh",
    }),

  logout: () =>
    apiRequest<undefined>({
      method: "POST",
      url: "/auth/logout",
    }),

  me: () =>
    apiRequest<CurrentUserResponse>({
      method: "GET",
      url: "/auth/me",
    }),

  sendCustomerEmailOtp: (sessionId: string) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/customer/register/send-email-otp",
      data: { sessionId },
    }),

  resendCustomerEmailOtp: (sessionId: string) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/customer/register/resend-email-otp",
      data: { sessionId },
    }),

  verifyCustomerEmailOtp: (input: { sessionId: string; code: string }) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/customer/register/verify-email-otp",
      data: input,
    }),

  submitCustomerProfile: (input: ProfileInput) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/customer/register/profile",
      data: input,
    }),

  sendCustomerPhoneOtp: (sessionId: string) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/customer/register/send-phone-otp",
      data: { sessionId },
    }),

  resendCustomerPhoneOtp: (sessionId: string) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/customer/register/resend-phone-otp",
      data: { sessionId },
    }),

  completeCustomerPhoneOtp: (input: { sessionId: string; code: string }) =>
    apiRequest<AuthResponse>({
      method: "POST",
      url: "/auth/customer/register/verify-phone-otp-complete",
      data: input,
    }),

  customerProgress: (sessionId: string) =>
    apiRequest<RegistrationProgress>({
      method: "GET",
      url: "/auth/customer/register/progress",
      params: { sessionId },
    }),

  sendProfessionalEmailOtp: (sessionId: string) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/professional/register/send-email-otp",
      data: { sessionId },
    }),

  resendProfessionalEmailOtp: (sessionId: string) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/professional/register/resend-email-otp",
      data: { sessionId },
    }),

  verifyProfessionalEmailOtp: (input: { sessionId: string; code: string }) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/professional/register/verify-email-otp",
      data: input,
    }),

  submitProfessionalProfile: (input: ProfileInput) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/professional/register/profile",
      data: input,
    }),

  sendProfessionalPhoneOtp: (sessionId: string) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/professional/register/send-phone-otp",
      data: { sessionId },
    }),

  resendProfessionalPhoneOtp: (sessionId: string) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/professional/register/resend-phone-otp",
      data: { sessionId },
    }),

  verifyProfessionalPhoneOtp: (input: { sessionId: string; code: string }) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/professional/register/verify-phone-otp",
      data: input,
    }),

  saveBusinessDetails: (input: BusinessDetailsInput) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/professional/register/business-details",
      data: input,
    }),

  saveCategories: (input: CategorySelectionInput) =>
    apiRequest<StepResponse>({
      method: "POST",
      url: "/auth/professional/register/categories",
      data: input,
    }),

  completeBusinessOwner: (sessionId: string) =>
    apiRequest<AuthResponse>({
      method: "POST",
      url: "/auth/professional/register/complete",
      data: { sessionId },
    }),

  professionalProgress: (sessionId: string) =>
    apiRequest<RegistrationProgress>({
      method: "GET",
      url: "/auth/professional/register/progress",
      params: { sessionId },
    }),
};
