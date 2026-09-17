"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock01Icon, ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import Image from "next/image";

// Components
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import { InputField } from "@/components/auth/InputField";

function NewPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError("Please fill in both password fields");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setIsSuccessOpen(true);
  };

  return (
    <AuthLayout onBack={() => router.push(`/professional/verify?email=${encodeURIComponent(email)}&flow=reset`)} imageSrc="/img/authImg2.png">
      <AuthCard
        title="New Password"
        subtitle="Set your new password to continue"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
          <InputField
            label="New Password"
            placeholder="Password"
            isPassword
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<HugeiconsIcon icon={SquareLock01Icon} size={20} />}
            required
          />
          <InputField
            label="Confirm Password"
            placeholder="Password"
            isPassword
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={error}
            icon={<HugeiconsIcon icon={SquareLock01Icon} size={20} />}
            required
          />

          <button
            type="submit"
            className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer mt-4"
          >
            Done
          </button>
        </form>
      </AuthCard>

      {/* Successfully Changed Modal overlay */}
      {isSuccessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-[#FAFAFA]/95 backdrop-blur-[6px] transition-opacity" />

          {/* Modal Container */}
          <div className="w-full max-w-[480px] bg-white border border-[#E8E6FF] rounded-[24px] p-8 sm:p-10 shadow-[0_16px_40px_rgba(36,1,131,0.06)] relative z-10 flex flex-col items-center text-center">
            {/* Success Icon */}
            <div className="relative w-20 h-20 mb-6 flex items-center justify-center rounded-full bg-[#EBF8FF] overflow-hidden">
              <Image
                src="/Icons/acceptBtn.svg"
                alt="Success Icon"
                width={80}
                height={80}
                className="object-contain"
              />
            </div>

            {/* Text Details */}
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">
              Successfully Changed
            </h2>
            <p className="text-sm text-[#707070] leading-relaxed mb-8 max-w-[320px]">
              Return to the login page to enter your account with your new password
            </p>

            {/* Back to Login link */}
            <button
              onClick={() => router.push("/professional/auth")}
              className="flex items-center justify-center gap-1.5 w-full h-12 border border-[#EBE8FF] hover:bg-[#F5F3FF] text-[#240183] font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer"
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} size={16} />
              <span>Back to Login</span>
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

export default function NewPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white font-poppins">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#240183] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#707070] font-medium">Loading...</p>
        </div>
      </div>
    }>
      <NewPasswordContent />
    </Suspense>
  );
}
