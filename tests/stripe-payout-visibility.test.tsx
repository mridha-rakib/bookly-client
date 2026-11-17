import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SuperAdminWithdrawals from "@/components/super-admin/finance/SuperAdminWithdrawals";
import {
  centralPayoutsApi,
  type CentralPayoutOverview,
  type CentralProviderPayout,
  type ObservedPayout,
  type ObservedPayoutPage,
} from "@/lib/api/centralPayouts";

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
const observed = (over: Partial<ObservedPayout> = {}): ObservedPayout => ({
  providerPayoutId: "po_obs_1", mode: "TEST", amountCents: 4200, currency: "eur", status: "paid", automatic: true,
  created: "2029-12-01T10:00:00.000Z", arrivalDate: null, failureCode: null, destinationLast4: "6789",
  linkage: "NOT_VERIFIED", booklyOperationId: null, namedOperationId: null, firstObservedVia: "HISTORY_SYNC",
  firstObservedAt: "2030-01-01T10:00:00.000Z", providerLifecycle: "REPORTED_PAID",
  lastVerifiedAt: "2030-01-01T10:00:00.000Z", lastVerifiedVia: "HISTORY_SYNC", lastListedAt: "2030-01-01T10:00:00.000Z",
  statusVerification: "CURRENT", listedStatusConflict: null, reviewReasons: ["NOT_VERIFIED"], ...over,
});
const evidence = (over: Partial<ObservedPayoutPage["evidence"]> = {}): ObservedPayoutPage["evidence"] => ({
  coverageState: "COMPLETE", completeAsOf: "2030-01-01T10:00:00.000Z", coverageAccountMatches: true,
  statusVerifiedAsOf: "2030-01-01T10:00:00.000Z", verificationStale: false, verificationInProgress: false,
  lastError: null, otherAccountObservations: 0, ...over,
});
const observedPage = (over: Partial<ObservedPayoutPage> = {}): ObservedPayoutPage => ({
  mode: "TEST", modeIsCurrent: true, accountVerified: true, items: [],
  pagination: { page: 1, limit: 20, total: 0 },
  evidence: evidence(),
  ...over,
});

beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.spyOn(centralPayoutsApi, "getBankAccount").mockResolvedValue({ mode: "TEST", managedBy: "STRIPE", state: "CONFIGURED", payoutsEnabled: true, destinations: [] });
  vi.spyOn(centralPayoutsApi, "list").mockResolvedValue({ withdrawals: [], pagination: { page: 1, limit: 20, total: 0 } });
  vi.spyOn(centralPayoutsApi, "initiate");
  vi.spyOn(centralPayoutsApi, "refresh");
  vi.spyOn(centralPayoutsApi, "listObservedPayouts").mockResolvedValue(observedPage());
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
  expect(text).toContain("Neither is a finding that the payout was unauthorized");
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

// --- FG03B-1 — reconciliation readiness ----------------------------------------------------------
const readiness = (over: Partial<NonNullable<CentralPayoutOverview["reconciliation"]>> = {}): NonNullable<CentralPayoutOverview["reconciliation"]> => ({
  mode: "TEST", evidenceComplete: false, reviewNeeded: true,
  coverage: { state: "IN_PROGRESS", completeAsOf: null, lastCompletedAt: null, lastRunAt: "2030-01-02T10:00:00.000Z", runInProgress: { pages: 3, observed: 250 }, lastError: "Rate limited by Stripe", accountMatches: true },
  observations: { total: 9, verifiedBookly: 4, notVerified: 3, unresolved: 2, inFlight: 1 },
  unresolvedWithdrawalOperations: 1, syncEnabled: false,
  blockers: [
    { code: "HISTORY_INCOMPLETE", message: "A payout history read has started but has not reached Stripe's last page." },
    { code: "UNVERIFIED_PAYOUTS_PRESENT", message: "3 Stripe payout(s) are not linked to a Bookly withdrawal. This is not a finding that they were unauthorized." },
  ],
  ...over,
});

