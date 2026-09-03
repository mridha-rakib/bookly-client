"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon } from "@hugeicons/core-free-icons";

// Components
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import { InputField } from "@/components/auth/InputField";
import SocialButton from "@/components/auth/SocialButton";
import { Spinner } from "@/components/ui/spinner";
import type { VisitType } from "@/lib/api/auth";
import {
  useProfessionalEntryMutation,
  useProfessionalGoogleAuthMutation,
  useSendProfessionalEmailOtpMutation,
} from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import { saveRegistrationSession } from "@/lib/auth/registration-session";

const toBackendVisitType = (visitType: string): VisitType =>
  visitType === "location" ? "AT_BUSINESS_LOCATION" : "TRAVEL_TO_CUSTOMER";

function ProfessionalAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visitType = searchParams.get("type") || "travel";

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const professionalEntry = useProfessionalEntryMutation();
  const sendEmailOtp = useSendProfessionalEmailOtpMutation();
  const googleAuth = useProfessionalGoogleAuthMutation();
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
      const backendVisitType = toBackendVisitType(visitType);
      const result = await professionalEntry.mutateAsync({ email, visitType: backendVisitType });

      if (result.nextStep === "PASSWORD_LOGIN") {
        router.push(`/professional/password?email=${encodeURIComponent(email)}&type=${visitType}`);
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
        visitType: backendVisitType,
      });
      await sendEmailOtp.mutateAsync(result.sessionId);
      saveRegistrationSession({
        portal: "professional",
        email,
        sessionId: result.sessionId,
        currentStep: "EMAIL_OTP_SENT",
        visitType: backendVisitType,
      });
      router.push(
        `/professional/verify?email=${encodeURIComponent(email)}&type=${visitType}&sessionId=${encodeURIComponent(result.sessionId)}`,
      );
    } catch (error) {
      setEmailError(toUserMessage(error));
    }
  };

  return (
    <AuthLayout onBack={() => router.push(`/professional?type=${visitType}`)} imageSrc="/img/authImg2.png">
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
            onClick={() => googleAuth.mutate(toBackendVisitType(visitType))}
            disabled={googleAuth.isPending}
            aria-busy={googleAuth.isPending}
          />
          <SocialButton
            provider="apple"
            label="Continue With Apple"
            onClick={() => console.log("Apple Login clicked")}
          />
          <SocialButton
            provider="facebook"
            label="Continue With Facebook"
            onClick={() => console.log("Facebook Login clicked")}
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
