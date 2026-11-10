import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BooklyApiError } from "@/lib/api/client";
import { twoFactorApi, type TwoFactorStatus } from "@/lib/api/twoFactor";

// P2.2.7.2 — the real Owner / Supervisor / Staff Settings screens mount the authenticator (TOTP)
// management UI; only the API and unrelated dashboard hooks are mocked.
const fx = vi.hoisted(() => ({
  changePassword: { mutate: vi.fn(), isPending: false },
  policy: { isSuccess: false, isPending: false, isFetching: false, isError: false, data: undefined, refetch: vi.fn() },
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/settings/PayoutDestinationSettings", () => ({ PayoutDestinationSettings: () => null }));
vi.mock("@/components/dashboard/GoogleCalendarIntegrationCard", () => ({ default: () => null }));
vi.mock("@/lib/auth/hooks", () => ({
  useCurrentUserQuery: () => ({ isLoading: false, data: { user: { hasPassword: true }, profile: {} } }),
  useChangeMyPasswordMutation: () => fx.changePassword,
}));
vi.mock("@/lib/business/hooks", () => ({
  useMyBusinessProfileQuery: () => ({ data: { primary: { id: "business" } } }),
  useBusinessQuery: () => ({}),
  useUpdateBusinessMutation: () => ({}),
  useGoogleCalendarStatusQuery: () => ({ refetch: vi.fn() }),
}));
vi.mock("@/lib/staff/hooks", () => ({ useStaffListQuery: () => ({}), useUploadOwnerAvatarMutation: () => ({}) }));
vi.mock("@/lib/business/cancellation-policy-hooks", () => ({
  useCancellationPolicyQuery: () => fx.policy,
  useUpdateCancellationPolicyMutation: () => ({ mutateAsync: vi.fn() }),
}));

import DashboardSettings from "@/components/dashboard/DashboardSettings";
import SupervisorSettings from "@/components/dashboard/SupervisorSettings";
import StaffSettings from "@/components/dashboard/StaffSettings";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
let status: TwoFactorStatus | Error;
beforeEach(() => {
  window.history.replaceState(null, "", "/business-dashboard?section=settings");
  status = { enabled: false, recoveryCodesRemaining: 0, enrollmentAvailable: true };
  vi.spyOn(twoFactorApi, "status").mockImplementation(async () => {
    if (status instanceof Error) throw status;
    return status;
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
};
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
const click = async (node: Element | undefined | null) => {
  expect(node).toBeTruthy();
  await act(async () => (node as HTMLElement).click());
  await settle();
};
const placeholderGone = () => {
  expect(host.textContent).not.toContain("Not available yet");
  expect(host.textContent).not.toContain("Email Authentication");
  expect(host.textContent).not.toContain("Set 2FA Verification");
};

const screens: Array<[string, React.ComponentType, string]> = [
  ["Business Owner", DashboardSettings, "Security & 2FA"],
  ["Supervisor", SupervisorSettings, "Security & Login"],
  ["Staff", StaffSettings, "Security & Login"],
];

describe("P2.2.7.2 Professional Security settings mount the authenticator UI", () => {
  it.each(screens)("%s Settings: the security tab shows TOTP 2FA, not the old placeholder", async (_role, Screen, tab) => {
    await act(async () => root.render(<Screen />));
    await click(button(tab));
    expect(host.querySelector('[aria-label="Two-factor authentication"]')).toBeTruthy();
    expect(host.textContent).toContain("Google Authenticator");
    expect(host.textContent).toContain("Two-factor authentication: Off");
    expect(button("Enable 2FA")).toBeTruthy();
    expect(button("Update Password")?.disabled).toBe(false); // password management preserved
    placeholderGone();
    expect(host.querySelector('input[type="checkbox"][disabled]')).toBeNull(); // no dead toggle
  });

  it("enrollment ready: Enable 2FA starts the real QR / manual-key / verify flow", async () => {
    const enroll = vi.spyOn(twoFactorApi, "enroll").mockResolvedValue({
      setupId: "setup-1",
      manualKey: "JBSWY3DPEHPK3PXP",
      qrDataUrl: "data:image/png;base64,AAAA",
      expiresAt: "2026-11-08T12:00:00.000Z",
    });
    await act(async () => root.render(<DashboardSettings />));
    await click(button("Security & 2FA"));
    await click(button("Enable 2FA"));
    expect(enroll).toHaveBeenCalledTimes(1);
    expect(host.querySelector('img[alt="Authenticator setup QR code"]')).toBeTruthy();
    expect(host.textContent).toContain("JBSWY3DPEHPK3PXP");
    expect(button("Verify and enable")).toBeTruthy();
  });

  it("enrollment unavailable: truthful message, no Enable action, no fake toggle", async () => {
    status = { enabled: false, recoveryCodesRemaining: 0, enrollmentAvailable: false };
    const enroll = vi.spyOn(twoFactorApi, "enroll");
    await act(async () => root.render(<StaffSettings />));
    await click(button("Security & Login"));
    expect(host.querySelector('[data-testid="two-factor-unavailable"]')?.textContent).toContain(
      "isn't available on this server yet",
    );
    expect(host.textContent).not.toMatch(/never been implemented|coming soon/i);
    expect(button("Enable 2FA")).toBeUndefined();
    expect(enroll).not.toHaveBeenCalled();
    placeholderGone();
  });

  it("availability that changed after load: the server's 503 is shown and the state is re-read", async () => {
    vi.spyOn(twoFactorApi, "enroll").mockRejectedValue(
      new BooklyApiError({ message: "Two-factor setup is not available", status: 503, code: "TWO_FACTOR_ENROLLMENT_UNAVAILABLE" }),
    );
    await act(async () => root.render(<SupervisorSettings />));
    await click(button("Security & Login"));
    status = { enabled: false, recoveryCodesRemaining: 0, enrollmentAvailable: false };
    await click(button("Enable 2FA"));
    expect(host.querySelector('[role="alert"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="two-factor-unavailable"]')).toBeTruthy();
    expect(button("Enable 2FA")).toBeUndefined();
    expect(host.textContent).not.toContain("Scan this QR code");
  });

  it("already enabled: management stays available regardless of enrollment availability", async () => {
    status = { enabled: true, recoveryCodesRemaining: 7 };
    await act(async () => root.render(<DashboardSettings />));
    await click(button("Security & 2FA"));
    expect(host.textContent).toContain("Two-factor authentication: On");
    expect(host.textContent).toContain("7 recovery codes remaining.");
    expect(button("Regenerate recovery codes")).toBeTruthy();
    expect(button("Disable 2FA")).toBeTruthy();
    expect(host.querySelector('[data-testid="two-factor-unavailable"]')).toBeNull();
    await click(button("Disable 2FA"));
    expect(host.querySelector('[aria-label="Disable 2FA"]')?.textContent).toContain("recent complete sign-in");
  });

  it("a failed status load shows the error with Retry — never a fake On/Off state", async () => {
    status = new BooklyApiError({ message: "Couldn't load security settings", status: 500 });
    await act(async () => root.render(<DashboardSettings />));
    await click(button("Security & 2FA"));
    expect(host.querySelector('[role="alert"]')).toBeTruthy();
    expect(host.textContent).toContain("Two-factor authentication: Loading…");
    expect(button("Enable 2FA")).toBeUndefined();
    status = { enabled: false, recoveryCodesRemaining: 0, enrollmentAvailable: true };
    await click(button("Retry"));
    expect(host.textContent).toContain("Two-factor authentication: Off");
  });

  it("P2.2.7.3 — a status without readiness information fails closed (no Enable, no request)", async () => {
    status = { enabled: false, recoveryCodesRemaining: 0 }; // e.g. an older or unconfirmed API
    const enroll = vi.spyOn(twoFactorApi, "enroll");
    await act(async () => root.render(<DashboardSettings />));
    await click(button("Security & 2FA"));
    expect(host.querySelector('[data-testid="two-factor-unavailable"]')?.textContent).toContain(
      "couldn't confirm that authenticator setup is available",
    );
    expect(button("Enable 2FA")).toBeUndefined();
    expect(enroll).not.toHaveBeenCalled();
    expect(button("Update Password")?.disabled).toBe(false);
  });

  it("P2.2.7.3 — the sign-in-again link appears only when the server requires a fresh sign-in", async () => {
    const enroll = vi.spyOn(twoFactorApi, "enroll").mockRejectedValue(
      new BooklyApiError({
        message: "Sign in again, then return to Security within five minutes.",
        status: 403,
        code: "TWO_FACTOR_REAUTH_REQUIRED",
      }),
    );
    await act(async () => root.render(<SupervisorSettings />));
    await click(button("Security & Login"));
    const link = () =>
      [...host.querySelectorAll("a")].find((a) => a.textContent?.includes("Sign in again"));
    expect(link()).toBeUndefined(); // readiness is not confused with fresh-login
    await click(button("Enable 2FA"));
    expect(enroll).toHaveBeenCalledTimes(1);
    expect(link()?.getAttribute("href")).toBe("/professional/auth");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("within five minutes");
    expect(host.textContent).not.toContain("Scan this QR code");
    expect(button("Enable 2FA")).toBeTruthy(); // still available, just needs a fresh sign-in
  });
});
