import { apiRequest } from "./client";
import type { AuthResponse } from "./auth";

export type TwoFactorSetup = {
  setupId: string;
  manualKey: string;
  qrDataUrl: string;
  expiresAt: string;
};
/** P2.2.7.2 — `enrollmentAvailable` is present only while 2FA is off. */
export type TwoFactorStatus = {
  enabled: boolean;
  recoveryCodesRemaining: number;
  enrollmentAvailable?: boolean;
};
export type RecoveryCodeResult = { recoveryCodes: string[]; signInRequired: boolean };

// Secret-bearing responses are used directly by components, never query-cache entries.
export const twoFactorApi = {
  status: () =>
    apiRequest<TwoFactorStatus>({
      method: "GET",
      url: "/auth/two-factor/status",
    }),
  enroll: () =>
    apiRequest<TwoFactorSetup>({ method: "POST", url: "/auth/two-factor/enroll", data: {} }),
  activate: (setupId: string, code: string) =>
    apiRequest<RecoveryCodeResult>({
      method: "POST",
      url: "/auth/two-factor/activate",
      data: { setupId, code },
    }),
  manage: (action: "disable" | "regenerate", code: string) =>
    apiRequest<RecoveryCodeResult>({
      method: "POST",
      url: `/auth/two-factor/${action}`,
      data: { code, confirmation: action === "disable" ? "DISABLE" : "REPLACE" },
    }),
  challenge: () =>
    apiRequest<{ expiresAt: string }>({ method: "GET", url: "/auth/two-factor/challenge" }),
  verify: (code: string, replaceRecoveryCodes = false) =>
    apiRequest<AuthResponse & { recoveryCodes?: string[] }>({
      method: "POST",
      url: "/auth/two-factor/verify",
      data: { code, ...(replaceRecoveryCodes ? { replaceRecoveryCodes: true } : {}) },
    }),
  cancel: () => apiRequest<object>({ method: "DELETE", url: "/auth/two-factor/challenge" }),
};
