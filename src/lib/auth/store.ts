"use client";

import { create } from "zustand";

import { authApi, type AuthResponse, type AuthUser } from "@/lib/api/auth";
import { clearAccessToken, setAccessToken } from "@/lib/auth/token-memory";

type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

interface AuthState {
  user: AuthUser | null;
  accessTokenExpiresAt: string | null;
  status: AuthStatus;
  isInitializing: boolean;
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
    try {
      await authApi.logout();
    } finally {
      get().clearAuth();
    }
  },
}));
