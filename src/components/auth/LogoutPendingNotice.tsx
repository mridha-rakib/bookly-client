"use client";

import { useEffect, useState } from "react";

import { useAuthStore } from "@/lib/auth/store";

const reasonText: Record<string, string> = {
  RATE_LIMITED: "Too many requests were sent from this connection.",
  SERVER_ERROR: "The server had a temporary problem.",
  NETWORK: "The server could not be reached.",
  TIMEOUT: "The server did not respond in time.",
  REJECTED: "The server did not accept the request.",
  FAMILY_MISMATCH: "Another sign-in changed this browser's session. Your original session may still be active on the server.",
  UNVERIFIABLE: "The browser no longer has a cookie that can verify your original session's sign-out.",
};

/**
 * One global notice for the three sign-out truths (mounted once in Providers, so every page,
 * guard redirect and login page shows the same state). It never claims server sign-out until the
 * server confirmed it; protected content is already hidden by the guards (status is
 * "unauthenticated" from the moment logout starts).
 */
export default function LogoutPendingNotice() {
  const logoutState = useAuthStore((state) => state.logoutState);
  const retryLogout = useAuthStore((state) => state.retryLogout);
  const allowSignIn = useAuthStore((state) => state.allowSignInDuringPendingLogout);
  const dismiss = useAuthStore((state) => state.dismissLogoutNotice);
  const [now, setNow] = useState(() => Date.now());

  const waitingForRetryAfter = logoutState.retryAt !== null && logoutState.retryAt > now;
  useEffect(() => {
    if (!waitingForRetryAfter) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [waitingForRetryAfter]);

  useEffect(() => {
    if (logoutState.phase !== "confirmed") return;
    const timer = setTimeout(dismiss, 4_000);
    return () => clearTimeout(timer);
  }, [dismiss, logoutState.phase]);

  if (logoutState.phase === "idle") return null;

  const secondsLeft = waitingForRetryAfter
    ? Math.ceil(((logoutState.retryAt ?? now) - now) / 1_000)
    : 0;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[400] flex justify-center p-4 font-poppins"
      role="status"
      aria-live="polite"
      data-testid="logout-pending-notice"
      data-phase={logoutState.phase}
    >
      <div className="w-full max-w-[560px] rounded-xl border border-[#C6C6CB] bg-white p-4 shadow-2xl">
        {logoutState.phase === "inProgress" && <p className="text-sm text-[#1C1B1C]">Signing you out…</p>}

        {logoutState.phase === "confirmed" && (
          <p className="text-sm text-[#1C1B1C]">You&apos;re signed out.</p>
        )}

        {logoutState.phase === "unconfirmed" && (
          <div className="space-y-3">
            <p className="font-semibold text-[#020305]">Sign-out not confirmed</p>
            <p className="text-sm text-[#4E5F78]">
              You&apos;re signed out on this device, but Bookly couldn&apos;t confirm the sign-out
              with the server{logoutState.reason ? ` — ${reasonText[logoutState.reason] ?? ""}` : "."}{" "}
              {logoutState.persisted
                ? "Until it's confirmed, this browser won't sign you back in."
                : "This browser couldn't save that, so reloading or opening a new tab may sign you back in until sign-out is confirmed."}
            </p>
            {logoutState.signInOverride && (
              <p className="text-sm text-[#4E5F78]">
                Signing in now replaces this browser&apos;s previous session. That previous
                session stays unconfirmed on the server until it expires.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-[#240183] px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={waitingForRetryAfter}
                onClick={() => void retryLogout()}
              >
                {waitingForRetryAfter ? `Retry sign-out in ${secondsLeft}s` : "Retry sign-out"}
              </button>
              {!logoutState.signInOverride && (
                <button
                  type="button"
                  className="rounded-lg border border-[#C6C6CB] px-4 py-2 text-sm text-[#1C1B1C]"
                  onClick={allowSignIn}
                >
                  Sign in again anyway
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
