import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SuperAdminWithdrawals from "@/components/super-admin/finance/SuperAdminWithdrawals";
import { BooklyApiError } from "@/lib/api/client";
import { centralPayoutsApi, type CentralPayoutOverview } from "@/lib/api/centralPayouts";
import { centralPayoutKeys } from "@/lib/superAdminFinance/hooks";
import { currencyEligibility, withdrawalEligibility } from "./helpers/withdrawal-eligibility";

/** CW-1 — the Withdrawals form uses only the server's eligibility decision. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root, cache: QueryClient;
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); }); };
const render = async () => {
  await act(async () => root.render(<QueryClientProvider client={cache}><SuperAdminWithdrawals /></QueryClientProvider>));
  await flush(); await flush();
};
const overview = (over: Partial<CentralPayoutOverview> = {}): CentralPayoutOverview => ({
  mode: "TEST", liveExecutionEnabled: false, balances: [{ currency: "eur", availableCents: 50_000, pendingCents: 0 }],
  payoutsInProgress: [], destinations: [{ id: "ba_platform", bankName: "Platform Bank", last4: "1234", currency: "eur", country: "CY", status: "verified", defaultForCurrency: true, eligible: true }],
  scheduleInterval: "manual", restrictions: [], recentStripePayouts: [], businessAttributedUnpaid: { currency: "eur", amountCents: 28_000 }, ...over,
});
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label);
const type = async (selector: string, value: string) => {
  const input = host.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const reviewAndEnterPassword = async (amount: string) => {
  await type('input[inputmode="decimal"]', amount);
  await act(async () => button("Review withdrawal")!.click());
  await type('input[type="password"]', "correct-password");
};

beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.spyOn(centralPayoutsApi, "getBankAccount").mockResolvedValue({ mode: "TEST", managedBy: "STRIPE", state: "CONFIGURED", payoutsEnabled: true, destinations: [] });
  vi.spyOn(centralPayoutsApi, "getOverview").mockResolvedValue(overview());
  vi.spyOn(centralPayoutsApi, "list").mockResolvedValue({ withdrawals: [], pagination: { page: 1, limit: 20, total: 0 } });
  vi.spyOn(centralPayoutsApi, "getEligibility").mockResolvedValue(withdrawalEligibility());
  vi.spyOn(centralPayoutsApi, "initiate");
});
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); host.remove(); vi.restoreAllMocks(); });

it("shows the server's eligible amount, protections and the Bookly/Business distinction", async () => {
  await render();
  const panel = host.querySelector('[aria-label="Withdrawal eligibility"]')!.textContent ?? "";
  expect(panel).toContain("Eligible to withdraw now: €100.00");
  expect(panel).toContain("Stripe available€500.00");
  expect(panel).toContain("Cash Bookly's ledger attributes to Stripe€1,300.00");
  expect(panel).toContain("Protected: refundable bookings€300.00");
  expect(panel).toContain("Protected: refundable packages€45.00");
  expect(panel).toContain("Protected: disputes not yet debited€40.00");
  expect(panel).toContain("Bookly net platform-fee revenue (recorded)€970.00");
  expect(panel).toContain("Business-owned funds (recorded)€400.00");
  expect(panel).toContain("Recorded transfers to Businesses€120.00");
  expect(panel).toContain("Still owed to Businesses€280.00");
  expect(panel).toContain("it is never Bookly revenue");
  expect(host.textContent).toContain("Amount (eligible €100.00)");
});

it("refuses more than the eligible amount and confirms with the reviewed digest", async () => {
  await render();
  await type('input[inputmode="decimal"]', "100.01");
  await act(async () => button("Review withdrawal")!.click());
  expect(host.textContent).toContain("The amount is more than the eligible €100.00.");
  vi.mocked(centralPayoutsApi.initiate).mockResolvedValue({
    id: "op_1", mode: "TEST", amountCents: 10_000, currency: "eur", destination: { bankName: "Platform Bank", last4: "1234" },
    state: "SUBMITTED", providerPayoutId: "po_1", providerStatus: "pending", estimatedArrivalAt: null, failureCode: null, failureMessage: null,
    initiatedBy: { userId: "u1", email: "admin@example.com" }, createdAt: "2030-01-02T10:00:00.000Z", lastSyncedAt: null, audit: [],
  });
  await reviewAndEnterPassword("100.00");
  expect(host.textContent).toContain("re-checks the eligible amount immediately before sending");
  await act(async () => button("Confirm withdrawal")!.click()); await flush();
  expect(centralPayoutsApi.initiate).toHaveBeenCalledWith(expect.objectContaining({
    amountCents: 10_000, currency: "eur", destinationId: "ba_platform", currentPassword: "correct-password", eligibilityDigest: "a".repeat(64),
  }));
  expect(host.textContent).toContain("Withdrawal of €100.00 submitted");
  expect(host.textContent).toContain("Pending");
});

it("disables withdrawal and explains why when the server reports eligibility unavailable", async () => {
  vi.mocked(centralPayoutsApi.getEligibility).mockResolvedValue(withdrawalEligibility([currencyEligibility({
    status: "UNAVAILABLE", eligibleCents: 0,
    blockers: [{ code: "HISTORY_NEVER_SYNCED", message: "Stripe payout history has never been fully read; older payouts may be missing." }],
  })]));
  await render();
  expect(host.textContent).toContain("Eligible amount unavailable");
  expect(host.textContent).toContain("Stripe payout history has never been fully read");
  expect(button("Review withdrawal")?.disabled).toBe(true);
  expect(centralPayoutsApi.initiate).not.toHaveBeenCalled();
});

it("a changed evaluation invalidates an open review; a server ELIGIBILITY_CHANGED returns to review", async () => {
  await render();
  await reviewAndEnterPassword("50.00");
  // The evaluation changes while the confirmation is open: confirming is blocked.
  await act(async () => cache.setQueryData(centralPayoutKeys.eligibility(), withdrawalEligibility([currencyEligibility({ digest: "b".repeat(64) })])));
  await flush();
  expect(host.textContent).toContain("The eligible amount changed since your review.");
  expect(button("Confirm withdrawal")?.disabled).toBe(true);
  await act(async () => button("Cancel")!.click());
  // The server detects the change first: its refusal closes the review with a clear message.
  vi.mocked(centralPayoutsApi.initiate).mockRejectedValue(new BooklyApiError({
    message: "The financial evidence changed since you reviewed this withdrawal. Review the new eligible amount and confirm again.",
    status: 409, code: "CENTRAL_PAYOUT_ELIGIBILITY_CHANGED",
  }));
  await reviewAndEnterPassword("50.00");
  await act(async () => button("Confirm withdrawal")!.click()); await flush();
  expect(host.textContent).toContain("The financial evidence changed since you reviewed this withdrawal.");
  expect(button("Confirm withdrawal")).toBeUndefined();
  expect(button("Review withdrawal")).toBeDefined();
});

it("an eligibility read failure is visible with retry and blocks withdrawal", async () => {
  vi.mocked(centralPayoutsApi.getEligibility).mockRejectedValue(new Error("Stripe unavailable"));
  await render();
  expect(host.textContent).toContain("Eligible amount unavailable: Stripe unavailable");
  expect(button("Retry")).toBeDefined();
  expect(button("Review withdrawal")?.disabled).toBe(true);
});
