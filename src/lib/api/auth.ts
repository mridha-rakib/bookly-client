import { apiBaseUrl, apiRequest } from "@/lib/api/client";
import type { BusinessCity } from "@/lib/constants/cities";

export type UserRole = "CUSTOMER" | "BUSINESS_OWNER" | "SUPERVISOR" | "STAFF" | "SUPER_ADMIN";
export type UserStatus = "ACTIVE" | "DORMANT" | "SUSPENDED";
export type Gender = "male" | "female" | "other";
export type UserLanguage = "EN" | "GR";
export type Portal = "customer" | "professional";
export type VisitType = "AT_BUSINESS_LOCATION" | "TRAVEL_TO_CUSTOMER";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

/**
 * Optional customer notification channels. GET /auth/me always returns this fully populated (an
 * absent stored value resolves to the product default server-side). Governs ONLY optional mail —
 * never booking confirmations, cancellations, invoices, no-show notices, or security mail.
 *
 * `marketingEmail` (Stage M1) is the persisted marketing opt-in. Default OFF. The Settings row
 * for it is intentionally not interactive yet — nothing sends marketing email — so the value is
 * read-only for now.
 */
export interface NotificationPreferences {
  appointmentReminderEmail: boolean;
  appointmentReminderSms: boolean;
  marketingEmail: boolean;
}

export interface AuthProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  gender: Gender;
  /** Account UI language preference. Always present (legacy profiles read back as "EN"). */
  defaultLanguage: UserLanguage;
  /** Optional reminder channels — always fully populated by the server. */
  notifications: NotificationPreferences;
  phone?: {
    countryCode: string;
    nationalNumber: string;
    e164: string;
  };
  /** CUSTOMER only — undefined until the customer sets it via profile edit. */
  address?: string;
  /** CUSTOMER only, "YYYY-MM-DD" — undefined until the customer sets it via profile edit. */
  dateOfBirth?: string;
  /**
   * CUSTOMER only — ready-to-render URL for the uploaded avatar (PUT /auth/me/avatar).
   * Undefined until the customer uploads one; the frontend falls back to a placeholder image.
   * The backend (storage) is the source of truth — this is refreshed via the ["auth","me"] query.
   */
  avatarUrl?: string;
}

export interface UpdateMyProfileInput {
  firstName?: string;
  lastName?: string;
  gender?: Gender;
  /** Super Admin Settings → Admin Account. */
  defaultLanguage?: UserLanguage;
  address?: string;
  dateOfBirth?: string;
  /** Partial nested update — send only the channel(s) being changed; the server writes them via
   * dot-path `$set`, so the sibling channel is never overwritten. */
  notifications?: Partial<NotificationPreferences>;
}

export interface ChangeMyPasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteMyAccountInput {
  currentPassword: string;
  /** Must be the literal string "DELETE" — the backend enforces this too. */
  confirmationText: string;
  /** Optional free-text; the v1 UI never sends it. */
  deletionReason?: string;
}

export interface RequestEmailChangeInput {
  currentPassword: string;
  newEmail: string;
}

export interface RequestPhoneChangeInput {
  /**
   * Required for password accounts (Settings → change phone). Omitted by a Google-only Customer
   * setting their FIRST phone in the post-signup completion flow — that account has no password,
   * and the backend skips the check for providers without `PASSWORD`.
   */
  currentPassword?: string;
  countryCode: string;
  nationalNumber: string;
}

export interface ChangeRequestResponse {
  expiresAt: string;
}

export interface AuthBusiness {
  id: string;
  name: string;
  status: string;
  visitType: VisitType;
}

/**
 * A linked external sign-in identity (Phase 1: Google only). Returned by GET /auth/me as
 * `linkedAccounts[]` — always an array, empty when nothing is linked. Never carries the
 * provider's account id or any token.
 */
export interface LinkedAccountSummary {
  provider: "GOOGLE";
  email: string;
  displayName?: string;
  /** ISO timestamp. */
  linkedAt: string;
}

export interface CurrentUserResponse {
  user: AuthUser & {
    emailVerifiedAt?: string;
    phoneVerifiedAt?: string;
  };
  profile: AuthProfile | null;
  business: AuthBusiness | null;
  linkedAccounts: LinkedAccountSummary[];
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

/**
 * Absolute URL of the backend's Customer "Continue with Google" entry point. The browser is
 * navigated here directly (a full-page redirect, not an XHR): the backend builds the Google
 * consent URL, sets its CSRF nonce cookie, and 302s onward — Google never touches the frontend.
 * On return the backend redirects to `/auth/google/callback?status=...` on THIS app.
 */
export const customerGoogleAuthStartUrl = (): string =>
  `${apiBaseUrl}/auth/customer/oauth/google/start`;

/** Coarse outcomes the backend puts on `/auth/google/callback?status=...`. No tokens, emails or
 * reasons are ever included in that URL. */
export type CustomerGoogleAuthStatus = "success" | "onboarding" | "account_exists" | "error";

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

  updateMyProfile: (input: UpdateMyProfileInput) =>
    apiRequest<CurrentUserResponse>({
      method: "PATCH",
      url: "/auth/me",
      data: input,
    }),

  changeMyPassword: (input: ChangeMyPasswordInput) =>
    apiRequest<undefined>({
      method: "PATCH",
      url: "/auth/me/password",
      data: input,
    }),

  deleteMyAccount: (input: DeleteMyAccountInput) =>
    apiRequest<undefined>({
      method: "DELETE",
      url: "/auth/me",
      data: input,
    }),

  /**
   * Customer avatar upload/replace. Single multipart `file` field (matches the Staff avatar
   * contract). Returns the full current-user payload so the caller can refresh ["auth","me"]
   * without a second request. axios sets the multipart boundary from the FormData.
   */
  updateMyAvatar: (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return apiRequest<CurrentUserResponse>({
      method: "PUT",
      url: "/auth/me/avatar",
      data,
    });
  },

  requestEmailChange: (input: RequestEmailChangeInput) =>
    apiRequest<ChangeRequestResponse>({
      method: "POST",
      url: "/auth/me/email/change-request",
      data: input,
    }),

  verifyEmailChange: (code: string) =>
    apiRequest<CurrentUserResponse>({
      method: "POST",
      url: "/auth/me/email/verify",
      data: { code },
    }),

  requestPhoneChange: (input: RequestPhoneChangeInput) =>
    apiRequest<ChangeRequestResponse>({
      method: "POST",
      url: "/auth/me/phone/change-request",
      data: input,
    }),

  verifyPhoneChange: (code: string) =>
    apiRequest<CurrentUserResponse>({
      method: "POST",
      url: "/auth/me/phone/verify",
      data: { code },
    }),

  // Phase 1 — Customer → Google account linking. Returns the real Google consent URL; the
  // frontend navigates the browser to it itself (this API only accepts a Bearer token, which a
  // plain window.location navigation can't carry). Same shape as
  // businessApi.getGoogleCalendarAuthUrl.
  getGoogleLinkUrl: () =>
    apiRequest<{ authUrl: string }>({
      method: "GET",
      url: "/auth/me/linked-accounts/google/authorize-url",
    }),

  unlinkGoogleAccount: (input: { currentPassword: string }) =>
    apiRequest<undefined>({
      method: "DELETE",
      url: "/auth/me/linked-accounts/google",
      data: input,
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
