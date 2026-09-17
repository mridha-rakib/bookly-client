"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AuthCard from "@/components/auth/AuthCard";
import AuthLayout from "@/components/auth/AuthLayout";
import { Spinner } from "@/components/ui/spinner";
import type { SocialAuthStatus } from "@/lib/api/auth";
import { getAuthenticatedHomePath } from "@/lib/auth/routes";
import { useAuthStore } from "@/lib/auth/store";

/** Landing page for "Continue with Apple" (LOGIN, not Settings linking). Customer + Professional
 * flows only — Apple staff-invitation OAuth is not implemented. The Google/Facebook callback
 * pages are intentionally left untouched. */

const SESSION_WAIT_TIMEOUT_MS = 10_000;

type AppleAuthFlow = "customer" | "professional";

const FLOW_CONFIG: Record<AppleAuthFlow, { signInPath: string; accountExistsMessage: string }> = {
  customer: {
    signInPath: "/customer",
    accountExistsMessage:
      "An account already exists. Please log in using your existing method and link Apple from Settings.",
  },
  professional: {
    signInPath: "/professional/auth",
    accountExistsMessage:
      "This email already has a Bookly account. Please log in with your email and password — you can link Apple from Settings afterwards.",
  },
};

function LoadingScreen({ caption }: { caption: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FCFAF9] font-poppins">
      <Spinner className="text-[#240183]" />
      <p className="text-sm font-medium text-[#707070]">{caption}</p>
    </div>
  );
}

function ResultCard({
  title,
  message,
  cta,
  onCta,
}: {
  title: string;
  message: string;
  cta: string;
  onCta: () => void;
}) {
  return (
    <AuthLayout showBack={false} imageSrc="/img/authImg.png">
      <AuthCard title={title} subtitle={message}>
        <button
          type="button"
          onClick={onCta}
          className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer"
        >
          {cta}
        </button>
      </AuthCard>
    </AuthLayout>
  );
}

function AppleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get("status") ?? "error") as SocialAuthStatus;
  const flow: AppleAuthFlow =
    searchParams.get("flow") === "professional" ? "professional" : "customer";
  const config = FLOW_CONFIG[flow];

  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  const [timedOut, setTimedOut] = useState(false);
  const redirectedRef = useRef(false);

  const professionalOnboarding = flow === "professional" && status === "onboarding";
  const waitingForSession =
    (status === "success" || status === "onboarding") && !professionalOnboarding;

  useEffect(() => {
    if (waitingForSession) {
      void restoreSession();
    }
  }, [waitingForSession, restoreSession]);

<<<<<<< HEAD
  // Visit type is no longer threaded through here — it's a later onboarding step
  // (/professional/visit-type), collected well after this OAuth round trip.
=======
>>>>>>> ca126a4f6ff14aa988c44ea73c30011f535d0663
  useEffect(() => {
    if (!professionalOnboarding || redirectedRef.current) {
      return;
    }
    redirectedRef.current = true;
    const sessionId = searchParams.get("sessionId") ?? "";
<<<<<<< HEAD
    router.replace(`/professional/signup?provider=apple&sessionId=${encodeURIComponent(sessionId)}`);
=======
    const type = searchParams.get("visitType") ?? "travel";
    router.replace(
      `/professional/signup?provider=apple&sessionId=${encodeURIComponent(sessionId)}&type=${encodeURIComponent(type)}`,
    );
>>>>>>> ca126a4f6ff14aa988c44ea73c30011f535d0663
  }, [professionalOnboarding, searchParams, router]);

  useEffect(() => {
    if (!waitingForSession) {
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), SESSION_WAIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [waitingForSession]);

  useEffect(() => {
    if (!waitingForSession || redirectedRef.current) {
      return;
    }
    if (authStatus === "authenticated" && user) {
      redirectedRef.current = true;
      if (status === "onboarding") {
        router.replace("/customer/complete-profile");
        return;
      }
      router.replace(getAuthenticatedHomePath(user.role));
    }
  }, [waitingForSession, authStatus, user, status, router]);

  if (professionalOnboarding) {
    return <LoadingScreen caption="Setting up your account…" />;
  }

  if (status === "account_exists") {
    return (
      <ResultCard
        title="You already have a Bookly account"
        message={config.accountExistsMessage}
        cta="Go to sign in"
        onCta={() => router.replace(config.signInPath)}
      />
    );
  }

  if (status === "success" || status === "onboarding") {
    if (authStatus === "unauthenticated" || timedOut) {
      return (
        <ResultCard
          title="Sign-in didn't complete"
          message="We couldn't finish signing you in with Apple. Please try again."
          cta="Try again"
          onCta={() => router.replace(config.signInPath)}
        />
      );
    }
    return (
      <LoadingScreen
        caption={
          status === "onboarding" ? "Setting up your account…" : "Signing you in with Apple…"
        }
      />
    );
  }

  return (
    <ResultCard
      title="Apple sign-in failed"
      message="We couldn't sign you in with Apple. Please try again, or use your email and password."
      cta="Back to sign in"
      onCta={() => router.replace(config.signInPath)}
    />
  );
}

export default function AppleCallbackPage() {
  return (
    <Suspense fallback={<LoadingScreen caption="Finishing Apple sign-in…" />}>
      <AppleCallbackContent />
    </Suspense>
  );
}
