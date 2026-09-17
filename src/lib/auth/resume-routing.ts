/**
 * Maps a PROFESSIONAL RegistrationSession's `currentStep` to the page that resumes it, so a
 * returning session (re-entering the same email, a refresh, a new tab) lands on the step it's
 * actually at instead of restarting from scratch. Keyed off the backend's authoritative
 * `currentStep` (from POST /auth/professional/entry or GET /auth/professional/register/progress)
 * — never inferred from ephemeral frontend state.
 *
 * `COMPLETED` is intentionally absent: a completed registration has a real User, so
 * `AuthService.entry` resolves it as `PASSWORD_LOGIN` before any RegistrationSession branch is
 * reached — a completed user's `currentStep` should never reach this map.
 */
export const professionalResumeRoute = (
  currentStep: string,
  params: { email: string; sessionId: string },
): string => {
  const email = encodeURIComponent(params.email);
  const sessionId = encodeURIComponent(params.sessionId);

  switch (currentStep) {
    case "EMAIL_ENTRY":
      return "/professional/auth";
    case "EMAIL_OTP_SENT":
      return `/professional/verify?email=${email}&sessionId=${sessionId}`;
    case "EMAIL_VERIFIED":
    case "PROFILE_SUBMITTED":
    case "PHONE_OTP_SENT":
      // /professional/signup owns its own internal profile/phone sub-steps (driven by
      // useProfessionalRegistrationProgressQuery), so routing to the page is sufficient.
      return `/professional/signup?email=${email}&sessionId=${sessionId}`;
    case "PHONE_VERIFIED":
    case "VISIT_TYPE_SELECTED":
      // VISIT_TYPE_SELECTED still resumes here too: the page pre-selects/preserves the existing
      // choice rather than re-asking, and Continue re-confirms the same value.
      return `/professional/visit-type?email=${email}&sessionId=${sessionId}`;
    case "BUSINESS_DETAILS_SUBMITTED":
    case "CATEGORIES_SUBMITTED":
      // /professional/business-form owns its own internal step (details / categories /
      // completion), driven by the same progress query.
      return `/professional/business-form?email=${email}&sessionId=${sessionId}`;
    default:
      return "/professional/auth";
  }
};