it("labels unresolved linkage and shows incomplete reconciliation without any action when sync is disabled", async () => {
  vi.spyOn(centralPayoutsApi, "getOverview").mockResolvedValue(overview({
    recentStripePayouts: [payout({ id: "po_named", origin: "LINKAGE_UNRESOLVED" })],
    reconciliation: readiness(),
  }));
  vi.spyOn(centralPayoutsApi, "syncProviderHistory");
  await render();
  expect(rowFor("po_named")!.textContent).toContain("Linkage unresolved");
  const text = host.textContent ?? "";
  expect(text).toContain("Payout reconciliation");
  expect(text).toContain("This is not permission to withdraw");
  expect(text).toContain("Review needed");
  expect(text).toContain("Incomplete");
  expect(text).toContain("Read in progress: 3 page(s), 250 payout(s) so far.");
  expect(text).toContain("4 linked to a Bookly withdrawal");
  expect(text).toContain("3 origin not verified");
  expect(text).toContain("2 linkage unresolved");
  expect(text).toContain("1 pending or in transit");
  expect(text).toContain("1 Bookly withdrawal(s) awaiting Stripe confirmation");
  expect(text).toContain("has not reached Stripe's last page");
  expect(text).toContain("not enabled in this deployment");
  expect([...host.querySelectorAll("button")].some((b) => b.textContent?.includes("Read Stripe payout history"))).toBe(false);
  expect(centralPayoutsApi.syncProviderHistory).not.toHaveBeenCalled();
});

it("complete evidence is never presented as withdrawal permission; account mismatch is visible", async () => {
  vi.spyOn(centralPayoutsApi, "getOverview").mockResolvedValue(overview({
    reconciliation: readiness({
      evidenceComplete: true, reviewNeeded: false, blockers: [],
      coverage: { state: "COMPLETE", completeAsOf: "2030-01-02T10:00:00.000Z", lastCompletedAt: "2030-01-02T10:05:00.000Z", lastRunAt: "2030-01-02T10:00:00.000Z", runInProgress: null, lastError: null, accountMatches: false },
      observations: { total: 4, verifiedBookly: 4, notVerified: 0, unresolved: 0, inFlight: 0 },
      unresolvedWithdrawalOperations: 0,
    }),
  }));
  await render();
  const text = host.textContent ?? "";
  expect(text).toContain("Provider evidence complete");
  expect(text).toContain("This is not permission to withdraw");
  expect(text).toContain("Later payouts and status changes rely on webhook delivery");
  expect(text).toContain("The connected Stripe account differs");
  expect(centralPayoutsApi.initiate).not.toHaveBeenCalled();
});

it("runs one bounded history read when enabled, reports partial progress, and surfaces errors", async () => {
  vi.spyOn(centralPayoutsApi, "getOverview").mockResolvedValue(overview({ reconciliation: readiness({ syncEnabled: true }) }));
  const sync = vi.spyOn(centralPayoutsApi, "syncProviderHistory").mockResolvedValue({
    mode: "TEST", outcome: "PAUSED_AT_PAGE_LIMIT", state: "IN_PROGRESS", pagesThisCall: 5, observedThisCall: 500, completeAsOf: null, error: null,
  });
  await render();
  const button = () => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Read Stripe payout history"))!;
  await act(async () => button().click()); await flush();
  expect(sync).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("Read 5 page(s), 500 payout(s): history still incomplete; run again to continue.");
  sync.mockRejectedValueOnce(new Error("Another payout history sync is running. Try again shortly."));
  await act(async () => button().click()); await flush();
  expect(sync).toHaveBeenCalledTimes(2);
  expect(centralPayoutsApi.initiate).not.toHaveBeenCalled();
});

it("tolerates an older API without reconciliation data", async () => {
  vi.spyOn(centralPayoutsApi, "getOverview").mockResolvedValue(overview({ reconciliation: undefined }));
  await render();
  expect(host.textContent).toContain("Payout reconciliation status is not available from this server.");
  // FG03B-2 — an API without readiness has no review route either: nothing is requested.
  expect(host.textContent).not.toContain("Observed Stripe payouts");
  expect(centralPayoutsApi.listObservedPayouts).not.toHaveBeenCalled();
});

// --- FG03B-2 — account identity, freshness and the read-only review ------------------------------
const choose = async (label: string, value: string) => {
  const el = host.querySelector(`[aria-label="${label}"]`) as HTMLSelectElement | HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
};
const reviewCard = () =>
  [...host.querySelectorAll("div")].find((d) => d.firstElementChild?.textContent?.startsWith("Observed Stripe payouts") && d.querySelector("table"));

