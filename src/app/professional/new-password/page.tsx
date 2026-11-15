"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock01Icon } from "@hugeicons/core-free-icons";

// Components
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import { InputField } from "@/components/auth/InputField";
import { completeRecovery, getRecovery } from "@/lib/auth/password-recovery";

function NewPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
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
    setPending(true);
    setError("");
    try { await completeRecovery("professional", password); setSuccess(true); setPassword(""); setConfirmPassword(""); }
    catch { setError("Password could not be changed. Please start recovery again or try later."); }
    finally { setPending(false); }
  };

  return (
    <AuthLayout onBack={() => router.push(`/professional/verify?email=${encodeURIComponent(getRecovery("professional")?.email || email)}&flow=reset`)} imageSrc="/img/authImg2.png">
      {success ? <AuthCard title="Successfully Changed" subtitle="Your password has been changed."><button type="button" onClick={() => router.push("/professional/auth")} className="w-full h-12 border rounded-xl text-[#240183] font-semibold">Back to Login</button></AuthCard> : <AuthCard
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
            disabled={pending}
            className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer mt-4"
          >
            {pending ? "Updating…" : "Done"}
          </button>
        </form>
      </AuthCard>}

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
