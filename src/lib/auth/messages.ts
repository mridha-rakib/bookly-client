import { BooklyApiError, normalizeApiError } from "@/lib/api/client";

const codeMessages: Record<string, string> = {
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  PORTAL_MISMATCH: "This email belongs to a different Bookly portal.",
  USER_SUSPENDED: "This account is suspended. Please contact support.",
  EMAIL_ALREADY_REGISTERED: "This email is already registered.",
  INVALID_REGISTRATION_STEP: "Please complete the previous step first.",
  REGISTRATION_ALREADY_COMPLETED: "This registration has already been completed.",
  REGISTRATION_SESSION_EXPIRED: "This registration session expired. Please start again.",
  OTP_INVALID: "The verification code is incorrect.",
  OTP_EXPIRED: "The verification code has expired. Please request a new code.",
  OTP_RATE_LIMITED: "Please wait before requesting another code.",
  OTP_RESEND_COOLDOWN: "Please wait before requesting another code.",
  OTP_RESEND_LIMIT_EXCEEDED: "Too many code requests. Please try again later.",
  OTP_ATTEMPTS_EXCEEDED: "Too many verification attempts. Please request a new code.",
  PROVIDER_NOT_CONFIGURED: "Verification is not configured yet.",
  PROVIDER_RATE_LIMITED: "Too many verification requests. Please try again later.",
  OTP_DELIVERY_FAILED: "We could not send the verification code. Please try again.",
  OTP_VERIFICATION_FAILED: "We could not verify the code. Please try again.",
  DATABASE_TRANSACTION_UNAVAILABLE: "Registration cannot be completed right now.",
  SESSION_EXPIRED: "Your session has expired. Please log in again.",
  BUSINESS_NOT_FOUND: "We couldn't find that business.",
  BUSINESS_ACCESS_DENIED: "You don't have access to this business.",
  BUSINESS_ACCOUNT_NOT_FOUND: "No Business Owner account was found for that email.",
  CANNOT_LINK_OWN_BUSINESS: "You can't link your own business.",
  BUSINESS_ALREADY_LINKED: "This business is already linked to your account.",
  BUSINESS_LINK_NOT_FOUND: "That business link no longer exists.",
  BUSINESS_LINK_VERIFICATION_NOT_FOUND: "This verification request was not found or expired.",
  BUSINESS_LINK_VERIFICATION_CONSUMED: "This verification code has already been used.",
};

export const toUserMessage = (error: unknown): string => {
  const apiError = error instanceof BooklyApiError ? error : normalizeApiError(error);

  if (apiError.code && codeMessages[apiError.code]) {
    return codeMessages[apiError.code];
  }

  return apiError.message || "Something went wrong. Please try again.";
};