it("shows freshness and fails closed on an unidentified Stripe account", async () => {
  vi.spyOn(centralPayoutsApi, "getOverview").mockResolvedValue(overview({
    reconciliation: readiness({
      observations: { total: 5, verifiedBookly: 1, notVerified: 2, unresolved: 0, inFlight: 1, reportedPaid: 3, stale: 2, notReconfirmed: 1, statusConflicts: 1, otherAccounts: 4 },
      freshness: { statusVerifiedAsOf: "2029-12-20T09:00:00.000Z", verificationStale: true, freshnessTargetHours: 24 },
      finality: { established: false, code: "BANK_SETTLEMENT_NOT_VERIFIED", message: "Stripe's `paid` is Stripe's report, not a bank-confirmed receipt." },
      coverage: { state: "COMPLETE", completeAsOf: "2029-12-20T09:00:00.000Z", lastCompletedAt: null, lastRunAt: null, runInProgress: { pages: 1, observed: 100, startedAt: "2030-01-02T09:00:00.000Z" }, lastError: null, accountMatches: true },
    }),
  }));
  await render();
  let text = host.textContent ?? "";
  // FG03B-3 — no finality window: paid is never shown as settled or final.
  expect(text).toContain("3 reported paid by Stripe (not bank-confirmed; can still change to failed)");
  expect(text).not.toMatch(/settled/i);
  expect(text).toContain("2 not re-confirmed by Stripe recently");
  expect(text).toContain("1 not listed by the last full Stripe read");
  expect(text).toContain("1 with a status Stripe's current list contradicts");
  expect(text).toContain("4 record(s) from a previously connected Stripe account are kept but not counted.");
  expect(text).toContain("Every payout status re-verified by a full Stripe read on 20 Dec 2029");
  expect(text).toContain("Re-verification in progress: 1 page(s), 100 payout(s) so far.");
  expect(text).toContain("Payout statuses were last re-verified more than 24 hours ago.");
  expect(text).toContain("Financial finality: not established.");
  expect(text).toContain("not a bank-confirmed receipt");

  await act(async () => root.unmount());
  root = createRoot(host);
  cache.clear();
  vi.mocked(centralPayoutsApi.getOverview).mockResolvedValue(overview({
    reconciliation: readiness({ accountVerified: false, observations: { total: 0, verifiedBookly: 0, notVerified: 0, unresolved: 0, inFlight: 0 } }),
  }));
  vi.mocked(centralPayoutsApi.listObservedPayouts).mockRejectedValue(
    new Error("The current Stripe account could not be identified, so payout evidence cannot be shown"),
  );
  await render(); await flush();
  text = host.textContent ?? "";
  expect(text).toContain("Counts unavailable: the current Stripe account could not be identified");
  expect(text).not.toContain("0 linked to a Bookly withdrawal");
  expect(text).toContain("payout evidence cannot be shown");
  expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Retry")).toBe(true);
});

