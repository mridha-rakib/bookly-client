"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon, ArrowLeft02Icon } from "@hugeicons/core-free-icons";

// Components
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import { InputField } from "@/components/auth/InputField";
import { requestRecovery } from "@/lib/auth/password-recovery";

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [emailError, setEmailError] = useState("");
  const [pending, setPending] = useState(false);

  const handleNextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!email) {
      setEmailError("Please enter your email");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setPending(true);
    setEmailError("");
    try {
      const available = await requestRecovery("customer", email.trim());
      if (!available) {
        setEmailError("Please wait before requesting another code, then try again.");
        return;
      }
      router.push(`/customer/verify?email=${encodeURIComponent(email.trim())}&flow=reset`);
    } catch { setEmailError("Could not start recovery. Please try again."); } finally { setPending(false); }
  };

  return (
    <AuthLayout onBack={() => router.push(`/customer/password?email=${encodeURIComponent(email)}`)} imageSrc="/img/authImg.png">
      <AuthCard
        title="Forgot your password?"
        subtitle="Enter your email address to reset password"
      >
        <form onSubmit={handleNextSubmit} className="flex flex-col gap-6 w-full">
          <InputField
            label="Email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
            icon={<HugeiconsIcon icon={Mail01Icon} size={20} />}
            required
          />

          <button
            type="submit"
            disabled={pending}
            className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer"
          >
            {pending ? "Sending…" : "Next"}
          </button>

          {/* Back to Login link */}
          <div className="flex justify-center mt-2">
            <button
              type="button"
              onClick={() => router.push(`/customer/password?email=${encodeURIComponent(email)}`)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#240183] hover:underline cursor-pointer"
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} size={14} />
              <span>Back to Login</span>
            </button>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white font-poppins">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#240183] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#707070] font-medium">Loading...</p>
        </div>
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}
