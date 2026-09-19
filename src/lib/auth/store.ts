"use client";

import { create } from "zustand";

import { authApi, type AuthResponse, type AuthUser } from "@/lib/api/auth";
import { invalidateInFlightAuth, refreshSession, setOnSessionExpired } from "@/lib/api/client";
import {
  postAuthLoggedOut,
  postAuthSessionChanged,
  subscribeToAuthBroadcast,
} from "@/lib/auth/auth-channel";
import { clearAccessToken, setAccessToken } from "@/lib/auth/token-memory";
import { queryClient } from "@/lib/query-client";

type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

interface AuthState {
  user: AuthUser | null;
  accessTokenExpiresAt: string | null;
  status: AuthStatus;
  isInitializing: boolean;
  isLoggingOut: boolean;
  setAuth: (auth: AuthResponse) => void;
  clearAuth: () => void;
  /** `broadcast: false` is for internal use by the cross-tab resync handler below — every other
   * caller (Providers boot, OAuth callback pages, Require* guards) should call this with no
   * arguments. */
  restoreSession: (options?: { broadcast?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
}

/** Shared by setAuth() and restoreSession() so both write identical state for an authenticated
 * response; broadcasting is the caller's decision (see restoreSession's `broadcast` option). */
const applyAuth = (
  set: (partial: Partial<AuthState>) => void,
  auth: Pick<AuthResponse, "accessToken" | "accessTokenExpiresAt" | "user">,
): void => {
  setAccessToken(auth.accessToken);
  set({
    user: auth.user,
    accessTokenExpiresAt: auth.accessTokenExpiresAt,
    status: "authenticated",
    isInitializing: false,
  });
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessTokenExpiresAt: null,
  status: "unknown",
  isInitializing: false,
  isLoggingOut: false,

  setAuth: (auth) => {
    applyAuth(set, auth);
    // Bookly is one session per browser profile: any tab that just established an authenticated
    // session (password/OTP login, OAuth callback, or an ordinary boot-time restore) tells every
    // other same-origin tab so they converge to it too. Harmless when it's the same account
    // (other tabs just re-confirm it); see the AUTH_SESSION_CHANGED handler below for how a tab
    // that was showing a *different* account switches over.
    postAuthSessionChanged();
  },

  clearAuth: () => {
    // Guarantees a refresh that was already in flight when this ran can never apply its result
    // afterwards and silently re-authenticate this tab.
    invalidateInFlightAuth();
    clearAccessToken();
    set({
      user: null,
      accessTokenExpiresAt: null,
      status: "unauthenticated",
      isInitializing: false,
    });
  },

  restoreSession: async (options) => {
    if (get().isInitializing) {
      return;
    }

    set({ isInitializing: true });

    try {
      // Canonical refresh primitive — same-tab single-flight and (where supported) cross-tab
      // Web Locks serialization live here, shared with the apiClient response interceptor. Do
      // not call authApi.refresh() directly.
      const auth = await refreshSession();
      applyAuth(set, auth);
      if (options?.broadcast !== false) {
        postAuthSessionChanged();
      }
    } catch (error) {
      // A StaleAuthGenerationError means a logout already ran concurrently and already put us
      // in the right (unauthenticated) state — clearAuth() again would just be redundant.
      if (!(error instanceof Error) || error.name !== "StaleAuthGenerationError") {
        get().clearAuth();
      }
    }
  },

  logout: async () => {
    if (get().isLoggingOut) {
      return;
    }

    set({ isLoggingOut: true });

    try {
      await authApi.logout();
    } finally {
      get().clearAuth();
      // Drop all cached queries so the next signed-in account never sees a
      // previous account's Business Profile/detail data from the cache.
      queryClient.clear();
      set({ isLoggingOut: false });
      // Tell every other same-origin tab the shared session just ended — they must become
      // unauthenticated too, not silently try to refresh themselves back in (see the
      // AUTH_LOGGED_OUT branch below).
      postAuthLoggedOut();
    }
  },
}));

// The apiClient interceptor calls this when a 401-triggered refresh permanently fails (dead or
// reused refresh token) — it only owns the raw in-memory access token, not this store's
// "authenticated" status, so without this wiring the app would keep rendering as logged in while
// every request silently 401s. Reuses the existing clearAuth() so the existing Require*
// guards' status==="unauthenticated" redirect handles the rest. A terminal failure here means the
// shared session genuinely ended, so every other tab is told too.
setOnSessionExpired(() => {
  useAuthStore.getState().clearAuth();
  postAuthLoggedOut();
});

// Cross-tab convergence for Bookly's "one session per browser profile" model. Never touches a
// token — these events carry no credentials (see auth-channel.ts) — this tab always re-derives
// its own session from the shared HttpOnly refresh cookie via the canonical refreshSession().
subscribeToAuthBroadcast((event) => {
  if (event.type === "AUTH_LOGGED_OUT") {
    // Guard first: a refresh this tab already had in flight for the old session must not be
    // allowed to resurrect it after this.
    invalidateInFlightAuth();
    useAuthStore.getState().clearAuth();
    return;
  }

  // AUTH_SESSION_CHANGED: another tab just authenticated (possibly as a different account).
  // Drop this tab's stale in-memory access token immediately — do not wait for its natural
  // ~15 minute expiry — then re-derive the current shared session from the cookie. `broadcast:
  // false` stops this from re-announcing the very change it's reacting to (which would ping-pong
  // between tabs forever).
  invalidateInFlightAuth();
  clearAccessToken();
  useAuthStore.setState({ user: null, accessTokenExpiresAt: null, status: "unknown" });
  void useAuthStore.getState().restoreSession({ broadcast: false });
});
