"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon, SquareLock01Icon, ShieldKeyIcon } from "@hugeicons/core-free-icons";

import AuthCard from "@/components/auth/AuthCard";
import { InputField } from "@/components/auth/InputField";
import { Spinner } from "@/components/ui/spinner";
import { useSuperAdminLoginMutation } from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import { authRoutes, getAuthenticatedUserHomePath } from "@/lib/auth/routes";
import { useAuthStore } from "@/lib/auth/store";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const login = useSuperAdminLoginMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (status === "unknown") {
      void restoreSession();
    }
  }, [restoreSession, status]);

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(getAuthenticatedUserHomePath(user));
    }
  }, [router, status, user]);

  const isRedirecting = status === "unknown" || isInitializing || (status === "authenticated" && !!user);

  if (isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FCFAF9] font-poppins">
        <Spinner className="text-[#240183]" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (login.isPending) {
      return;
    }

    let hasError = false;
    if (!email) {
      setEmailError("Please enter your email");
      hasError = true;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Please enter a valid email address");
      hasError = true;
    } else {
      setEmailError("");
    }

    if (!password) {
      setPasswordError("Please enter your password");
      hasError = true;
    } else {
      setPasswordError("");
    }

    if (hasError) {
      return;
    }
    setFormError("");

    try {
      const auth = await login.mutateAsync({ email, password });
      if (auth.user.role !== "SUPER_ADMIN") {
        setFormError("The email or password is incorrect.");
        return;
      }
      router.push(authRoutes.superAdminDashboard);
    } catch (error) {
      setFormError(toUserMessage(error));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FCFAF9] font-poppins antialiased px-4 py-10">
      <div className="w-full max-w-[440px] flex flex-col items-center">
        <Image
          src="/img/logo.png"
          alt="Bookly Logo"
          width={160}
          height={44}
          priority
          className="object-contain mb-8"
        />

        <AuthCard
          className="max-w-[440px]"
          title="Super Admin"
          subtitle="Authorized administrators only."
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
            <InputField
              label="Email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              icon={<HugeiconsIcon icon={Mail01Icon} size={20} />}
              autoComplete="username"
              required
            />

            <InputField
              label="Password"
              placeholder="Password"
              isPassword
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              icon={<HugeiconsIcon icon={SquareLock01Icon} size={20} />}
              autoComplete="current-password"
              required
            />

            {formError && (
              <p className="text-xs text-red-500 -mt-2" role="alert">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="w-full h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {login.isPending ? <Spinner className="text-white" /> : "Sign in"}
            </button>
          </form>
        </AuthCard>

        <div className="flex items-center gap-2 mt-6 text-xs text-[#9E9E9E]">
          <HugeiconsIcon icon={ShieldKeyIcon} size={16} />
          <span>Secure internal access &middot; activity is logged</span>
        </div>
      </div>
    </div>
  );
}
