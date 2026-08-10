"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Components
import AuthLayout from "@/components/auth/AuthLayout";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import {
  useResendCustomerEmailOtpMutation,
  useVerifyCustomerEmailOtpMutation,
} from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import {
  getRegistrationSession,
  saveRegistrationSession,
} from "@/lib/auth/registration-session";

function VerifyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const sessionIdParam = searchParams.get("sessionId") || "";
  const flow = searchParams.get("flow") || "";

  const [otp, setOtp] = useState<string[]>(["", "", "", ""]);
  const [activeBox, setActiveBox] = useState<number>(0);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const verifyEmailOtp = useVerifyCustomerEmailOtpMutation();
  const resendEmailOtp = useResendCustomerEmailOtpMutation();
  const isSubmitting = verifyEmailOtp.isPending;
  const isResending = resendEmailOtp.isPending;

  const getSessionId = () =>
    sessionIdParam || getRegistrationSession("customer", email)?.sessionId || "";

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (value: string, index: number) => {
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (value && index < 3) {
      inputsRef.current[index + 1]?.focus();
      setActiveBox(index + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputsRef.current[index - 1]?.focus();
        setActiveBox(index - 1);
      } else {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpValue = otp.join("");
    if (otpValue.length === 4) {
      if (flow === "reset") {
        router.push(`/customer/new-password?email=${encodeURIComponent(email)}`);
      } else {
        const sessionId = getSessionId();

        if (!sessionId) {
          toast.error("Registration session could not be found. Please start again.");
          return;
        }

        try {
          await verifyEmailOtp.mutateAsync({ sessionId, code: otpValue });
          saveRegistrationSession({
            portal: "customer",
            email,
            sessionId,
            currentStep: "EMAIL_VERIFIED",
          });
          router.push(
            `/customer/signup?email=${encodeURIComponent(email)}&sessionId=${encodeURIComponent(sessionId)}`,
          );
        } catch (error) {
          toast.error(toUserMessage(error));
        }
      }
    }
  };

  const handleResend = async () => {
    const sessionId = getSessionId();

    if (!sessionId) {
      toast.error("Registration session could not be found. Please start again.");
      return;
    }

    try {
      await resendEmailOtp.mutateAsync(sessionId);
      toast.success("Verification code sent.");
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  };

  const handleBack = () => {
    if (flow === "reset") {
      router.push(`/customer/forgot-password?email=${encodeURIComponent(email)}`);
    } else {
      router.push("/customer");
    }
  };

  return (
    <AuthLayout onBack={handleBack} imageSrc="/img/authImg.png">
      <div className="w-full max-w-[600px] bg-white border border-[#E8E6FF] rounded-[24px] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative">
        <form onSubmit={handleSubmit} className="flex flex-col items-center">
          <h2 className="text-2xl sm:text-[28px] font-semibold text-[#1A1A1A] tracking-tight leading-tight mb-2 text-center">
            Verification required
          </h2>
          <p className="text-sm text-[#707070] leading-relaxed mb-8 text-center max-w-[420px]">
            Enter the verification code sent to your email address{" "}
            <span className="font-semibold text-[#1A1A1A]">{email || "example@gmail.com"}</span>
          </p>

          {/* OTP Box Wrapper */}
          <div className="flex gap-4 mb-8">
            {otp.map((digit, idx) => {
              const isActive = activeBox === idx;
              return (
                <input
                  key={idx}
                  ref={(el) => {
                    inputsRef.current[idx] = el;
                  }}
                  type="text"
                  pattern="\d*"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onFocus={() => setActiveBox(idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  onChange={(e) => handleChange(e.target.value, idx)}
                  className={`w-14 h-16 sm:w-16 sm:h-20 text-center text-2xl font-semibold rounded-2xl border-2 bg-[#FCFCFD] text-[#1A1A1A] focus:outline-none transition-all duration-200 ${
                    isActive
                      ? "border-[#240183] bg-white shadow-sm ring-2 ring-[#240183]/10"
                      : "border-[#DAD6FF]"
                  }`}
                />
              );
            })}
          </div>

          {/* Verify Button */}
          <button
            type="submit"
            disabled={otp.join("").length < 4 || isSubmitting}
            className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Spinner className="text-white" /> : "Verify"}
          </button>

          {/* Resend text */}
          <p className="text-xs text-[#707070] mt-6">
            Didn&apos;t receive OTP?{" "}
            <button
              type="button"
              disabled={isResending}
              className="text-[#240183] font-semibold hover:underline cursor-pointer"
              onClick={handleResend}
            >
              Resend code
            </button>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white font-poppins">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#240183] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#707070] font-medium">Loading verification...</p>
        </div>
      </div>
    }>
      <VerifyPageContent />
    </Suspense>
  );
}
