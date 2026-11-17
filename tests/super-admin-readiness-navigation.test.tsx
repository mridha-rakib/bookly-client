import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import PlatformBankAccount from "@/components/super-admin/finance/PlatformBankAccount";
import SuperAdminWithdrawals from "@/components/super-admin/finance/SuperAdminWithdrawals";
import SuperAdminSidebar from "@/components/super-admin/layout/SuperAdminSidebar";

const state = vi.hoisted(() => ({
  bank: { data: { state: "UNAVAILABLE", payoutsEnabled: true as boolean | null, destinations: [] }, isLoading: false, isError: false, refetch: vi.fn() },
  retry: vi.fn(),
}));
vi.mock("@/lib/superAdminFinance/hooks", () => ({
  usePlatformBankAccountQuery: () => state.bank,
  useCentralPayoutOverviewQuery: () => ({ isLoading: false, isError: true, refetch: vi.fn() }),
  useCentralPayoutsQuery: () => ({ isLoading: false, isError: true, isFetching: false, error: new Error("Unavailable"), refetch: state.retry }),
  useRefreshCentralPayoutMutation: () => ({}),
  useInitiateCentralPayoutMutation: () => ({}),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/auth/store", () => ({ useAuthStore: (select: (s: { logout: () => Promise<void> }) => unknown) => select({ logout: async () => {} }) }));
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: () => ({ data: { profile: { fullName: "Admin" }, user: { email: "admin@example.test" } } }) }));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("does not present stale enabled status when the provider response is unavailable", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<PlatformBankAccount />));
    expect(host.textContent).toContain("details are unavailable");
    expect(host.textContent).not.toContain("Stripe reports payouts enabled");
    expect(host.textContent).toContain("LIVE withdrawals also require explicit enablement for this deployment");
  } finally { act(() => root.unmount()); }
});

it("distinguishes enabled, disabled and unknown provider status", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  const original = state.bank.data;
  try {
    for (const [value, message] of [
      [true, "Stripe reports payouts enabled"],
      [false, "Payouts are disabled by Stripe"],
      [null, "Stripe payout-enabled status is unavailable"],
    ] as const) {
      state.bank.data = { state: "NO_DESTINATION", payoutsEnabled: value, destinations: [] };
      act(() => root.render(<PlatformBankAccount />));
      expect(host.textContent).toContain(message);
      expect(host.textContent).toContain("LIVE withdrawals also require explicit enablement for this deployment");
    }
    state.bank.data = { state: "NOT_CONFIGURED", payoutsEnabled: true, destinations: [] };
    act(() => root.render(<PlatformBankAccount />));
    expect(host.textContent).toContain("Stripe is not configured");
    expect(host.textContent).not.toContain("Stripe reports payouts enabled");
  } finally { state.bank.data = original; act(() => root.unmount()); }
});

it("offers a retry for a failed withdrawal history read", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<SuperAdminWithdrawals />));
    const history = [...host.querySelectorAll("div")].find(el => el.textContent?.startsWith("Withdrawal history") && el.querySelector('[role="alert"]'));
    const retry = history?.querySelector("button");
    expect(retry?.textContent).toBe("Retry");
    expect(history?.textContent).not.toContain("No withdrawals yet");
    act(() => retry?.click());
    expect(state.retry).toHaveBeenCalledOnce();
  } finally { act(() => root.unmount()); }
});

it("exposes collapsed navigation names, selection and account controls", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host), select = vi.fn(), collapse = vi.fn();
  try {
    act(() => root.render(<SuperAdminSidebar activeTab="Dashboard" setActiveTab={select} isCollapsed setIsCollapsed={collapse} />));
    expect(host.querySelector('[aria-label="Dashboard"]')?.getAttribute("aria-current")).toBe("page");
    for (const name of ["Businesses", "Customers", "Bookings", "Finance", "Support", "Settings"]) {
      const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
      expect(button).not.toBeNull();
      act(() => button?.click());
      expect(select).toHaveBeenLastCalledWith(name);
    }
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Expand navigation"]')?.click());
    expect(collapse).toHaveBeenCalledWith(false);
    const account = host.querySelector<HTMLButtonElement>('[aria-label="Account menu"]');
    expect(account?.getAttribute("aria-expanded")).toBe("false");
    act(() => account?.click());
    expect(account?.getAttribute("aria-expanded")).toBe("true");
    expect(host.textContent).toContain("Log out");
  } finally { act(() => root.unmount()); }
});
