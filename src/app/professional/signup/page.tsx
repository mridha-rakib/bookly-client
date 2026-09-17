"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Mail01Icon, SquareLock01Icon } from "@hugeicons/core-free-icons";

// Components
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import { InputField, SelectField, PhoneInputField } from "@/components/auth/InputField";
import SuccessModal from "@/components/auth/SuccessModal";
import PhoneVerificationStep2 from "@/components/auth/PhoneVerificationStep2";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import {
  useChangeProfessionalPhoneMutation,
  useProfessionalRegistrationProgressQuery,
  useResendProfessionalPhoneOtpMutation,
  useSendProfessionalPhoneOtpMutation,
  useSubmitProfessionalProfileMutation,
  useVerifyProfessionalPhoneOtpMutation,
} from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import {
  getRegistrationSession,
  saveRegistrationSession,
} from "@/lib/auth/registration-session";
import { professionalResumeRoute } from "@/lib/auth/resume-routing";

function ProfessionalSignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get("sessionId") || "";
  // A social-verified Business Owner arrives here from
  // /auth/<provider>/callback?flow=professional&status=onboarding. Their RegistrationSession
  // already exists (Option B: no User yet), the email is provider-verified, and there is NO
  // password. Same UI for Google and Facebook — the backend session already carries the provider.
  const providerParam = searchParams.get("provider");
  // Every social provider (google / facebook / apple) drives the same passwordless, name/email-
  // prefilled, no-email-OTP onboarding — the backend RegistrationSession already carries which one.
  const isGoogle =
    providerParam === "google" || providerParam === "facebook" || providerParam === "apple";

  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("male");
  const [countryCode, setCountryCode] = useState("+357");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  // "Change phone number" — a small edit sub-view of the phone stage (step 2), never the profile
  // form. Local edit fields are separate from countryCode/phone so an abandoned edit (Cancel)
  // never clobbers the still-current, already-hydrated number.
  const [isChangingPhone, setIsChangingPhone] = useState(false);
  const [editCountryCode, setEditCountryCode] = useState("+357");
  const [editPhone, setEditPhone] = useState("");
  const [changePhoneError, setChangePhoneError] = useState("");
  const submitProfile = useSubmitProfessionalProfileMutation();
  const sendPhoneOtp = useSendProfessionalPhoneOtpMutation();
  const resendPhoneOtp = useResendProfessionalPhoneOtpMutation();
  const verifyPhoneOtp = useVerifyProfessionalPhoneOtpMutation();
  const changePhone = useChangeProfessionalPhoneMutation();
  const isSubmittingProfile = submitProfile.isPending || sendPhoneOtp.isPending;

  // Authoritative resume source for every entry path (password, Google, Facebook, Apple) — not
  // just the social flow. The RegistrationSession's currentStep, not local `step` state, decides
  // which internal stage renders and whether submitProfile is even safe to call: a session already
  // past EMAIL_VERIFIED (resumed via /professional/auth, a refresh, or re-opening this URL) must
  // never see the profile form again, or submitting it fails server-side with
  // INVALID_REGISTRATION_STEP ("Please complete the previous step first.").
  const registrationProgress = useProfessionalRegistrationProgressQuery(sessionIdParam);
  const emailParam = searchParams.get("email") || registrationProgress.data?.email || "";
  // Closes the race the block above describes: while the very first progress fetch is still in
  // flight, `step` is still its initial default (1) and nothing has confirmed EMAIL_VERIFIED yet
  // — block the profile form's submit button for that brief window so a fast click can't reach
  // submitProfile before the resume-sync effect below has had a chance to route an advanced
  // session away from step 1. (handleFinishSignupSubmit also re-checks currentStep directly, as a
  // second layer, for whenever progress has already resolved.)
  const isCheckingResumeState = registrationProgress.isLoading;

  const getSessionId = () =>
    sessionIdParam || getRegistrationSession("professional", emailParam)?.sessionId || "";

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const progress = registrationProgress.data;
    if (!progress) return;
    if (progress.firstName) setFirstName((current) => current || progress.firstName || "");
    if (progress.lastName) setLastName((current) => current || progress.lastName || "");
    // The phone submitted with the profile (session.phone, set by submitProfile before OTP
    // verification) is the authoritative resume target — a resumed PROFILE_SUBMITTED/
    // PHONE_OTP_SENT session must show and resend against THIS number, never the "+357" default
    // local state starts with. Unlike firstName/lastName above, countryCode's default ("+357") is
    // non-empty, so a "keep current if already set" merge would never apply the real value —
    // this effect only ever runs once per session (see the sessionId-keyed dependency), before
    // the phone form is shown/editable for a resumed session (step is forced to 2 by the sync
    // effect below), so it's safe to set directly rather than merge.
    if (progress.phone) {
      setCountryCode(progress.phone.countryCode);
      setPhone(progress.phone.nationalNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationProgress.data?.sessionId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (registrationProgress.isError) {
      toast.error("We couldn't load your registration details. Please restart signup.");
    }
  }, [registrationProgress.isError]);

  // Guards a one-time-per-session sync so this doesn't fight the `setStep`/redirect calls that
  // handleFinishSignupSubmit and handlePhoneVerifySuccess make after the user actually acts —
  // those update currentStep server-side without changing what this already-fetched query
  // returns, so there's nothing to reconcile after the first sync.
  const resumeSyncedForSessionRef = useRef<string | null>(null);
  const sentPhoneOtpForResumeRef = useRef<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const progress = registrationProgress.data;
    if (!progress || resumeSyncedForSessionRef.current === progress.sessionId) return;
    resumeSyncedForSessionRef.current = progress.sessionId;

    if (progress.currentStep === "EMAIL_VERIFIED") {
      setStep(1);
      return;
    }

    if (progress.currentStep === "PHONE_OTP_SENT") {
      // A code was already sent and may still be valid — show the verification stage as-is;
      // the page's existing "Resend code" button covers "it expired/I didn't get it".
      setStep(2);
      return;
    }

    if (progress.currentStep === "PROFILE_SUBMITTED") {
      // Profile succeeded but the automatic post-submit sendPhoneOtp never completed (e.g. the
      // tab closed between the two calls) — no code has actually been sent for this session yet,
      // so this is a genuine first send, not a duplicate resend.
      setStep(2);
      if (sentPhoneOtpForResumeRef.current !== progress.sessionId) {
        sentPhoneOtpForResumeRef.current = progress.sessionId;
        sendPhoneOtp.mutate(progress.sessionId, {
          onSuccess: () => {
            saveRegistrationSession({
              portal: "professional",
              email: emailParam,
              sessionId: progress.sessionId,
              currentStep: "PHONE_OTP_SENT",
            });
          },
          onError: (error) => toast.error(toUserMessage(error)),
        });
      }
      return;
    }

    // Anything else — PHONE_VERIFIED, VISIT_TYPE_SELECTED, or later — has already moved past
    // what this page owns. Also covers a session unexpectedly still at EMAIL_ENTRY/EMAIL_OTP_SENT
    // (shouldn't reach this URL, but resume forward/back to the correct page rather than error).
    router.replace(
      professionalResumeRoute(progress.currentStep, {
        email: emailParam,
        sessionId: progress.sessionId,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationProgress.data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleFinishSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGoogle) {
      if (!password) {
        setPasswordError("Password is required");
        return;
      }
      if (password.length < 6) {
        setPasswordError("Password must be at least 6 characters");
        return;
      }
    }
    setPasswordError("");

    const sessionId = getSessionId();

    if (!sessionId) {
      setPasswordError("Registration session could not be found. Please start again.");
      return;
    }

    // Defense-in-depth against the race the submit button's disabled state (see below) already
    // closes: if registrationProgress has resolved and the session is no longer at EMAIL_VERIFIED
    // (resumed further along, or advanced in another tab), submitProfile would only fail
    // server-side with INVALID_REGISTRATION_STEP. Route forward instead of making that request.
    const knownStep = registrationProgress.data?.currentStep;
    if (knownStep && knownStep !== "EMAIL_VERIFIED") {
      router.replace(professionalResumeRoute(knownStep, { email: emailParam, sessionId }));
      return;
    }

    try {
      await submitProfile.mutateAsync({
        sessionId,
        firstName,
        lastName,
        gender: gender as "male" | "female" | "other",
        countryCode,
        phone,
        // Google sessions have no password — the backend skips hashing when
        // authProvider === "GOOGLE" and rejects a password on any other path.
        ...(isGoogle ? {} : { password }),
        agreeTerms,
      });
      await sendPhoneOtp.mutateAsync(sessionId);
      saveRegistrationSession({
        portal: "professional",
        email: emailParam,
        sessionId,
        currentStep: "PHONE_OTP_SENT",
      });
      setStep(2);
    } catch (error) {
      setPasswordError(toUserMessage(error));
    }
  };

  const handlePhoneVerifySuccess = async (code: string) => {
    const sessionId = getSessionId();

    if (!sessionId) {
      toast.error("Registration session could not be found. Please start again.");
      return;
    }

    try {
      await verifyPhoneOtp.mutateAsync({ sessionId, code });
      saveRegistrationSession({
        portal: "professional",
        email: emailParam,
        sessionId,
        currentStep: "PHONE_VERIFIED",
      });
      // Visit type is the next onboarding step (backend nextStep: "VISIT_TYPE") — Business Form
      // is reached only after it.
      router.push(
        `/professional/visit-type?email=${encodeURIComponent(emailParam)}&sessionId=${encodeURIComponent(sessionId)}`,
      );
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  };

  const handleResendPhoneOtp = async () => {
    const sessionId = getSessionId();

    if (!sessionId) {
      toast.error("Registration session could not be found. Please start again.");
      return;
    }

    try {
      await resendPhoneOtp.mutateAsync(sessionId);
      toast.success("Verification code sent.");
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  };

  const handleStartChangePhone = () => {
    setEditCountryCode(countryCode);
    setEditPhone(phone);
    setChangePhoneError("");
    setIsChangingPhone(true);
  };

  const handleCancelChangePhone = () => {
    setIsChangingPhone(false);
    setChangePhoneError("");
  };

  const handleSubmitChangePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPhone) {
      setChangePhoneError("Please enter your mobile number");
      return;
    }
    setChangePhoneError("");

    const sessionId = getSessionId();

    if (!sessionId) {
      setChangePhoneError("Registration session could not be found. Please start again.");
      return;
    }

    try {
      await changePhone.mutateAsync({
        sessionId,
        countryCode: editCountryCode,
        nationalNumber: editPhone,
      });
      // The backend has already saved the new phone and sent a code to it (one request) — mirror
      // that into local/cached state the same way every other successful step does, so a refresh
      // or resume restores this number, never the one it replaced.
      setCountryCode(editCountryCode);
      setPhone(editPhone);
      saveRegistrationSession({
        portal: "professional",
        email: emailParam,
        sessionId,
        currentStep: "PHONE_OTP_SENT",
      });
      setIsChangingPhone(false);
      toast.success("Verification code sent to your new number.");
    } catch (error) {
      // The backend only advances past the phone-save on a successful send (see
      // AuthService.changeProfessionalPhone) — if this failed, the new number may or may not
      // already be saved server-side depending on where it failed. Staying on this edit view (not
      // silently reverting to the old number here) lets the user see the error and retry the same
      // submit, which is safe either way: unchanged input re-sends the same normalized phone.
      setChangePhoneError(toUserMessage(error));
    }
  };

  const handleBack = () => {
    if (step === 2) {
      // Every path that reaches step 2 (the resume sync above, or a successful submit in
      // handleFinishSignupSubmit) only does so once the session is already past EMAIL_VERIFIED
      // server-side. submitProfile's backend guard only accepts EMAIL_VERIFIED, so re-showing the
      // profile form here would let the user resubmit into a session state that always rejects
      // it with INVALID_REGISTRATION_STEP. There is no valid "back" target from this stage — stay
      // on the phone stage (the back control itself is hidden here, see AuthLayout below; this is
      // a defensive no-op in case handleBack is ever reached some other way).
      return;
    } else if (isGoogle) {
      // No email-OTP step in the Google flow — go back to the professional entry screen.
      router.push("/professional/auth");
    } else {
      router.push(`/professional/verify?email=${encodeURIComponent(emailParam)}`);
    }
  };

  return (
    <div className="w-full">
      {/* No back control on the phone stage — there is no valid destination to go back to once
          the session has moved past EMAIL_VERIFIED (see handleBack). */}
      <AuthLayout onBack={handleBack} showBack={step === 1} imageSrc="/img/authImg2.png">
        {step === 1 ? (
          <AuthCard
            title="Finish signing up"
            subtitle="Fill the information to complete the setup"
          >
            <form onSubmit={handleFinishSignupSubmit} className="flex flex-col gap-5 w-full">
              {/* Names side by side */}
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-[520px]">
                <InputField
                  label="First name"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <InputField
                  label="Last name"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>

              {/* Gender */}
              <SelectField
                label="Gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ]}
              />

              {/* Phone number */}
              <PhoneInputField
                label="Mobile number"
                countryCode={countryCode}
                onCountryCodeChange={setCountryCode}
                placeholder="123456666"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />

              {/* Email (disabled) */}
              <InputField
                label="Email"
                type="email"
                value={emailParam || "example@gmail.com"}
                disabled
                icon={<HugeiconsIcon icon={Mail01Icon} size={20} />}
              />

              {/* Password — omitted for a Google sign-up (that account has no password). */}
              {isGoogle ? (
                passwordError ? (
                  <p className="text-xs font-semibold text-red-500 -mt-2">{passwordError}</p>
                ) : null
              ) : (
                <InputField
                  label="Password"
                  placeholder="Password"
                  isPassword
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={passwordError}
                  icon={<HugeiconsIcon icon={SquareLock01Icon} size={20} />}
                  required
                />
              )}

              {/* Terms checkbox */}
              <div className="flex items-start gap-2 mt-2">
                <input
                  type="checkbox"
                  id="agree-terms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-4.5 h-4.5 rounded border-[#DAD6FF] text-[#240183] focus:ring-[#240183] cursor-pointer mt-0.5"
                  required
                />
                <label
                  htmlFor="agree-terms"
                  className="text-xs font-semibold text-[#1A1A1A] cursor-pointer select-none leading-relaxed"
                >
                  I agree to the Bookly <Link href="/terms-of-service" className="text-[#240183] underline hover:text-black transition-colors">Terms & Conditions</Link>, including the <Link href="/terms-of-use" className="text-[#240183] underline hover:text-black transition-colors">Business Partner Terms</Link>
                </label>
              </div>

              <button
                type="submit"
                disabled={!agreeTerms || isSubmittingProfile || isCheckingResumeState}
                className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {isSubmittingProfile ? <Spinner className="text-white" /> : "Agree & create account"}
              </button>
            </form>
          </AuthCard>
        ) : isChangingPhone ? (
          <AuthCard
            title="Change phone number"
            subtitle="Enter a different number to receive a new verification code"
          >
            <form onSubmit={handleSubmitChangePhone} className="flex flex-col gap-5 w-full">
              <PhoneInputField
                label="Mobile number"
                countryCode={editCountryCode}
                onCountryCodeChange={setEditCountryCode}
                placeholder="123456666"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                required
              />
              {changePhoneError ? (
                <p className="text-xs font-semibold text-red-500 -mt-2">{changePhoneError}</p>
              ) : null}
              <div className="flex gap-3 w-full max-w-[520px] mt-2">
                <button
                  type="button"
                  onClick={handleCancelChangePhone}
                  disabled={changePhone.isPending}
                  className="flex-1 h-12 border border-[#EBE8FF] hover:bg-[#F5F3FF] text-[#240183] font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePhone.isPending}
                  className="flex-1 h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changePhone.isPending ? <Spinner className="text-white" /> : "Send code"}
                </button>
              </div>
            </form>
          </AuthCard>
        ) : (
          <div className="w-full flex flex-col items-center">
            {/* Remounts on a phone change (key) so any partially-typed OTP digits from the old
                number never carry over to the new one. */}
            <PhoneVerificationStep2
              key={`${countryCode}-${phone}`}
              countryCode={countryCode}
              mobileNumber={phone}
              onVerify={handlePhoneVerifySuccess}
              onResend={handleResendPhoneOtp}
              onBack={handleBack}
              isVerifying={verifyPhoneOtp.isPending}
              isResending={resendPhoneOtp.isPending}
            />
            <button
              type="button"
              onClick={handleStartChangePhone}
              className="text-xs font-semibold text-[#240183] hover:underline cursor-pointer mt-4"
            >
              Change phone number
            </button>
          </div>
        )}
      </AuthLayout>

      {/* Successfully Created Modal */}
      <SuccessModal
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        onContinue={() => {
          setIsSuccessOpen(false);
          router.push(
            `/professional/visit-type?email=${encodeURIComponent(emailParam)}&sessionId=${encodeURIComponent(getSessionId())}`,
          );
        }}
      />
    </div>
  );
}

export default function ProfessionalSignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white font-poppins">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#240183] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#707070] font-medium">Loading form...</p>
        </div>
      </div>
    }>
      <ProfessionalSignupContent />
    </Suspense>
  );
}
