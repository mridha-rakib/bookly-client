"use client";

import React from "react";
import { Spinner } from "@/components/ui/spinner";
import { useOtpInput } from "@/hooks/useOtpInput";

/** SMS OTP length — Twilio Verify (backend PHONE_OTP_CODE_LENGTH) delivers 6-digit codes. */
const PHONE_OTP_LENGTH = 6;

export interface PhoneVerificationStep2Props {
  countryCode: string;
  mobileNumber: string;
  onVerify: (code: string) => void | Promise<void>;
  onBack: () => void;
  onResend?: () => void | Promise<void>;
  isVerifying?: boolean;
  isResending?: boolean;
}

export default function PhoneVerificationStep2({
  countryCode,
  mobileNumber,
  onVerify,
  onResend,
  isVerifying = false,
  isResending = false,
}: PhoneVerificationStep2Props) {
  const otp = useOtpInput(PHONE_OTP_LENGTH);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.value.length === PHONE_OTP_LENGTH) {
      await onVerify(otp.value);
    }
  };

  return (
    <div className="w-full max-w-[600px] bg-white border border-[#E8E6FF] rounded-[24px] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative flex flex-col items-center mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col items-center w-full">
        <h2 className="text-2xl sm:text-[28px] font-semibold text-[#1A1A1A] tracking-tight leading-tight mb-2 text-center">
          Phone Verification
        </h2>
        <p className="text-sm text-[#707070] leading-relaxed mb-8 text-center max-w-[420px]">
          Enter the verification code sent to your phone number{" "}
          <span className="font-semibold text-[#1A1A1A]">
            {countryCode} {mobileNumber}
          </span>
        </p>

        {/* OTP Box Wrapper — 6 digits (Twilio Verify) */}
        <div className="flex gap-1.5 sm:gap-2.5 mb-8">
          {otp.values.map((digit, idx) => {
            const isActive = otp.activeBox === idx;
            return (
              <input
                key={idx}
                ref={otp.registerRef(idx)}
                type="text"
                pattern="\d*"
                inputMode="numeric"
                autoComplete={idx === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onFocus={() => otp.setActiveBox(idx)}
                onKeyDown={(e) => otp.handleKeyDown(e, idx)}
                onChange={(e) => otp.handleChange(e.target.value, idx)}
                onPaste={otp.handlePaste}
                className={`w-10 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-semibold rounded-2xl border-2 bg-[#FCFCFD] text-[#1A1A1A] focus:outline-none transition-all duration-200 ${
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
          disabled={otp.value.length < PHONE_OTP_LENGTH || isVerifying}
          className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isVerifying ? <Spinner className="text-white" /> : "Verify"}
        </button>

        {/* Resend text */}
        <p className="text-xs text-[#707070] mt-6">
          Didn&apos;t receive OTP?{" "}
          <button
            type="button"
            disabled={isResending}
            className="text-[#240183] font-semibold hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onResend}
          >
            Resend code
          </button>
        </p>
      </form>
    </div>
  );
}
