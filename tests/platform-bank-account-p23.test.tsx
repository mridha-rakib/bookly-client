import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PlatformBankAccount from "@/components/super-admin/finance/PlatformBankAccount";
import SuperAdminWithdrawals from "@/components/super-admin/finance/SuperAdminWithdrawals";
import { centralPayoutsApi, type PlatformBankAccountSummary, type CentralPayoutOverview } from "@/lib/api/centralPayouts";
import { validatePlatformRange } from "@/lib/superAdminDashboard/period";
import { centralPayoutKeys } from "@/lib/superAdminFinance/hooks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root, cache: QueryClient;
const bank = (): PlatformBankAccountSummary => ({
  mode: "LIVE", managedBy: "STRIPE", state: "CONFIGURED", payoutsEnabled: true,
  destinations: [{ bankName: "Platform Bank", last4: "1234", currency: "eur", country: "CY", status: "verified", defaultForCurrency: true }],
});
const flush = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); }); };
const render = async (node: React.ReactNode = <PlatformBankAccount />) => {
  await act(async () => root.render(<QueryClientProvider client={cache}>{node}</QueryClientProvider>)); await flush();
};
beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.spyOn(centralPayoutsApi, "getBankAccount").mockResolvedValue(bank());
  vi.spyOn(centralPayoutsApi, "getOverview").mockRejectedValue(new Error("Overview unavailable"));
  vi.spyOn(centralPayoutsApi, "list").mockResolvedValue({ withdrawals: [], pagination: { page: 1, limit: 20, total: 0 } });
  vi.spyOn(centralPayoutsApi, "initiate");
});
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); host.remove(); vi.restoreAllMocks(); });

it("shows masked platform data and Stripe management instructions with no bank-edit controls", async () => {
  await render();
  expect(host.textContent).toContain("Platform Bank Account");
  expect(host.textContent).toContain("Platform Bank");
  expect(host.textContent).toContain("•••• 1234");
  expect(host.textContent).toContain("EUR");
  expect(host.textContent).toContain("Business payout accounts are separate");
  expect(host.querySelector("input")).toBeNull();
  expect(host.querySelector("a")?.href).toBe("https://dashboard.stripe.com/settings/payouts");
  expect(centralPayoutsApi.initiate).not.toHaveBeenCalled();
});
it.each(["NO_DESTINATION", "NOT_CONFIGURED", "UNAVAILABLE"] as const)("distinguishes %s without claiming a connection", async (state) => {
  vi.mocked(centralPayoutsApi.getBankAccount).mockResolvedValue({ ...bank(), state, destinations: [], payoutsEnabled: null });
  await render();
  expect(host.textContent).not.toContain("Configured in Stripe");
  if (state === "NO_DESTINATION") expect(host.textContent).toContain("No platform payout bank account was returned");
  if (state === "NOT_CONFIGURED") expect(host.textContent).toContain("status is unknown");
  if (state === "UNAVAILABLE") expect(host.textContent).toContain("does not confirm whether");
});
it("shows loading, then an accurate failure with retry", async () => {
  let fail: (error: Error) => void = () => {};
  vi.mocked(centralPayoutsApi.getBankAccount).mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
  await render(); expect(host.textContent).toContain("Loading platform bank account");
  await act(async () => fail(new Error("Provider failure"))); await flush();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("unavailable");
  expect(host.textContent).not.toContain("Configured in Stripe");
  vi.mocked(centralPayoutsApi.getBankAccount).mockResolvedValue(bank());
  await act(async () => host.querySelector("button")!.click()); await flush();
  expect(host.textContent).toContain("Configured in Stripe");
});
it("shows provider-confirmed verification failures and disabled payouts without inferring a reason", async () => {
  const result = bank(); result.payoutsEnabled = false; result.destinations[0].status = "verification_failed";
  vi.mocked(centralPayoutsApi.getBankAccount).mockResolvedValue(result);
  await render();
  expect(host.textContent).toContain("Bank verification failed");
  expect(host.textContent).toContain("Payouts are disabled by Stripe");
});
it("keeps the bank panel visible when the balance/history overview fails", async () => {
  await render(<SuperAdminWithdrawals />);
  expect(host.textContent).toContain("Platform Bank");
  expect(host.textContent).toContain("Configured in Stripe");
  expect(centralPayoutsApi.getOverview).toHaveBeenCalled();
  expect(centralPayoutsApi.initiate).not.toHaveBeenCalled();
});
it("does not offer an active withdrawal while reserve authority is denied", async () => {
  const overview: CentralPayoutOverview = {
    mode: "LIVE", liveExecutionEnabled: false, balances: [{ currency: "eur", availableCents: 10000, pendingCents: 5000 }],
    payoutsInProgress: [], destinations: [{ id: "ba_platform", bankName: "Platform Bank", last4: "1234", currency: "eur", country: "CY", status: "verified", defaultForCurrency: true, eligible: true }],
    scheduleInterval: "manual", restrictions: [{ code: "CENTRAL_PAYOUT_RESERVE_POLICY_UNAPPROVED", message: "Reserve policy approval is required" }], recentStripePayouts: [], businessAttributedUnpaid: { currency: "eur", amountCents: 9000 },
  };
  vi.mocked(centralPayoutsApi.getOverview).mockResolvedValue(overview);
  await render(<SuperAdminWithdrawals />);
  const review = Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Review withdrawal");
  expect(review?.disabled).toBe(true);
  expect(host.textContent).toContain("Eligible platform funds have not been determined");
  expect(host.textContent).toContain("Reserve policy approval is required");
  expect(centralPayoutsApi.initiate).not.toHaveBeenCalled();
});

