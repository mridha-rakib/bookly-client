import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PlatformBankAccount from "@/components/super-admin/finance/PlatformBankAccount";
import SuperAdminWithdrawals from "@/components/super-admin/finance/SuperAdminWithdrawals";
import { centralPayoutsApi, type CentralPayoutOperation, type CentralPayoutOverview } from "@/lib/api/centralPayouts";
import { withdrawalEligibility } from "./helpers/withdrawal-eligibility";

/** Stripe TEST keys cannot list bank accounts: Stripe chooses the TEST default destination. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const LABEL = "Stripe TEST default destination — bank details unavailable in TEST mode.";
let host: HTMLDivElement, root: Root, cache: QueryClient;
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); }); };
const render = async (node: React.ReactNode) => {
  await act(async () => root.render(<QueryClientProvider client={cache}>{node}</QueryClientProvider>));
  await flush(); await flush();
};
const overview = (over: Partial<CentralPayoutOverview> = {}): CentralPayoutOverview => ({
  mode: "TEST", liveExecutionEnabled: false, balances: [{ currency: "eur", availableCents: 50_000, pendingCents: 0 }],
  payoutsInProgress: [], destinations: [], stripeTestDefaultDestination: { id: "stripe_test_default", label: LABEL },
  scheduleInterval: "manual", restrictions: [], recentStripePayouts: [], businessAttributedUnpaid: null, ...over,
});
const operation = (over: Partial<CentralPayoutOperation> = {}): CentralPayoutOperation => ({
  id: "op_1", mode: "TEST", amountCents: 5_000, currency: "eur", destination: { bankName: null, last4: "", stripeTestDefault: true },
  state: "SUBMITTED", providerPayoutId: "po_1", providerStatus: "pending", estimatedArrivalAt: null, failureCode: null, failureMessage: null,
  initiatedBy: { userId: "u1", email: "admin@example.com" }, createdAt: "2030-01-02T10:00:00.000Z", lastSyncedAt: null, audit: [], ...over,
});
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label);
const type = async (selector: string, value: string) => {
  const input = host.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const reviewAndConfirm = async (amount: string) => {
  await type('input[inputmode="decimal"]', amount);
  await act(async () => button("Review withdrawal")!.click());
  await type('input[type="password"]', "correct-password");
  await act(async () => button("Confirm withdrawal")!.click()); await flush();
};

beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.spyOn(centralPayoutsApi, "getBankAccount").mockResolvedValue({
    mode: "TEST", managedBy: "STRIPE", state: "UNAVAILABLE", payoutsEnabled: true, inventoryComplete: false,
    unavailableReason: "TEST_MODE_RESTRICTED", destinations: [],
  });
  vi.spyOn(centralPayoutsApi, "getOverview").mockResolvedValue(overview());
  vi.spyOn(centralPayoutsApi, "list").mockResolvedValue({ withdrawals: [], pagination: { page: 1, limit: 20, total: 0 } });
  vi.spyOn(centralPayoutsApi, "getEligibility").mockResolvedValue(withdrawalEligibility());
  vi.spyOn(centralPayoutsApi, "initiate");
});
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); host.remove(); vi.restoreAllMocks(); });

it("TEST: shows the TEST default label, confirms with the marker and labels the payout as simulated", async () => {
  vi.mocked(centralPayoutsApi.initiate).mockResolvedValue(operation());
  await render(<SuperAdminWithdrawals />);
  expect(host.textContent).toContain(`Destination: ${LABEL}`);
  await type('input[inputmode="decimal"]', "50.00");
  await act(async () => button("Review withdrawal")!.click());
  expect(host.textContent).toContain(`Withdraw €50.00 to the ${LABEL}`);
  expect(host.textContent).toContain("simulated Stripe TEST payout: no bank transfer takes place");
  expect(host.textContent).not.toContain("ending in");
  await type('input[type="password"]', "correct-password");
  await act(async () => button("Confirm withdrawal")!.click()); await flush();
  expect(centralPayoutsApi.initiate).toHaveBeenCalledWith(expect.objectContaining({
    amountCents: 5_000, currency: "eur", destinationId: "stripe_test_default", currentPassword: "correct-password", eligibilityDigest: "a".repeat(64),
  }));
  expect(host.textContent).toContain("Simulated Stripe TEST payout to the Stripe TEST default destination — not a bank transfer.");
});

it("TEST: Stripe's refusal (no usable default) is shown as Stripe's own message", async () => {
  vi.mocked(centralPayoutsApi.initiate).mockResolvedValue(operation({
    state: "REJECTED", providerPayoutId: null, providerStatus: null, failureCode: "parameter_missing",
    failureMessage: "You do not have a default external account in eur.",
  }));
  await render(<SuperAdminWithdrawals />);
  await reviewAndConfirm("50.00");
  expect(host.textContent).toContain("Not created");
  expect(host.textContent).toContain("Stripe: You do not have a default external account in eur.");
});

it("LIVE never offers the TEST default destination", async () => {
  vi.mocked(centralPayoutsApi.getOverview).mockResolvedValue(overview({ mode: "LIVE", liveExecutionEnabled: true }));
  // Even a (malformed) LIVE response carrying the TEST reason never shows the TEST default.
  vi.mocked(centralPayoutsApi.getBankAccount).mockResolvedValue({
    mode: "LIVE", managedBy: "STRIPE", state: "UNAVAILABLE", payoutsEnabled: true, inventoryComplete: false,
    unavailableReason: "TEST_MODE_RESTRICTED", destinations: [],
  });
  await render(<SuperAdminWithdrawals />);
  expect(host.textContent).not.toContain(LABEL);
  expect(host.textContent).toContain("No confirmed usable default for this currency.");
  expect(button("Review withdrawal")?.disabled).toBe(true);
  expect(centralPayoutsApi.initiate).not.toHaveBeenCalled();
});

it("withdrawal history marks TEST default payouts without inventing bank details", async () => {
  vi.mocked(centralPayoutsApi.list).mockResolvedValue({ withdrawals: [operation()], pagination: { page: 1, limit: 20, total: 1 } });
  await render(<SuperAdminWithdrawals />);
  expect(host.textContent).toContain("Stripe TEST default destination (bank details unavailable)");
  expect(host.textContent).not.toContain("•••• ");
});

it("the platform bank panel explains the TEST bank-list restriction", async () => {
  await render(<PlatformBankAccount />);
  expect(host.textContent).toContain(LABEL);
  expect(host.textContent).toContain("Stripe does not list bank accounts to a TEST key");
});
