"use client";

import { create } from "zustand";

import { authApi, type AuthResponse, type AuthUser } from "@/lib/api/auth";
import { setOnSessionExpired } from "@/lib/api/client";
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
  restoreSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessTokenExpiresAt: null,
  status: "unknown",
  isInitializing: false,
  isLoggingOut: false,

  setAuth: (auth) => {
    setAccessToken(auth.accessToken);
    set({
      user: auth.user,
      accessTokenExpiresAt: auth.accessTokenExpiresAt,
      status: "authenticated",
      isInitializing: false,
    });
  },

  clearAuth: () => {
    clearAccessToken();
    set({
      user: null,
      accessTokenExpiresAt: null,
      status: "unauthenticated",
      isInitializing: false,
    });
  },

  restoreSession: async () => {
    if (get().isInitializing) {
      return;
    }

    set({ isInitializing: true });

    try {
      const auth = await authApi.refresh();
      get().setAuth(auth);
    } catch {
      get().clearAuth();
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
    }
  },
}));

// The apiClient interceptor calls this when a 401-triggered refresh permanently fails (dead or
// reused refresh token) — it only owns the raw in-memory access token, not this store's
// "authenticated" status, so without this wiring the app would keep rendering as logged in while
// every request silently 401s. Reuses the existing clearAuth() so the existing Require*
// guards' status==="unauthenticated" redirect handles the rest.
setOnSessionExpired(() => useAuthStore.getState().clearAuth());
