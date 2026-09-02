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
  STAFF_BUSINESS_NOT_FOUND: "We couldn't find that business.",
  STAFF_BUSINESS_ACCESS_DENIED: "You do not have access to manage staff for this business.",
  STAFF_NOT_FOUND: "We couldn't find that staff member.",
  STAFF_EMAIL_ALREADY_EXISTS: "An account with this email already exists.",
  STAFF_ROLE_NOT_ALLOWED: "That role cannot be assigned to a staff member.",
  STAFF_PHONE_INVALID: "Enter a valid phone number, including the country code.",
  STAFF_OWNER_ROW_NOT_EDITABLE: "The business owner cannot be edited or removed from Staff.",
  STAFF_TRANSACTION_UNAVAILABLE: "Staff changes cannot be completed right now. Please try again.",
  STAFF_TEMP_PASSWORD_EMAIL_FAILED:
    "The staff account was created, but the welcome email could not be sent.",
  INVALID_CURRENT_PASSWORD: "Your current password is incorrect.",
  PHONE_ALREADY_REGISTERED: "That phone number is already registered to another account.",
  CONTACT_UNCHANGED: "That's already your current email or phone number.",
  CONTACT_CHANGE_NOT_FOUND: "That code has expired or was already used. Please request a new one.",
  CUSTOMER_AVATAR_FILE_REQUIRED: "Please choose an image file.",
  CUSTOMER_AVATAR_INVALID_TYPE: "Please choose a JPG, PNG or WebP image.",
  CUSTOMER_AVATAR_TOO_LARGE: "That image is too large. Please choose one under 5 MB.",
  DELETE_CONFIRMATION_INVALID: "Type DELETE to confirm.",
  ACCOUNT_HAS_ACTIVE_BOOKINGS:
    "You have upcoming bookings. Please complete or cancel them before closing your account.",
  ACCOUNT_DELETED: "This account has been closed.",
};

export const toUserMessage = (error: unknown): string => {
  const apiError = error instanceof BooklyApiError ? error : normalizeApiError(error);

  if (apiError.code && codeMessages[apiError.code]) {
    return codeMessages[apiError.code];
  }

  return apiError.message || "Something went wrong. Please try again.";
};

/**
 * Maps backend Zod validation details (`{ path, message }[]`, already carried on
 * BooklyApiError.errors) to a flat `{ fieldName: message }` object so forms can show
 * an inline error next to the field the backend actually rejected, instead of only a
 * generic toast.
 */
export const getFieldErrors = (error: unknown): Record<string, string> => {
  const apiError = error instanceof BooklyApiError ? error : normalizeApiError(error);
  const fieldErrors: Record<string, string> = {};

  for (const detail of apiError.errors) {
    if (detail.path && !fieldErrors[detail.path]) {
      fieldErrors[detail.path] = detail.message;
    }
  }

  return fieldErrors;
};
