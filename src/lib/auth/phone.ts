import { parsePhoneNumberFromString } from "libphonenumber-js/min";

// UX-only mirror of the backend's authoritative check (AuthService.validateAndNormalizePhoneNumber
// / auth.utils.ts) — lets the signup/change-phone forms show an inline error and skip the request
// entirely for an obviously malformed number, without waiting on a round trip. The backend does
// not trust this: it re-validates independently before persisting anything or contacting Twilio.
//
// No ISO country is passed in — a calling code alone doesn't map to one country (e.g. "+1" spans
// the US, Canada, and Caribbean territories), so the full "+<countryCode><nationalNumber>" string
// is parsed as-is and libphonenumber-js resolves the matching numbering plan itself.
export const isPlausiblePhoneNumber = (countryCode: string, nationalNumber: string): boolean => {
  const digitsOnly = nationalNumber.trim().replace(/\D/g, "");
  if (digitsOnly.length < 4) {
    return false;
  }

  const parsed = parsePhoneNumberFromString(`${countryCode}${digitsOnly}`);
  return Boolean(parsed?.isValid());
};