it("accepts the same inclusive 92-day autumn selection as the Finance API", () => {
  expect(validatePlatformRange("2026-09-01", "2026-12-01", 92)).toBeNull();
  expect(validatePlatformRange("2026-09-01", "2026-12-02", 92)).toContain("at most 92 days");
});

it("blocks a confirmation already open when withdrawal authority is revoked", async () => {
  const overview: CentralPayoutOverview = {
    mode: "TEST", liveExecutionEnabled: false, balances: [{ currency: "eur", availableCents: 10000, pendingCents: 0 }],
    payoutsInProgress: [], destinations: [{ id: "ba_platform", bankName: "Platform Bank", last4: "1234", currency: "eur", country: "CY", status: "verified", defaultForCurrency: true, eligible: true }],
    scheduleInterval: "manual", restrictions: [], recentStripePayouts: [], businessAttributedUnpaid: null,
  };
  vi.mocked(centralPayoutsApi.getOverview).mockResolvedValue(overview);
  await render(<SuperAdminWithdrawals />);
  const amount = host.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(amount, "10.00");
    amount.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Review withdrawal")!.click());
  expect(host.textContent).toContain("Confirm withdrawal");
  await act(async () => cache.setQueryData(centralPayoutKeys.overview(), { ...overview, restrictions: [{ code: "BLOCKED", message: "Authority revoked" }] }));
  await flush();
  const confirm = Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Confirm withdrawal");
  expect(confirm?.disabled).toBe(true);
  await act(async () => confirm!.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(centralPayoutsApi.initiate).not.toHaveBeenCalled();
});

it.each(["TEST", "LIVE"] as const)("labels %s credential context without implying withdrawal readiness", async (mode) => {
  vi.mocked(centralPayoutsApi.getBankAccount).mockResolvedValue({ ...bank(), mode });
  await render();
  expect(host.textContent).toContain(`${mode} Stripe credential context`);
  expect(host.textContent).toContain("withdrawal approval remains separate");
  expect(host.textContent).not.toContain("Ready to withdraw");
  if (mode === "TEST") expect(host.textContent).toContain("live bank setup is not confirmed");
});
it("explains permission-denied and partial inventories without hiding known masked banks", async () => {
  vi.mocked(centralPayoutsApi.getBankAccount).mockResolvedValue({ ...bank(), inventoryComplete: false, unavailableReason: "PERMISSIONS" });
  await render();
  expect(host.textContent).toContain("Platform Bank");
  expect(host.textContent).toContain("Only part of the bank-account inventory");
  expect(host.textContent).toContain("Stripe API permissions");
  expect(host.textContent).toContain("Default destination selection is unavailable");
});
it("renders incomplete nullable bank fields and unknown payout state accurately", async () => {
  vi.mocked(centralPayoutsApi.getBankAccount).mockResolvedValue({ ...bank(), payoutsEnabled: null, destinations: [{ bankName: null, last4: null, currency: null, country: null, status: null, defaultForCurrency: null }] });
  await render();
  expect(host.textContent).toContain("Bank name unavailable");
  expect(host.textContent).toContain("Masked identifier unavailable");
  expect(host.textContent).toContain("Default designation unavailable");
  expect(host.textContent).toContain("Destination data is incomplete");
  expect(host.textContent).toContain("payout-enabled status is unavailable");
  expect(host.textContent).not.toContain("Payouts are disabled by Stripe");
});
it("shows every currency and reviews its provider-default destination instead of the first bank", async () => {
  const destinations = [
    { id: "ba_secondary", bankName: "Secondary EUR", last4: "1111", currency: "eur", country: "CY", status: "verified", defaultForCurrency: false, eligible: false },
    { id: "ba_usd", bankName: "Default USD", last4: "2222", currency: "usd", country: "US", status: "verified", defaultForCurrency: true, eligible: true },
    { id: "ba_eur", bankName: "Default EUR", last4: "3333", currency: "eur", country: "CY", status: "verified", defaultForCurrency: true, eligible: true },
  ];
  vi.mocked(centralPayoutsApi.getBankAccount).mockResolvedValue({ ...bank(), mode: "TEST", destinations });
  vi.mocked(centralPayoutsApi.getOverview).mockResolvedValue({ mode: "TEST", liveExecutionEnabled: false, balances: [{ currency: "eur", availableCents: 10000, pendingCents: 0 }, { currency: "usd", availableCents: 20000, pendingCents: 0 }], payoutsInProgress: [], destinations, scheduleInterval: "manual", restrictions: [], recentStripePayouts: [], businessAttributedUnpaid: null });
  await render(<SuperAdminWithdrawals />);
  const panel = host.querySelector('[aria-label="Platform bank account"]')!;
  expect(panel.textContent).toContain("Secondary EUR"); expect(panel.textContent).toContain("Default USD"); expect(panel.textContent).toContain("Default EUR");
  expect(panel.textContent).toContain("Not the default for this currency");
  const amount = host.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(amount, "10.00");
    amount.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Review withdrawal")!.click());
  expect(host.textContent).toContain("linked bank account ending in 3333");
  expect(centralPayoutsApi.initiate).not.toHaveBeenCalled();
});
it("refuses an arbitrary first selection when multiple defaults are reported for a currency", async () => {
  const destinations = ["a", "b"].map(id => ({ id: `ba_${id}`, bankName: "Fixture", last4: "1234", currency: "eur", country: "CY", status: "verified", defaultForCurrency: true, eligible: true }));
  vi.mocked(centralPayoutsApi.getBankAccount).mockResolvedValue({ ...bank(), destinations });
  vi.mocked(centralPayoutsApi.getOverview).mockResolvedValue({ mode: "TEST", liveExecutionEnabled: false, balances: [{ currency: "eur", availableCents: 10000, pendingCents: 0 }], payoutsInProgress: [], destinations, scheduleInterval: "manual", restrictions: [], recentStripePayouts: [], businessAttributedUnpaid: null });
  await render(<SuperAdminWithdrawals />);
  expect(host.textContent).toContain("Multiple default bank accounts");
  expect(Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Review withdrawal")?.disabled).toBe(true);
  expect(centralPayoutsApi.initiate).not.toHaveBeenCalled();
});
