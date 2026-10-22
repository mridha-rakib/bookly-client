"use client";

import { useCallback, useEffect, useState } from "react";

import { hasLogoutIntent } from "@/lib/auth/logout-intent";
import { useAuthStore } from "@/lib/auth/store";

export const isOAuthCallbackPath = (pathname: string | null): boolean =>
  ["/auth/google/callback", "/auth/facebook/callback", "/auth/apple/callback"].includes(pathname ?? "");

/** A callback interrupted by sign-out stays interrupted even after that intent is resolved.
 * The authorization code has already been consumed; recovery starts a fresh sign-in. */
export const useOAuthCallbackSession = (waitingForSession: boolean) => {
  const status = useAuthStore((state) => state.status);
  const phase = useAuthStore((state) => state.logoutState.phase);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const [interrupted, setInterrupted] = useState(false);
  const pending = phase === "inProgress" || phase === "unconfirmed";

  useEffect(() => {
    let mounted = true;
    if (hasLogoutIntent()) {
      void restoreSession({ resolveLogout: false }).then(() => {
        if (mounted) setInterrupted(true);
      });
    } else if (waitingForSession && !interrupted && status === "unknown") {
      void restoreSession({ resolveLogout: false });
    }
    return () => { mounted = false; };
  }, [waitingForSession, interrupted, status, phase, restoreSession]);

  // Read the restriction again inside navigation effects, including the first effect pass
  // before boot has hydrated logoutState. Callback URL parameters never authorize a session.
  const isBlocked = useCallback(() => interrupted || hasLogoutIntent(), [interrupted]);
  return { interrupted: interrupted || pending, isBlocked };
};
