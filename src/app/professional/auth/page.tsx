"use client";

import React, { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon } from "@hugeicons/core-free-icons";

// Components
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import { InputField } from "@/components/auth/InputField";
import SocialButton from "@/components/auth/SocialButton";
import { Spinner } from "@/components/ui/spinner";
import {
  useProfessionalAppleAuthMutation,
  useProfessionalEntryMutation,
  useProfessionalFacebookAuthMutation,
  useProfessionalGoogleAuthMutation,
  useSendProfessionalEmailOtpMutation,
} from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import { professionalResumeRoute } from "@/lib/auth/resume-routing";
import { saveRegistrationSession } from "@/lib/auth/registration-session";

function ProfessionalAuthContent() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const professionalEntry = useProfessionalEntryMutation();
  const sendEmailOtp = useSendProfessionalEmailOtpMutation();
  const googleAuth = useProfessionalGoogleAuthMutation();
  const facebookAuth = useProfessionalFacebookAuthMutation();
  const appleAuth = useProfessionalAppleAuthMutation();
  const isSubmitting = professionalEntry.isPending || sendEmailOtp.isPending;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setEmailError("Please enter your email");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError("");

    try {
      const result = await professionalEntry.mutateAsync({ email });

      if (result.nextStep === "PASSWORD_LOGIN") {
        router.push(`/professional/password?email=${encodeURIComponent(email)}`);
        return;
      }

      if (result.nextStep === "PORTAL_MISMATCH") {
        setEmailError("This email belongs to a different Bookly portal.");
        return;
      }

      if (!result.sessionId) {
        setEmailError("Registration session could not be started. Please try again.");
        return;
      }

      saveRegistrationSession({
        portal: "professional",
        email,
        sessionId: result.sessionId,
        currentStep: result.currentStep,
      });

      // A brand-new session starts at EMAIL_ENTRY — send the first OTP and go verify. Any other
      // currentStep means `entry` reused an existing, already-advanced session (the user is
      // resuming, not starting over): route it to wherever it actually left off instead of
      // restarting at email verification. This is the fix for the audited resume bug — reusing
      // an advanced session used to be forced back through an early visit-type guard and fail
      // with "Please complete the previous step first."
      if (result.currentStep && result.currentStep !== "EMAIL_ENTRY") {
        router.push(professionalResumeRoute(result.currentStep, { email, sessionId: result.sessionId }));
        return;
      }

      await sendEmailOtp.mutateAsync(result.sessionId);
      saveRegistrationSession({
        portal: "professional",
        email,
        sessionId: result.sessionId,
        currentStep: "EMAIL_OTP_SENT",
      });
      router.push(
        `/professional/verify?email=${encodeURIComponent(email)}&sessionId=${encodeURIComponent(result.sessionId)}`,
      );
    } catch (error) {
      setEmailError(toUserMessage(error));
    }
  };

  return (
    <AuthLayout onBack={() => router.push("/")} imageSrc="/img/authImg2.png">
      <AuthCard
        title="Bookly for professionals"
        subtitle="Create an account or log in to manage your business."
      >
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-6 w-full">
          <InputField
            label="Email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
            helperText="We’ll send you a verification code at your email"
            icon={<HugeiconsIcon icon={Mail01Icon} size={20} />}
            required
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer"
          >
            {isSubmitting ? <Spinner className="text-white" /> : "Continue"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6 w-full max-w-[520px]">
          <div className="flex-1 border-t border-[#E8E6FF]" />
          <span className="px-3 text-xs font-semibold text-[#9E9E9E] tracking-wider">OR</span>
          <div className="flex-1 border-t border-[#E8E6FF]" />
        </div>

        {/* Social Logins */}
        <div className="flex flex-col gap-3 w-full">
          <SocialButton
            provider="google"
            label={googleAuth.isPending ? "Redirecting to Google…" : "Continue With Google"}
            onClick={() => googleAuth.mutate()}
            disabled={googleAuth.isPending}
            aria-busy={googleAuth.isPending}
          />
          <SocialButton
            provider="apple"
            label={appleAuth.isPending ? "Redirecting to Apple…" : "Continue With Apple"}
            onClick={() => appleAuth.mutate()}
            disabled={appleAuth.isPending}
            aria-busy={appleAuth.isPending}
          />
          <SocialButton
            provider="facebook"
            label={facebookAuth.isPending ? "Redirecting to Facebook…" : "Continue With Facebook"}
            onClick={() => facebookAuth.mutate()}
            disabled={facebookAuth.isPending}
            aria-busy={facebookAuth.isPending}
          />
        </div>

        {/* Footer option link */}
        <div className="text-center mt-8 w-full max-w-[520px]">
          <p className="text-sm font-semibold text-[#1A1A1A] mb-1">
            Are you a customer looking to book an appointment?
          </p>
          <button
            type="button"
            onClick={() => router.push("/customer")}
            className="text-sm font-semibold text-[#240183] hover:underline cursor-pointer"
          >
            Go to Bookly for customers
          </button>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

export default function ProfessionalAuthPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white font-poppins">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#240183] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#707070] font-medium">Loading auth...</p>
        </div>
      </div>
    }>
      <ProfessionalAuthContent />
    </Suspense>
  );
}
