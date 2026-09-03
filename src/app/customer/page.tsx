"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon } from "@hugeicons/core-free-icons";

// Components
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import { InputField } from "@/components/auth/InputField";
import SocialButton from "@/components/auth/SocialButton";
import { Spinner } from "@/components/ui/spinner";
import { toUserMessage } from "@/lib/auth/messages";
import { saveRegistrationSession } from "@/lib/auth/registration-session";
import {
  useCustomerEntryMutation,
  useCustomerGoogleAuthMutation,
  useSendCustomerEmailOtpMutation,
} from "@/lib/auth/hooks";

export default function CustomerAuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const customerEntry = useCustomerEntryMutation();
  const sendEmailOtp = useSendCustomerEmailOtpMutation();
  const googleAuth = useCustomerGoogleAuthMutation();
  const isSubmitting = customerEntry.isPending || sendEmailOtp.isPending;

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
      const result = await customerEntry.mutateAsync(email);

      if (result.nextStep === "PASSWORD_LOGIN") {
        router.push(`/customer/password?email=${encodeURIComponent(email)}`);
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
        portal: "customer",
        email,
        sessionId: result.sessionId,
        currentStep: result.currentStep,
      });
      await sendEmailOtp.mutateAsync(result.sessionId);
      saveRegistrationSession({
        portal: "customer",
        email,
        sessionId: result.sessionId,
        currentStep: "EMAIL_OTP_SENT",
      });
      router.push(
        `/customer/verify?email=${encodeURIComponent(email)}&sessionId=${encodeURIComponent(result.sessionId)}`,
      );
    } catch (error) {
      setEmailError(toUserMessage(error));
    }
  };

  return (
    <div className="w-full">
      <AuthLayout onBack={() => router.push("/")} imageSrc="/img/authImg.png">
        <AuthCard
          title="Bookly for customers"
          subtitle="Create an account or log in to book and manage your appointments"
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
              label="Continue With Apple"
              onClick={() => console.log("Apple Login clicked")}
            />
            <SocialButton
              provider="facebook"
              label="Continue With Facebook"
              onClick={() => console.log("Facebook Login clicked")}
            />
          </div>

          {/* Google sign-up/sign-in carries the same Terms agreement as the email signup checkbox. */}
          <p className="mt-4 text-center text-xs text-[#9E9E9E] w-full max-w-[520px] leading-relaxed">
            By continuing with Google you agree to Bookly&apos;s{" "}
            <Link
              href="/terms-of-service"
              className="text-[#240183] underline hover:text-black transition-colors"
            >
              Terms &amp; Conditions
            </Link>
            .
          </p>

          {/* Footer option link */}
          <div className="text-center mt-8 w-full max-w-[520px]">
            <p className="text-sm font-semibold text-[#1A1A1A] mb-1">
              Have a business account?
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-sm font-semibold text-[#240183] hover:underline cursor-pointer"
            >
              Go to Bookly for professionals
            </button>
          </div>
        </AuthCard>
      </AuthLayout>
    </div>
  );
}
