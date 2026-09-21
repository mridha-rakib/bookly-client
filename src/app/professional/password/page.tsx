"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock01Icon } from "@hugeicons/core-free-icons";

// Components
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import { InputField } from "@/components/auth/InputField";
import SocialButton from "@/components/auth/SocialButton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { useProfessionalGoogleAuthMutation, useProfessionalLoginMutation } from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import { getAuthenticatedUserHomePath } from "@/lib/auth/routes";

function PasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const login = useProfessionalLoginMutation();
  const googleAuth = useProfessionalGoogleAuthMutation();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setPasswordError("Please enter your password");
      return;
    }
    setPasswordError("");

    try {
      const auth = await login.mutateAsync({ email, password });
      toast.success("Welcome back! You're signed in.");
      router.push(getAuthenticatedUserHomePath(auth.user));
    } catch (error) {
      setPasswordError(toUserMessage(error));
    }
  };

  return (
    <AuthLayout onBack={() => router.push(`/professional/auth?email=${encodeURIComponent(email)}`)} imageSrc="/img/authImg2.png">
      <AuthCard
        title="Enter your password to login to your account"
      >
        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5 w-full">
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

          {/* Forgot Password link */}
          <div className="text-left">
            <button
              type="button"
              onClick={() => router.push(`/professional/forgot-password?email=${encodeURIComponent(email)}`)}
              className="text-sm font-semibold text-[#240183] hover:underline cursor-pointer"
            >
              Forgot your password?
            </button>
          </div>

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer mt-2"
          >
            {login.isPending ? <Spinner className="text-white" /> : "Login"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6 w-full max-w-[520px]">
          <div className="flex-1 border-t border-[#E8E6FF]" />
          <span className="px-3 text-xs font-semibold text-[#9E9E9E] tracking-wider">OR</span>
          <div className="flex-1 border-t border-[#E8E6FF]" />
        </div>

        <SocialButton
          provider="google"
          label={googleAuth.isPending ? "Redirecting to Google…" : "Continue With Google"}
          onClick={() => googleAuth.mutate()}
          disabled={googleAuth.isPending}
          aria-busy={googleAuth.isPending}
        />
      </AuthCard>
    </AuthLayout>
  );
}

export default function PasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white font-poppins">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#240183] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#707070] font-medium">Loading login...</p>
        </div>
      </div>
    }>
      <PasswordPageContent />
    </Suspense>
  );
}
