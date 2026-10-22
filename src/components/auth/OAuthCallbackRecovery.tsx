"use client";

import { useRouter } from "next/navigation";

import AuthCard from "@/components/auth/AuthCard";
import AuthLayout from "@/components/auth/AuthLayout";

export default function OAuthCallbackRecovery({ signInPath }: { signInPath: string }) {
  const router = useRouter();
  return (
    <AuthLayout showBack={false}>
      <AuthCard
        title="Start sign-in again"
        subtitle="This sign-in was interrupted by a pending sign-out. Return to sign in, resolve sign-out if needed, and start a new sign-in."
      >
        <button
          type="button"
          className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer"
          onClick={() => router.replace(signInPath)}
        >
          Back to sign in
        </button>
      </AuthCard>
    </AuthLayout>
  );
}
