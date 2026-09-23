import { apiRequest } from "@/lib/api/client";

/**
 * Business Payout Destination (Owner surface). Matches
 * api/src/modules/payout-destination/payout-destination.schema.ts exactly. BUSINESS_OWNER-only on
 * the backend (see payout-destination.route.ts), mounted alongside the finance routes under
 * /businesses/:businessId — same auth/session mechanism as lib/api/finance.ts.
 *
 * The read view is ALWAYS masked: no endpoint on this owner surface ever returns the raw IBAN,
 * its ciphertext or its key version. The only decrypting endpoint in the whole app is the Super
 * Admin reveal (see lib/api/superAdminPayoutDestination.ts).
 */

export interface PayoutDestinationConfiguredView {
  configured: true;
  accountHolderName: string;
  /** e.g. "CY••••••••1234" — already masked by the backend, never derived client-side. */
  ibanMasked: string;
  ibanLast4: string;
  ibanCountry: string;
  bankName?: string;
  updatedAt: string;
}

export interface PayoutDestinationNotConfiguredView {
  configured: false;
}

export type PayoutDestinationView =
  | PayoutDestinationConfiguredView
  | PayoutDestinationNotConfiguredView;

/**
 * Exactly one branch is populated, decided by the actor's own `hasPassword` (GET /auth/me):
 * password accounts send `currentPassword`, OAuth-only accounts send the short-lived,
 * single-use `otpAuthorizationToken` minted by the verify call below.
 */
export interface PayoutDestinationStepUpInput {
  currentPassword?: string;
  otpAuthorizationToken?: string;
}

/** The backend body schema is `.strict()` — never add fields here (no ibanLast4/ibanCountry/
 * keyVersion/history/businessId; there is no VAT field of any kind). */
export interface UpdatePayoutDestinationInput {
  accountHolderName: string;
  /** Raw, un-normalized user input: the backend normalizes + mod-97 validates it itself. */
  iban: string;
  bankName?: string;
  stepUp: PayoutDestinationStepUpInput;
}

export interface PayoutStepUpOtpRequestResult {
  expiresAt: string;
}

export interface PayoutStepUpOtpVerifyResult {
  otpAuthorizationToken: string;
  expiresAt: string;
}

export const payoutDestinationApi = {
  get: (businessId: string) =>
    apiRequest<PayoutDestinationView>({
      method: "GET",
      url: `/businesses/${businessId}/payout-destination`,
    }),

  /** Create-or-replace — the same endpoint for both, there is no separate create route. */
  update: (businessId: string, input: UpdatePayoutDestinationInput) =>
    apiRequest<PayoutDestinationView>({
      method: "PATCH",
      url: `/businesses/${businessId}/payout-destination`,
      data: input,
    }),

  /** OAuth-only owners only — a password owner gets 400
   * PAYOUT_DESTINATION_STEP_UP_NOT_APPLICABLE, so never call this when hasPassword is true. */
  requestStepUpOtp: (businessId: string) =>
    apiRequest<PayoutStepUpOtpRequestResult>({
      method: "POST",
      url: `/businesses/${businessId}/payout-destination/step-up/otp/request`,
      data: {},
    }),

  verifyStepUpOtp: (businessId: string, code: string) =>
    apiRequest<PayoutStepUpOtpVerifyResult>({
      method: "POST",
      url: `/businesses/${businessId}/payout-destination/step-up/otp/verify`,
      data: { code },
    }),
};
