"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AuthCard from "@/components/auth/AuthCard";
import AuthLayout from "@/components/auth/AuthLayout";
import { Spinner } from "@/components/ui/spinner";
import type { CustomerGoogleAuthStatus, GoogleAuthFlow } from "@/lib/api/auth";
import { getAuthenticatedHomePath } from "@/lib/auth/routes";
import { useAuthStore } from "@/lib/auth/store";

/** How long to wait for the refresh-cookie session to come up before treating a
 * success/onboarding return as a failure. The cookie is set by the backend before this page
 * loads, so this only fires on a genuine problem. */
const SESSION_WAIT_TIMEOUT_MS = 10_000;

/** Per-flow copy + navigation targets. The customer flow is unchanged from Phase 2B; the
 * professional flow (`?flow=professional`) resumes the existing Business Owner onboarding; the
 * staff flow (`?flow=staff`, Phase 2D) is invitation acceptance via Google. */
const FLOW_CONFIG: Record<
  GoogleAuthFlow,
  { signInPath: string; accountExistsMessage: string }
> = {
  customer: {
    signInPath: "/customer",
    accountExistsMessage:
      "An account already exists. Please log in using your existing method and link Google from Settings.",
  },
  professional: {
    signInPath: "/professional/auth",
    accountExistsMessage:
      "This email already has a Bookly account. Please log in with your email and password — you can link Google from Settings afterwards.",
  },
  staff: {
    signInPath: "/professional/auth",
    accountExistsMessage:
      "This email already has a Bookly account. Please sign in with your existing method.",
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

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get("status") ?? "error") as CustomerGoogleAuthStatus;
  const flowParam = searchParams.get("flow");
  const flow: GoogleAuthFlow =
    flowParam === "professional" || flowParam === "staff" ? flowParam : "customer";
  const config = FLOW_CONFIG[flow];

  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  const [timedOut, setTimedOut] = useState(false);
  const redirectedRef = useRef(false);

  // Professional onboarding never issues a session (Option B): the backend hands back a
  // RegistrationSession id and the browser resumes the existing multi-step signup. Only a
  // customer onboarding return waits for a session.
  const professionalOnboarding = flow === "professional" && status === "onboarding";
  const waitingForSession =
    (status === "success" || status === "onboarding") && !professionalOnboarding;

  // Pull the freshly-issued session up from the refresh cookie the backend just set. `Providers`
  // also calls this on app mount; `restoreSession` is guarded against concurrent runs, so a
  // second call is a harmless no-op that guarantees we don't depend on effect ordering.
  useEffect(() => {
    if (waitingForSession) {
      void restoreSession();
    }
  }, [waitingForSession, restoreSession]);

  // Professional onboarding: hand straight off to the existing signup flow, in `provider=google`
  // mode, carrying the RegistrationSession id + visit type the backend signed into the redirect.
  useEffect(() => {
    if (!professionalOnboarding || redirectedRef.current) {
      return;
    }
    redirectedRef.current = true;
    const sessionId = searchParams.get("sessionId") ?? "";
    const type = searchParams.get("visitType") ?? "travel";
    router.replace(
      `/professional/signup?provider=google&sessionId=${encodeURIComponent(sessionId)}&type=${encodeURIComponent(type)}`,
    );
  }, [professionalOnboarding, searchParams, router]);

  // Safety net: never spin forever on a success return.
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
      if (status === "onboarding") {
        // customer-only branch (professional onboarding is handled above).
        router.replace("/customer/complete-profile");
        return;
      }
      router.replace(getAuthenticatedHomePath(user.role));
    }
  }, [waitingForSession, authStatus, user, status, router]);

  if (professionalOnboarding) {
    return <LoadingScreen caption="Setting up your account…" />;
  }

  // Phase 2D — staff invitation acceptance has two extra outcomes.
  if (flow === "staff" && (status as string) === "email_mismatch") {
    return (
      <ResultCard
        title="That Google account doesn't match"
        message="The Google account you chose isn't the email address your invitation was sent to. Sign in again with the invited Google account, or ask the business to re-send the invitation."
        cta="Back to sign in"
        onCta={() => router.replace(config.signInPath)}
      />
    );
  }

  if (flow === "staff" && (status as string) === "expired") {
    return (
      <ResultCard
        title="This invitation is no longer valid"
        message="Your invitation link has expired or has already been used. Ask the business to send you a new one."
        cta="Back to sign in"
        onCta={() => router.replace(config.signInPath)}
      />
    );
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
          message="We couldn't finish signing you in with Google. Please try again."
          cta="Try again"
          onCta={() => router.replace(config.signInPath)}
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
      onCta={() => router.replace(config.signInPath)}
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
