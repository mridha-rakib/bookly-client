"use client";

import React, { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon, Cancel01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import {
  useRequestBusinessLinkVerificationMutation,
  useResendBusinessLinkVerificationMutation,
  useVerifyBusinessLinkMutation,
} from "@/lib/business/hooks";

interface AddBusinessLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "EMAIL" | "OTP" | "SUCCESS";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddBusinessLinkModal({ isOpen, onClose }: AddBusinessLinkModalProps) {
  const [step, setStep] = useState<Step>("EMAIL");
  const [email, setEmail] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [otp, setOtp] = useState<string[]>(["", "", "", ""]);
  const [activeBox, setActiveBox] = useState(0);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const requestVerification = useRequestBusinessLinkVerificationMutation();
  const resendVerification = useResendBusinessLinkVerificationMutation();
  const verifyLink = useVerifyBusinessLinkMutation();

  useEffect(() => {
    if (step === "OTP") {
      otpInputsRef.current[0]?.focus();
    }
  }, [step]);

  const resetAndClose = () => {
    setStep("EMAIL");
    setEmail("");
    setVerificationId(null);
    setOtp(["", "", "", ""]);
    setActiveBox(0);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const handleNext = (event: React.FormEvent) => {
    event.preventDefault();

    if (requestVerification.isPending) {
      return;
    }

    const normalizedEmail = email.trim();

    if (!emailPattern.test(normalizedEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }

    requestVerification.mutate(normalizedEmail, {
      onSuccess: (result) => {
        setVerificationId(result.verificationId);
        setOtp(["", "", "", ""]);
        setStep("OTP");
      },
      onError: (error) => {
        toast.error(toUserMessage(error));
      },
    });
  };

  const applyOtp = (value: string, index: number) => {
    if (value && !/^\d+$/.test(value)) {
      return;
    }

    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);

    if (value && index < 3) {
      otpInputsRef.current[index + 1]?.focus();
      setActiveBox(index + 1);
    }
  };

  const handleOtpKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== "Backspace") {
      return;
    }

    if (!otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = "";
      setOtp(next);
      otpInputsRef.current[index - 1]?.focus();
      setActiveBox(index - 1);
      return;
    }

    const next = [...otp];
    next[index] = "";
    setOtp(next);
  };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);

    if (pasted.length === 0) {
      return;
    }

    event.preventDefault();
    const next = ["", "", "", ""];
    for (let index = 0; index < pasted.length; index += 1) {
      next[index] = pasted[index] ?? "";
    }
    setOtp(next);
    const lastIndex = Math.min(pasted.length, 4) - 1;
    otpInputsRef.current[lastIndex]?.focus();
    setActiveBox(lastIndex);
  };

  const handleVerify = (event: React.FormEvent) => {
    event.preventDefault();

    const code = otp.join("");

    if (code.length < 4 || !verificationId || verifyLink.isPending) {
      return;
    }

    verifyLink.mutate(
      { verificationId, code },
      {
        onSuccess: () => setStep("SUCCESS"),
        onError: (error) => {
          toast.error(toUserMessage(error));
          setOtp(["", "", "", ""]);
          otpInputsRef.current[0]?.focus();
          setActiveBox(0);
        },
      },
    );
  };

  const handleResend = () => {
    if (!verificationId || resendVerification.isPending) {
      return;
    }

    resendVerification.mutate(verificationId, {
      onSuccess: () => {
        toast.success("A new verification code was sent.");
        setOtp(["", "", "", ""]);
        otpInputsRef.current[0]?.focus();
        setActiveBox(0);
      },
      onError: (error) => {
        toast.error(toUserMessage(error));
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 select-none font-poppins">
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative flex flex-col items-center w-[438px] max-w-full bg-white rounded-xl shadow-[0px_2px_3px_rgba(0,0,0,0.25)] p-5 gap-5 animate-fadeIn"
      >
        {step === "EMAIL" && (
          <form onSubmit={handleNext} className="flex flex-col items-center w-full gap-5">
            <div className="flex flex-col items-center gap-1 w-full">
              <h2 className="w-full font-poppins font-medium text-[28px] leading-9 text-center text-[#262626]">
                Add business
              </h2>
              <p className="w-full font-poppins font-normal text-sm leading-5 text-left text-[#4D4D4D]">
                Enter the email address of another business account you own on Bookly. Once
                connected, customers can view and access your other businesses from landing page.
              </p>
            </div>

            <div className="flex flex-col items-start gap-1 w-full">
              <label
                htmlFor="add-business-email"
                className="font-poppins font-medium text-sm leading-5 tracking-[-0.015em] text-[#262626]"
              >
                Email
              </label>
              <div className="box-border flex flex-row items-center px-4 py-3.5 gap-1.5 w-full h-[52px] bg-[#F4F4F6] border border-[#DAD6FF] rounded-xl">
                <HugeiconsIcon icon={Mail01Icon} className="w-6 h-6 text-[#262626] shrink-0" />
                <input
                  id="add-business-email"
                  type="email"
                  placeholder="Email"
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="flex-1 bg-transparent font-poppins text-sm text-[#262626] placeholder-[#808080] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 w-full">
              <button
                type="submit"
                disabled={requestVerification.isPending}
                className="flex flex-row justify-center items-center px-8 py-5 gap-2 w-full h-[52px] bg-[#0D0D0D] hover:bg-black text-white rounded-xl font-poppins font-medium text-sm tracking-[-0.015em] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {requestVerification.isPending ? <Spinner className="text-white" /> : "Next"}
              </button>
              <button
                type="button"
                onClick={resetAndClose}
                className="font-poppins font-medium text-base leading-6 tracking-[-0.015em] text-[#240183] hover:underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {step === "OTP" && (
          <form onSubmit={handleVerify} className="flex flex-col items-center w-full gap-5">
            <div className="flex flex-col items-center gap-1 w-full">
              <h2 className="w-full font-poppins font-medium text-[28px] leading-9 text-center text-[#262626]">
                Verification required
              </h2>
              <p className="w-full font-poppins font-normal text-sm leading-5 text-center text-[#4D4D4D]">
                Enter the verification code sent to <span className="font-medium">{email}</span>
              </p>
            </div>

            <div className="flex gap-3">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    otpInputsRef.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={digit}
                  onFocus={() => setActiveBox(index)}
                  onChange={(event) => applyOtp(event.target.value, index)}
                  onKeyDown={(event) => handleOtpKeyDown(event, index)}
                  onPaste={handleOtpPaste}
                  className={`w-14 h-16 text-center text-2xl font-semibold rounded-2xl border-2 bg-[#FCFCFD] text-[#262626] focus:outline-none transition-all duration-200 ${
                    activeBox === index
                      ? "border-[#240183] bg-white shadow-sm ring-2 ring-[#240183]/10"
                      : "border-[#DAD6FF]"
                  }`}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={otp.join("").length < 4 || verifyLink.isPending}
              className="flex flex-row justify-center items-center px-8 py-5 gap-2 w-full h-[52px] bg-[#0D0D0D] hover:bg-black text-white rounded-xl font-poppins font-medium text-sm tracking-[-0.015em] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {verifyLink.isPending ? <Spinner className="text-white" /> : "Verify"}
            </button>

            <p className="font-poppins text-xs text-[#4D4D4D]">
              Didn&apos;t receive OTP?{" "}
              <button
                type="button"
                disabled={resendVerification.isPending}
                onClick={handleResend}
                className="font-medium text-[#240183] hover:underline cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Resend code
              </button>
            </p>
          </form>
        )}

        {step === "SUCCESS" && (
          <div className="flex flex-col items-center w-full gap-5">
            <button
              type="button"
              onClick={resetAndClose}
              aria-label="Close"
              className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center text-[#4D4D4D] hover:text-[#262626] cursor-pointer"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="w-5 h-5" />
            </button>

            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              className="w-14 h-14 text-[#4FC3E8]"
            />

            <div className="flex flex-col items-center gap-1 w-full">
              <h2 className="w-full font-poppins font-medium text-[28px] leading-9 text-center text-[#262626]">
                Successfully Connected
              </h2>
              <p className="w-full font-poppins font-normal text-sm leading-5 text-center text-[#4D4D4D]">
                Business connected successfully. Customers can now discover this business through
                your connected Bookly network.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
