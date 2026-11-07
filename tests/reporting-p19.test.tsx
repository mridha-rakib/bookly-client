import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/api/auth";
import { BooklyApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/store";
import StaffOverview from "@/components/dashboard/StaffOverview";
import SupervisorOverview from "@/components/dashboard/SupervisorOverview";
import SuperAdminDashboardContent from "@/components/super-admin/overview/SuperAdminDashboardContent";
import SuperAdminFinanceLog from "@/components/super-admin/finance/SuperAdminFinanceLog";
import SuperAdminFinancePending from "@/components/super-admin/finance/SuperAdminFinancePending";
import { resolveOverviewPeriod } from "@/lib/superAdminDashboard/period";

type Request = { method?: string; url: string; params?: Record<string, string> };
const fx = vi.hoisted(() => ({
  requests: [] as Request[],
  respond: undefined as undefined | ((request: Request) => Promise<unknown>),
  downloads: [] as Array<{ url: string; params: Record<string, unknown>; filename: string }>,
}));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<object>()),
  apiRequest: (request: Request) => {
    fx.requests.push(request);
    return fx.respond!(request);
  },
}));
vi.mock("@/lib/api/csv-download", () => ({
  downloadCsv: async (url: string, params: Record<string, unknown>, filename: string) => {
    fx.downloads.push({ url, params, filename });
  },
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/super-admin/overview/SuperAdminOverviewBanner", () => ({ default: () => null }));
vi.mock("@/components/super-admin/analytics/SuperAdminCityCoverage", () => ({ default: () => null }));
vi.mock("@/components/super-admin/overview/SuperAdminRecentActivity", () => ({ default: () => null }));
vi.mock("@/components/super-admin/finance/PayoutDestinationPanel", () => ({ default: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root, client: QueryClient;
let gates: Map<string, Promise<void>>;
let failures: Map<string, unknown>;
let me: { business?: { id: string } | null };
const previousAuth = useAuthStore.getState();

function auth(id: string, role: AuthUser["role"]) {
  useAuthStore.setState({
    user: { id, role, email: `${id}@example.test`, status: "ACTIVE" },
    status: "authenticated",
    isInitializing: false,
    cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
  });
}

const overviewFor = (params: Record<string, string> | undefined) => {
  const count = { Today: 1, "7D": 7, "30D": 30, Custom: 99 }[params?.range ?? "Today"] ?? 0;
  return {
    scope: "FULL", currency: "EUR", todayDateStr: "2026-11-07",
    period: { fromDate: params?.fromDate ?? "2026-11-01", toDate: params?.toDate ?? "2026-11-07", timezone: "Europe/Nicosia", scheduleLimit: 200 },
    todayBookingsCount: count, todayRemainingCount: 0, schedule: [], timeline: [],
    financials: { payAtVenueDueCents: 0, noShowMonthCount: count + 1000, noShowMonthChargedCents: 0, monthlyRevenueCents: 0, recentActivity: [] },
  };
};
const summary = (bookingsTotal: number) => ({
  period: { from: "2020-01-01T00:00:00.000Z", to: "2026-11-07T00:00:00.000Z", isAllTime: bookingsTotal === 500 },
  businesses: { PENDING: 1, APPROVED: 2, WARNING: 0, SUSPENDED: 0, total: 3 },
  customers: { total: 9 },
  bookings: { total: bookingsTotal, UPCOMING: 1, COMPLETED: 2, NO_SHOW_CHARGED: 0, NO_SHOW_WAIVED: 0, NO_SHOW_CANCELLED: 0,
    CANCELLED_BY_CUSTOMER: 0, CANCELLED_BY_BUSINESS: 0, LATE_CANCELLATION: 0 },
  platformRevenueCents: 12345, pendingBusinessPayableCents: 700, completedPayoutsAllTimeCents: 900,
});

beforeEach(() => {
  fx.requests = [];
  fx.downloads = [];
  gates = new Map();
  failures = new Map();
  me = { business: { id: "biz-1" } };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  fx.respond = async (request) => {
    const key = `${request.url} ${request.params?.range ?? ""}${request.params?.fromDate ?? ""}`;
    const gate = [...gates.entries()].find(([prefix]) => key.startsWith(prefix));
    if (gate) await gate[1];
    const failure = [...failures.entries()].find(([prefix]) => key.startsWith(prefix));
    if (failure) {
      failures.delete(failure[0]);
      throw failure[1];
    }
    if (request.url === "/auth/me") return { profile: { firstName: "Sam" }, ...me };
    if (request.url.includes("rating")) return { averageRating: 4.5, reviewCount: 2 };
    if (request.url.endsWith("/dashboard/overview")) return overviewFor(request.params);
    if (request.url === "/super-admin/dashboard/summary") return summary(request.params?.fromDate ? 42 : 500);
    if (request.url === "/super-admin/analytics/top-services") return { period: {}, services: [] };
    if (request.url === "/super-admin/finance/pending-payouts") {
      return { items: [{ businessId: "b1", businessName: "Spa", city: "Limassol", category: "Beauty", grossCents: 1, processingFeesCents: 0,
        refundsCents: 0, disputeAdjustmentsCents: 0, netCents: 1, transactionCount: 1, noShowAmountCents: 1, cancellationAmountCents: 0, depositAmountCents: 0 }],
      totalPendingCents: 1, businessCount: 1 };
    }
    if (request.url === "/super-admin/finance/transactions") return { transactions: [], pagination: { page: 1, limit: 20, total: 57 } };
    if (request.url === "/super-admin/finance/payouts") return { payouts: [], pagination: { page: 1, limit: 20, total: 31 } };
    throw new Error(`Unexpected request ${request.url}`);
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  useAuthStore.setState(previousAuth);
});

async function settle() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); }); }
async function waitFor(check: () => void) {
  for (let i = 0; i < 100; i++) {
    try { check(); return; } catch (error) { if (i === 99) throw error; }
    await settle();
  }
}
async function render(node: React.ReactNode) {
  await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
  await settle();
}
const button = (label: string | RegExp) => [...host.querySelectorAll("button")].find((b) =>
  typeof label === "string" ? b.textContent?.trim() === label : label.test(b.textContent ?? ""));
async function click(node: Element | null | undefined) {
  expect(node).toBeTruthy();
  await act(async () => node!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
async function setValue(node: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const proto = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
const overviewRequests = () => fx.requests.filter((r) => r.url.endsWith("/dashboard/overview")).map((r) => r.params);
const card = (label: string) =>
  [...host.querySelectorAll("span")].find((s) => s.textContent === label)?.closest(".rounded-xl")?.textContent ?? "";
const deferred = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
};

describe("G9 — Staff/Supervisor Overview ranges", () => {
  it("Staff sends Today, 7D, 30D and a validated inclusive Custom range to the authoritative API", async () => {
    auth("staff-1", "STAFF");
    await render(<StaffOverview />);
    await waitFor(() => expect(card("Bookings in range")).toContain("1"));
    await click(button("7D"));
    await waitFor(() => expect(card("Bookings in range")).toContain("7"));
    await click(button("30D"));
    await waitFor(() => expect(card("Bookings in range")).toContain("30"));

    await click(button("Custom"));
    const [start, end] = [...host.querySelectorAll<HTMLInputElement>('input[type="date"]')];
    await setValue(start, "2026-11-05");
    await setValue(end, "2026-11-01");
    await click(button("Apply"));
    expect(host.textContent).toContain("The start date must be on or before the end date.");
    await setValue(start, "2025-01-01");
    await setValue(end, "2026-11-01");
    await click(button("Apply"));
    expect(host.textContent).toContain("at most 366 days");
    await setValue(start, "2026-10-01");
    await click(button("Apply"));
    await waitFor(() => expect(card("Bookings in range")).toContain("99"));

    expect(overviewRequests()).toEqual([
      { range: "Today" }, { range: "7D" }, { range: "30D" },
      { range: "Custom", fromDate: "2026-10-01", toDate: "2026-11-01" },
    ]);
    expect(button(/^Custom \(/)?.getAttribute("aria-pressed")).toBe("true");
    expect(host.textContent).toContain("2026-10-01 – 2026-11-01 (Europe/Nicosia)");
  });

  it("a late earlier-range response never replaces the current range", async () => {
    auth("staff-1", "STAFF");
    await render(<StaffOverview />);
    await waitFor(() => expect(card("Bookings in range")).toContain("1"));
    const gate = deferred();
    gates.set("/businesses/biz-1/dashboard/overview 7D", gate.promise);
    await click(button("7D"));
    await click(button("30D"));
    await waitFor(() => expect(card("Bookings in range")).toContain("30"));
    gate.release();
    await settle();
    expect(card("Bookings in range")).toContain("30");
    expect(button("30D")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("a failed read shows Retry and never zero values; Retry recovers", async () => {
    auth("sup-1", "SUPERVISOR");
    failures.set("/businesses/biz-1/dashboard/overview", new BooklyApiError({ message: "Server error", status: 500 }));
    await render(<SupervisorOverview />);
    await waitFor(() => expect(host.textContent).toContain("The overview could not be loaded."));
    expect(card("Bookings in range")).toContain("—");
    expect(card("No-shows in range")).toContain("—");
    expect(host.textContent).not.toContain("No bookings scheduled in this range.");
    await click(button("Retry"));
    await waitFor(() => expect(card("No-shows in range")).toContain("1001"));
    expect(host.textContent).not.toContain("could not be loaded");
  });

  it("inactive employment (no Business context, or a 404) is shown as unavailable, not loading or zero", async () => {
    auth("staff-2", "STAFF");
    me = { business: null };
    await render(<StaffOverview />);
    await waitFor(() => expect(host.textContent).toContain("no active employment with this Business"));
    expect(overviewRequests()).toEqual([]);

    await act(async () => root.unmount());
    root = createRoot(host);
    client.clear();
    me = { business: { id: "biz-1" } };
    failures.set("/businesses/biz-1/dashboard/overview", new BooklyApiError({ message: "Not found", status: 404 }));
    await render(<SupervisorOverview />);
    await waitFor(() => expect(host.textContent).toContain("no active employment with this Business"));
    expect(host.textContent).not.toContain("Loading overview…");
  });

  it("an account switch never shows the previous identity's overview", async () => {
    auth("staff-1", "STAFF");
    await render(<StaffOverview />);
    await waitFor(() => expect(card("Bookings in range")).toContain("1"));
    const gate = deferred();
    gates.set("/businesses/biz-1/dashboard/overview", gate.promise);
    await act(async () => auth("staff-9", "STAFF"));
    await settle();
    expect(card("Bookings in range")).toContain("—");
    gate.release();
    await waitFor(() => expect(card("Bookings in range")).toContain("1"));
  });
});

describe("G5/G6 — Super Admin Overview", () => {
  beforeEach(() => auth("admin-1", "SUPER_ADMIN"));

  it("Year and period selections reach the summary and Top services; City and Day are disabled", async () => {
    await render(<SuperAdminDashboardContent />);
    await waitFor(() => expect(card("Total Bookings")).toContain("500"));
    const summaryRequests = () => fx.requests.filter((r) => r.url === "/super-admin/dashboard/summary");
    expect(summaryRequests()[0]?.params).toBeUndefined();

    const year = host.querySelector<HTMLSelectElement>('select[aria-label="Year"]')!;
    await setValue(year, "2026");
    await waitFor(() => expect(card("Total Bookings")).toContain("42"));
    const range = { fromDate: "2026-01-01T00:00:00.000Z", toDate: "2027-01-01T00:00:00.000Z" };
    expect(summaryRequests().at(-1)?.params).toEqual(range);
    expect(fx.requests.filter((r) => r.url === "/super-admin/analytics/top-services").at(-1)?.params).toEqual({ ...range, limit: "6" });
    expect(card("Total Bookings")).toContain("Created 1 Jan 2026 – 31 Dec 2026 (UTC)");
    expect(card("Total Customers")).toContain("Current");
    expect(card("Completed Payouts")).toContain("not affected by the period");
    expect(host.querySelector('[data-testid="overview-period-note"]')?.textContent).toContain("1 Jan 2026 – 31 Dec 2026 (UTC)");

    const city = host.querySelector<HTMLSelectElement>('select[aria-label="City (unavailable)"]')!;
    const day = host.querySelector<HTMLSelectElement>('select[aria-label="Day (unavailable)"]')!;
    expect(city.disabled && day.disabled).toBe(true);

    await click(button("All time"));
    await waitFor(() => expect(card("Total Bookings")).toContain("500"));
    expect(button("All time")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("resolves week/month/quarter periods to UTC calendar boundaries", () => {
    const now = new Date("2026-11-07T12:00:00Z"); // a Saturday
    expect(resolveOverviewPeriod({ kind: "CURRENT", unit: "WEEK" }, now)).toEqual({
      fromDate: "2026-11-02T00:00:00.000Z", toDate: "2026-11-09T00:00:00.000Z" });
    expect(resolveOverviewPeriod({ kind: "CURRENT", unit: "MONTH" }, now)).toEqual({
      fromDate: "2026-11-01T00:00:00.000Z", toDate: "2026-12-01T00:00:00.000Z" });
    expect(resolveOverviewPeriod({ kind: "CURRENT", unit: "QUARTER" }, now)).toEqual({
      fromDate: "2026-10-01T00:00:00.000Z", toDate: "2027-01-01T00:00:00.000Z" });
    expect(resolveOverviewPeriod({ kind: "ALL_TIME" }, now)).toBeUndefined();
  });

  it("a failed summary shows an error with Retry instead of an endless skeleton", async () => {
    failures.set("/super-admin/dashboard/summary", new BooklyApiError({ message: "Down", status: 503 }));
    await render(<SuperAdminDashboardContent />);
    await waitFor(() => expect(host.textContent).toContain("Platform statistics could not be loaded."));
    expect(host.querySelector('[aria-label="Loading platform statistics"]')).toBeNull();
    expect(host.textContent).not.toContain("€123.45");
    await click(button("Retry"));
    await waitFor(() => expect(card("Total Bookings")).toContain("500"));
    expect(host.textContent).not.toContain("could not be loaded");
  });
});

describe("G7 — Super Admin Finance CSV scope", () => {
  beforeEach(() => auth("admin-1", "SUPER_ADMIN"));

  it("Transaction log and payout history export every matching record via the server export", async () => {
    await render(<SuperAdminFinanceLog />);
    await waitFor(() => expect(button("Export all 57 (CSV)")).toBeTruthy());
    await click(button("Export all 57 (CSV)"));
    await waitFor(() => expect(fx.downloads).toHaveLength(1));
    const listParams = fx.requests.find((r) => r.url === "/super-admin/finance/transactions")!.params!;
    expect(fx.downloads[0]).toMatchObject({
      url: "/super-admin/finance/transactions/export.csv",
      params: { from: listParams.from, to: listParams.to, types: "NO_SHOW_FEE,CANCELLATION_FEE" },
    });
    expect(fx.downloads[0]!.params).not.toHaveProperty("page");

    await click(button("SEPA sent"));
    await waitFor(() => expect(button("Export all 31 (CSV)")).toBeTruthy());
    await click(button("Export all 31 (CSV)"));
    await waitFor(() => expect(fx.downloads).toHaveLength(2));
    expect(fx.downloads[1]).toMatchObject({ url: "/super-admin/finance/payouts/export.csv", params: {} });
  });

  it("Pending payouts export uses the complete server export", async () => {
    await render(<SuperAdminFinancePending />);
    await waitFor(() => expect(button("Export all 1 (CSV)")).toBeTruthy());
    await click(button("Export all 1 (CSV)"));
    await waitFor(() => expect(fx.downloads).toHaveLength(1));
    expect(fx.downloads[0]!.url).toBe("/super-admin/finance/pending-payouts/export.csv");
  });
});
