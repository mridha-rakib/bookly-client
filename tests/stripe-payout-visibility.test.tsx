import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SuperAdminWithdrawals from "@/components/super-admin/finance/SuperAdminWithdrawals";
import { centralPayoutsApi, type CentralPayoutOverview, type CentralProviderPayout } from "@/lib/api/centralPayouts";

/** FG03B-0 — read-only recent Stripe payout visibility on the Super Admin Withdrawals screen. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root, cache: QueryClient;
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); }); };
const render = async () => {
  await act(async () => root.render(<QueryClientProvider client={cache}><SuperAdminWithdrawals /></QueryClientProvider>));
  await flush();
};
const payout = (over: Partial<CentralProviderPayout>): CentralProviderPayout => ({
  id: "po_1", amountCents: 12345, currency: "eur", status: "paid", arrivalDate: null,
  created: "2030-01-02T10:00:00.000Z", automatic: false, livemode: false, failureCode: null,
  destinationLast4: "1234", origin: "NOT_VERIFIED", booklyOperationId: null, ...over,
});
const overview = (over: Partial<CentralPayoutOverview> = {}): CentralPayoutOverview => ({
  mode: "TEST", liveExecutionEnabled: false, balances: [{ currency: "eur", availableCents: 10000, pendingCents: 0 }],
  payoutsInProgress: [], destinations: [], scheduleInterval: "manual", restrictions: [],
  recentStripePayouts: [], recentStripePayoutsScope: { shown: 0, returnedByStripe: 0, requestLimit: 100 },
  businessAttributedUnpaid: null, ...over,
});
const rowFor = (id: string) => [...host.querySelectorAll("tbody tr")].find((tr) => tr.textContent?.includes(id));

beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.spyOn(centralPayoutsApi, "getBankAccount").mockResolvedValue({ mode: "TEST", managedBy: "STRIPE", state: "CONFIGURED", payoutsEnabled: true, destinations: [] });
  vi.spyOn(centralPayoutsApi, "list").mockResolvedValue({ withdrawals: [], pagination: { page: 1, limit: 20, total: 0 } });
  vi.spyOn(centralPayoutsApi, "initiate");
  vi.spyOn(centralPayoutsApi, "refresh");
});
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); host.remove(); vi.restoreAllMocks(); });

it("lists recent Stripe payouts with verified Bookly origin vs neutral unverified origin", async () => {
  vi.spyOn(centralPayoutsApi, "getOverview").mockResolvedValue(overview({
    recentStripePayouts: [
      payout({ id: "po_bookly", origin: "BOOKLY_WITHDRAWAL", booklyOperationId: "op123", arrivalDate: "2030-01-05T00:00:00.000Z" }),
      payout({ id: "po_dash", amountCents: 500, status: "in_transit", automatic: true, destinationLast4: null }),
      payout({ id: "po_fail", status: "failed", failureCode: "account_closed", livemode: true, currency: "jpy", amountCents: 700 }),
    ],
    recentStripePayoutsScope: { shown: 3, returnedByStripe: 57, requestLimit: 100 },
  }));
  await render();
  const text = host.textContent ?? "";
  expect(text).toContain("Recent Stripe payouts");
  expect(text).toContain("Withdrawals requested through Bookly");

  const bookly = rowFor("po_bookly")!.textContent!;
  expect(bookly).toContain("€123.45");
  expect(bookly).toContain("TEST");
  expect(bookly).toContain("Paid (reported by Stripe)");
  expect(bookly).toContain("Bookly withdrawal");
  expect(bookly).toContain("Ref op123");
  expect(bookly).toContain("•••• 1234");
  expect(bookly).toContain("Manual");

  const dash = rowFor("po_dash")!.textContent!;
  expect(dash).toContain("Origin not verified");
  expect(dash).toContain("Automatic (Stripe schedule)");
  expect(dash).toContain("In transit");
  expect(dash).toContain("Not provided");
  expect(dash).toContain("Not shown");

  const failed = rowFor("po_fail")!.textContent!;
  expect(failed).toContain("¥700");
  expect(failed).toContain("LIVE");
  expect(failed).toContain("account_closed");

  expect(text).toContain("Showing the 3 most recent of 57 payouts Stripe returned (Bookly requests at most 100)");
  expect(text).toContain("not a complete payout history");
  expect(text).toContain("It is not a finding that the payout was unauthorized");
  expect(text).toContain("Check the bank statement to confirm receipt");
  expect(text.toLowerCase()).not.toContain("unauthorized payout");
  expect(centralPayoutsApi.initiate).not.toHaveBeenCalled();
  expect(centralPayoutsApi.refresh).not.toHaveBeenCalled();
});

it("an empty or scope-less provider list never claims that no payouts happened", async () => {
  vi.spyOn(centralPayoutsApi, "getOverview").mockResolvedValue(overview({ recentStripePayoutsScope: undefined }));
  await render();
  expect(host.textContent).toContain("Stripe returned no recent payouts. This does not prove that no payouts were made.");
  expect(host.textContent).toContain("This list covers only Stripe's most recent payouts. It is not a complete payout history.");
});

it("shows the existing loading and error states instead of an empty payout list", async () => {
  let fail: (error: Error) => void = () => {};
  vi.spyOn(centralPayoutsApi, "getOverview").mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
  await render();
  expect(host.textContent).toContain("Loading Stripe balance");
  expect(host.textContent).not.toContain("Recent Stripe payouts");
  await act(async () => fail(new Error("Stripe unavailable"))); await flush();
  expect(host.textContent).not.toContain("Recent Stripe payouts");
  expect(host.textContent).not.toContain("Stripe returned no recent payouts");
  expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Try again")).toBe(true);
});
