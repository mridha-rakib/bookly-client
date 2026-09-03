"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AuthCard from "@/components/auth/AuthCard";
import AuthLayout from "@/components/auth/AuthLayout";
import { Spinner } from "@/components/ui/spinner";
import type { CustomerGoogleAuthStatus } from "@/lib/api/auth";
import { getAuthenticatedHomePath } from "@/lib/auth/routes";
import { useAuthStore } from "@/lib/auth/store";

/** How long to wait for the refresh-cookie session to come up before treating a
 * success/onboarding return as a failure. The cookie is set by the backend before this page
 * loads, so this only fires on a genuine problem. */
const SESSION_WAIT_TIMEOUT_MS = 10_000;

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

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get("status") ?? "error") as CustomerGoogleAuthStatus;

  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  const [timedOut, setTimedOut] = useState(false);
  const redirectedRef = useRef(false);

  const waitingForSession = status === "success" || status === "onboarding";

  // Pull the freshly-issued session up from the refresh cookie the backend just set. `Providers`
  // also calls this on app mount; `restoreSession` is guarded against concurrent runs, so a
  // second call is a harmless no-op that guarantees we don't depend on effect ordering.
  useEffect(() => {
    if (waitingForSession) {
      void restoreSession();
    }
  }, [waitingForSession, restoreSession]);

  // Safety net: never spin forever on a success/onboarding return.
  useEffect(() => {
    if (!waitingForSession) {
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), SESSION_WAIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [waitingForSession]);

  // Once the session is authenticated, hand off to the existing destination logic.
  useEffect(() => {
    if (!waitingForSession || redirectedRef.current) {
      return;
    }
    if (authStatus === "authenticated" && user) {
      redirectedRef.current = true;
      router.replace(
        status === "onboarding" ? "/customer/complete-profile" : getAuthenticatedHomePath(user.role),
      );
    }
  }, [waitingForSession, authStatus, user, status, router]);

  if (status === "account_exists") {
    return (
      <ResultCard
        title="You already have a Bookly account"
        message="An account already exists. Please log in using your existing method and link Google from Settings."
        cta="Go to sign in"
        onCta={() => router.replace("/customer")}
      />
    );
  }

  if (status === "success" || status === "onboarding") {
    if (authStatus === "unauthenticated" || timedOut) {
      return (
        <ResultCard
          title="Sign-in didn't complete"
          message="We couldn't finish signing you in with Google. Please try again."
          cta="Try again"
          onCta={() => router.replace("/customer")}
        />
      );
    }
    return (
      <LoadingScreen
        caption={
          status === "onboarding" ? "Setting up your account…" : "Signing you in with Google…"
        }
      />
    );
  }

  // status === "error", or an unrecognised value.
  return (
    <ResultCard
      title="Google sign-in failed"
      message="We couldn't sign you in with Google. Please try again, or use your email and password."
      cta="Back to sign in"
      onCta={() => router.replace("/customer")}
    />
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<LoadingScreen caption="Finishing Google sign-in…" />}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