it("reviews observed payouts read-only with filters, pagination and evidence state", async () => {
  vi.spyOn(centralPayoutsApi, "getOverview").mockResolvedValue(overview({ reconciliation: readiness() }));
  vi.mocked(centralPayoutsApi.listObservedPayouts).mockResolvedValue(observedPage({
    items: [
      observed({ providerPayoutId: "po_unverified", statusVerification: "STALE", providerLifecycle: "IN_FLIGHT", status: "in_transit", reviewReasons: ["NOT_VERIFIED", "STALE"] }),
      observed({ providerPayoutId: "po_named", linkage: "UNRESOLVED", namedOperationId: "op_named_1", reviewReasons: ["UNRESOLVED"], destinationLast4: null }),
      observed({ providerPayoutId: "po_bookly_obs", linkage: "VERIFIED_BOOKLY", booklyOperationId: "op_ver_1", reviewReasons: [], automatic: false, failureCode: "account_closed", status: "failed", providerLifecycle: "ENDED", lastVerifiedVia: "WEBHOOK" }),
      observed({ providerPayoutId: "po_conflict", status: "failed", providerLifecycle: "ENDED", statusVerification: "CONFLICT", listedStatusConflict: "paid", reviewReasons: ["NOT_VERIFIED", "STATUS_CONFLICT"] }),
      observed({ providerPayoutId: "po_ghost", statusVerification: "NOT_RECONFIRMED", lastListedAt: null, lastVerifiedVia: "WEBHOOK", reviewReasons: ["NOT_VERIFIED", "NOT_RECONFIRMED"] }),
    ],
    pagination: { page: 1, limit: 20, total: 45 },
    evidence: evidence({ verificationStale: true, verificationInProgress: true, lastError: "Rate limited by Stripe", otherAccountObservations: 3 }),
  }));
  await render(); await flush(); // the review query starts once the overview has loaded
  expect(centralPayoutsApi.listObservedPayouts).toHaveBeenLastCalledWith({ page: 1, limit: 20 });
  const card = reviewCard()!;
  const text = card.textContent ?? "";
  expect(text).toContain("This is not Bookly's money ledger, and nothing here approves, assigns or moves money.");
  const unverified = rowFor("po_unverified")!.textContent!;
  expect(unverified).toContain("Needs review");
  expect(unverified).toContain("Origin not verified");
  expect(unverified).toContain("In transit");
  expect(unverified).toContain("Stale: re-read needed");
  expect(unverified).toContain("•••• 6789");
  expect(unverified).toContain("By history read");
  expect(unverified).toContain("Last full read");
  const named = rowFor("po_named")!.textContent!;
  expect(named).toContain("Linkage unresolved");
  expect(named).toContain("Names op_named_1 (unconfirmed)");
  expect(named).toContain("Not recorded");
  // Stripe-reported paid is labelled as such, never as settled or bank-confirmed.
  expect(named).toContain("Paid (reported by Stripe)");
  expect(named).toContain("Not bank-confirmed; can still fail");
  expect(named).toContain("Verified current");
  const bookly = rowFor("po_bookly_obs")!.textContent!;
  expect(bookly).toContain("Bookly withdrawal");
  expect(bookly).toContain("Ref op_ver_1");
  expect(bookly).not.toContain("Needs review");
  expect(bookly).toContain("account_closed");
  expect(bookly).toContain("By webhook");
  expect(bookly).not.toContain("Not bank-confirmed");
  expect(rowFor("po_conflict")!.textContent).toContain("Stripe list now says Paid (reported by Stripe)");
  const ghost = rowFor("po_ghost")!.textContent!;
  expect(ghost).toContain("Not in last full Stripe read");
  expect(ghost).toContain("Never in a full read");
  expect(text).toContain("more than 24 hours ago: newer payouts or status changes may be missing");
  expect(text).toContain("A full re-verification read is in progress.");
  expect(text).toContain("The last Stripe read stopped: Rate limited by Stripe");
  expect(text).not.toMatch(/settled/i);
  expect(text).toContain("3 record(s) from a previously connected Stripe account are excluded.");
  expect(text).toContain("Page 1 of 3 · 45 record(s)");
  expect(text).toContain("Neither is a finding that a payout was unauthorized.");
  // No financial action of any kind is offered in the review.
  const labels = [...card.querySelectorAll("button")].map((b) => b.textContent ?? "");
  expect(labels).toEqual(["Previous", "Next"]);
  for (const forbidden of [/approve/i, /assign/i, /withdraw/i, /release/i, /delete/i])
    expect(labels.some((l) => forbidden.test(l))).toBe(false);

  // Filters go to the server; any filter change returns to page 1.
  const next = [...card.querySelectorAll("button")].find((b) => b.textContent === "Next")!;
  await act(async () => next.click()); await flush();
  expect(centralPayoutsApi.listObservedPayouts).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
  await choose("Linkage", "NOT_VERIFIED");
  expect(centralPayoutsApi.listObservedPayouts).toHaveBeenLastCalledWith({ linkage: "NOT_VERIFIED", page: 1, limit: 20 });
  await choose("Stripe status", "in_transit");
  await choose("Mode", "LIVE");
  await choose("Created from", "2029-11-01");
  await choose("Created to", "2029-12-31");
  const review = [...card.querySelectorAll("label")].find((l) => l.textContent?.includes("Needs financial review only"))!;
  await act(async () => (review.querySelector("input") as HTMLInputElement).click()); await flush();
  expect(centralPayoutsApi.listObservedPayouts).toHaveBeenLastCalledWith({
    linkage: "NOT_VERIFIED", status: "in_transit", mode: "LIVE", from: "2029-11-01", to: "2029-12-31", needsReview: true, page: 1, limit: 20,
  });
  await choose("Linkage", "");
  expect(vi.mocked(centralPayoutsApi.listObservedPayouts).mock.lastCall?.[0]).not.toHaveProperty("linkage");
  expect(centralPayoutsApi.initiate).not.toHaveBeenCalled();
  expect(centralPayoutsApi.refresh).not.toHaveBeenCalled();
});

it("an empty review never claims that no payouts were made", async () => {
  vi.spyOn(centralPayoutsApi, "getOverview").mockResolvedValue(overview({ reconciliation: readiness() }));
  vi.mocked(centralPayoutsApi.listObservedPayouts).mockResolvedValue(observedPage({
    evidence: evidence({ coverageState: "NEVER_RUN", completeAsOf: null, coverageAccountMatches: null, statusVerifiedAsOf: null }),
  }));
  await render(); await flush();
  expect(host.textContent).toContain("No observed payouts match these filters. Bookly only holds payouts it has read from Stripe, so this does not prove that none were made.");
  expect(host.textContent).toContain("Stripe history has never been fully read: this list holds only payouts seen by webhook.");
});
