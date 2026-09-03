"use client";

import React, { useEffect, useState, Suspense } from "react";
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
import type { VisitType } from "@/lib/api/auth";
import {
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

const toBackendVisitType = (visitType: string): VisitType =>
  visitType === "location" ? "AT_BUSINESS_LOCATION" : "TRAVEL_TO_CUSTOMER";

function ProfessionalSignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visitType = searchParams.get("type") || "travel";
  const sessionIdParam = searchParams.get("sessionId") || "";
  // Phase 2C — a Google-verified Business Owner arrives here from
  // /auth/google/callback?flow=professional&status=onboarding. Their RegistrationSession already
  // exists (Option B: no User yet), the email is Google-verified, and there is NO password.
  const isGoogle = searchParams.get("provider") === "google";

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
  const submitProfile = useSubmitProfessionalProfileMutation();
  const sendPhoneOtp = useSendProfessionalPhoneOtpMutation();
  const resendPhoneOtp = useResendProfessionalPhoneOtpMutation();
  const verifyPhoneOtp = useVerifyProfessionalPhoneOtpMutation();
  const isSubmittingProfile = submitProfile.isPending || sendPhoneOtp.isPending;

  // Google flow only: the name + email were captured server-side (from the Google id_token) when
  // the session was seeded. Fetch them so the name fields are prefilled and the email row is
  // authoritative. Disabled (empty sessionId) for the password flow.
  const registrationProgress = useProfessionalRegistrationProgressQuery(
    isGoogle ? sessionIdParam : "",
  );
  const emailParam = searchParams.get("email") || registrationProgress.data?.email || "";

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const progress = registrationProgress.data;
    if (!progress) return;
    if (progress.firstName) setFirstName((current) => current || progress.firstName || "");
    if (progress.lastName) setLastName((current) => current || progress.lastName || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationProgress.data?.sessionId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const getSessionId = () =>
    sessionIdParam || getRegistrationSession("professional", emailParam)?.sessionId || "";

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
        visitType: toBackendVisitType(visitType),
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
        visitType: toBackendVisitType(visitType),
      });
      router.push(
        `/professional/business-form?email=${encodeURIComponent(emailParam)}&type=${visitType}&sessionId=${encodeURIComponent(sessionId)}`,
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

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (isGoogle) {
      // No email-OTP step in the Google flow — go back to the professional entry screen.
      router.push(`/professional/auth?type=${visitType}`);
    } else {
      router.push(`/professional/verify?email=${encodeURIComponent(emailParam)}&type=${visitType}`);
    }
  };

  return (
    <div className="w-full">
      <AuthLayout onBack={handleBack} imageSrc="/img/authImg2.png">
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
                disabled={!agreeTerms || isSubmittingProfile}
                className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {isSubmittingProfile ? <Spinner className="text-white" /> : "Agree & create account"}
              </button>
            </form>
          </AuthCard>
        ) : (
          <PhoneVerificationStep2
            countryCode={countryCode}
            mobileNumber={phone}
            onVerify={handlePhoneVerifySuccess}
            onResend={handleResendPhoneOtp}
            onBack={handleBack}
            isVerifying={verifyPhoneOtp.isPending}
            isResending={resendPhoneOtp.isPending}
          />
        )}
      </AuthLayout>

      {/* Successfully Created Modal */}
      <SuccessModal
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        onContinue={() => {
          setIsSuccessOpen(false);
          router.push(`/professional/business-form?email=${encodeURIComponent(emailParam)}&type=${visitType}`);
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
