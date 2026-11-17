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
import SuperAdminAnalytics from "@/components/super-admin/analytics/SuperAdminAnalytics";
import SuperAdminFinance from "@/components/super-admin/finance/SuperAdminFinance";
import { platformLastMonth, platformMonthToDate, platformRecentDays, platformToday, resolveOverviewPeriod } from "@/lib/superAdminDashboard/period";

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
// P2.2.1 — capture the period the Analytics tab hands to its (server-backed) views.
vi.mock("@/components/super-admin/analytics/SuperAdminAnalyticsOverview", () => ({
  default: ({ period }: { period: Record<string, string> }) => <pre data-testid="analytics-period">{JSON.stringify(period)}</pre>,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root, client: QueryClient;
let gates: Map<string, Promise<void>>;
let failures: Map<string, unknown>;
let me: { business?: { id: string } | null };
let citiesFail = false;
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
    noShowCount: count + 1000,
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
    if (request.url === "/super-admin/analytics/reporting-cities") {
      if (citiesFail) {
        citiesFail = false;
        throw new BooklyApiError({ message: "Down", status: 503 });
      }
      return { cities: ["Limassol", "Nicosia"] };
    }
    if (request.url === "/super-admin/finance/pending-payouts") {
      return { items: [{ businessId: "b1", businessName: "Spa", city: "Limassol", category: "Beauty", grossCents: 1, processingFeesCents: 0,
        refundsCents: 0, disputeAdjustmentsCents: 0, netCents: 1, transactionCount: 1, noShowAmountCents: 1, cancellationAmountCents: 0, depositAmountCents: 0 }],
      totalPendingCents: 1, businessCount: 1 };
    }
    if (request.url === "/super-admin/finance/transactions") return { transactions: [], pagination: { page: 1, limit: 20, total: 57 } };
    if (request.url === "/super-admin/finance/payouts") return { payouts: [], pagination: { page: 1, limit: 20, total: 31 } };
    if (request.url === "/super-admin/finance/summary") {
      return { currency: "EUR", period: { from: "", to: "", timezone: "Europe/Nicosia" }, bookly: { grossCents: 0, processingFeesCents: 0, refundsCents: 0, disputeAdjustmentsCents: 0, netCents: 1200 },
        collectedForBusinesses: { amountCents: 300, noShowAmountCents: 200, cancellationAmountCents: 100 },
        sentToBusinesses: { amountCents: 4850, payoutCount: 1 }, pendingPayouts: { amountCents: 700, businessCount: 1 }, protectedEarningsAllTimeCents: 9000 };
    }
    if (request.url === "/super-admin/finance/promo-discounts") return { totalCents: 0, count: 0, period: { from: "", to: "" } };
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
    await render(<SupervisorOverview onNavigate={vi.fn()} />);
    await waitFor(() => expect(host.textContent).toContain("The overview could not be loaded."));
    expect(card("Bookings in range")).toContain("—");
    expect(card("No-shows in range")).toContain("—");
    expect(host.textContent).not.toContain("No bookings scheduled in this range.");
    await click(button("Retry"));
    await waitFor(() => expect(card("No-shows in range")).toContain("1001"));
    expect(host.textContent).not.toContain("could not be loaded");
  });

  it("Supervisor overview opens the calendar", async () => {
    auth("sup-1", "SUPERVISOR");
    const navigate = vi.fn();
    await render(<SupervisorOverview onNavigate={navigate} />);
    await click(button("View full calendar"));
    expect(navigate).toHaveBeenCalledWith("Calendar");
  });

  it("Supervisor overview displays operational no-show counts without ledger activity or charged totals", async () => {
    auth("sup-1", "SUPERVISOR");
    await render(<SupervisorOverview onNavigate={vi.fn()} />);
    await waitFor(() => expect(card("No-shows in range")).toContain("1001"));
    expect(host.textContent).not.toContain("Recent activity in range");
    expect(card("No-shows in range")).not.toContain("charged");
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
    await render(<SupervisorOverview onNavigate={vi.fn()} />);
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

  it("Year and period selections reach the summary and Top services; City and Day are live", async () => {
    await render(<SuperAdminDashboardContent />);
    await waitFor(() => expect(card("Total Bookings")).toContain("500"));
    const summaryRequests = () => fx.requests.filter((r) => r.url === "/super-admin/dashboard/summary");
    expect(summaryRequests()[0]?.params).toEqual({}); // no period, city or day

    const year = host.querySelector<HTMLSelectElement>('select[aria-label="Year"]')!;
    await setValue(year, "2026");
    await waitFor(() => expect(card("Total Bookings")).toContain("42"));
    // P2.2.1 — inclusive Cyprus calendar dates; the API applies Europe/Nicosia boundaries.
    const range = { fromDate: "2026-01-01", toDate: "2026-12-31" };
    expect(summaryRequests().at(-1)?.params).toEqual(range);
    expect(fx.requests.filter((r) => r.url === "/super-admin/analytics/top-services").at(-1)?.params).toEqual({ ...range, limit: "6" });
    expect(card("Total Bookings")).toContain("Created 1 Jan 2026 – 31 Dec 2026 (Cyprus time)");
    expect(card("Total Customers")).toContain("Current");
    expect(card("Completed Payouts")).toContain("not affected by period, city or day");
    expect(host.querySelector('[data-testid="overview-period-note"]')?.textContent).toContain("1 Jan 2026 – 31 Dec 2026 (Cyprus time)");

    // P2.2.4 — City and Day are live server filters now.
    expect(host.querySelector('select[aria-label="City (unavailable)"]')).toBeNull();
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="Day"]')?.disabled).toBe(false);

    await click(button("All time"));
    await waitFor(() => expect(card("Total Bookings")).toContain("500"));
    expect(button("All time")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("resolves week/month/quarter/year to Cyprus calendar dates (Europe/Nicosia)", () => {
    const now = new Date("2026-11-07T12:00:00Z"); // Saturday in Cyprus
    expect(resolveOverviewPeriod({ kind: "CURRENT", unit: "WEEK" }, now)).toEqual({ fromDate: "2026-11-02", toDate: "2026-11-08" });
    expect(resolveOverviewPeriod({ kind: "CURRENT", unit: "MONTH" }, now)).toEqual({ fromDate: "2026-11-01", toDate: "2026-11-30" });
    expect(resolveOverviewPeriod({ kind: "CURRENT", unit: "QUARTER" }, now)).toEqual({ fromDate: "2026-10-01", toDate: "2026-12-31" });
    expect(resolveOverviewPeriod({ kind: "YEAR", year: 2024 }, now)).toEqual({ fromDate: "2024-01-01", toDate: "2024-12-31" });
    expect(resolveOverviewPeriod({ kind: "ALL_TIME" }, now)).toBeUndefined();
  });

  it("uses the Cyprus date, not UTC or the browser's, around midnight and DST", () => {
    // 22:30 UTC on Sunday 1 Nov = 00:30 Monday 2 Nov in Cyprus (winter, UTC+2): a new week and day.
    const winterMidnight = new Date("2026-11-01T22:30:00Z");
    expect(platformToday(winterMidnight)).toEqual({ year: 2026, month: 11, day: 2 });
    expect(resolveOverviewPeriod({ kind: "CURRENT", unit: "WEEK" }, winterMidnight)).toEqual({ fromDate: "2026-11-02", toDate: "2026-11-08" });
    // 21:30 UTC on 31 July = 00:30 on 1 August in Cyprus (summer, UTC+3): a new month.
    const summerMidnight = new Date("2026-07-31T21:30:00Z");
    expect(resolveOverviewPeriod({ kind: "CURRENT", unit: "MONTH" }, summerMidnight)).toEqual({ fromDate: "2026-08-01", toDate: "2026-08-31" });
    // 22:30 UTC on 31 Dec 2026 is already 2027 in Cyprus: new year and quarter.
    const newYear = new Date("2026-12-31T22:30:00Z");
    expect(platformToday(newYear).year).toBe(2027);
    expect(resolveOverviewPeriod({ kind: "CURRENT", unit: "QUARTER" }, newYear)).toEqual({ fromDate: "2027-01-01", toDate: "2027-03-31" });
    // Across the spring transition (29 March 2026) the calendar dates are unaffected.
    expect(platformToday(new Date("2026-03-29T00:30:00Z"))).toEqual({ year: 2026, month: 3, day: 29 });
    expect(platformLastMonth(new Date("2026-03-31T21:30:00Z"))).toEqual({ fromDate: "2026-03-01", toDate: "2026-03-31" });
    expect(platformMonthToDate(new Date("2026-03-29T12:00:00Z"))).toEqual({ fromDate: "2026-03-01", toDate: "2026-03-29" });
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

describe("E17 — Analytics tab period parameters", () => {
  beforeEach(() => auth("admin-1", "SUPER_ADMIN"));

  it("sends inclusive Cyprus calendar dates (no browser/UTC instants) for presets and custom ranges", async () => {
    const analyticsPeriod = () => JSON.parse(host.querySelector('[data-testid="analytics-period"]')?.textContent ?? "null");
    await render(<SuperAdminAnalytics />);
    expect(analyticsPeriod()).toEqual({});
    expect(host.textContent).toContain("Cyprus time (Europe/Nicosia)");

    await click(button("Last Month"));
    expect(analyticsPeriod()).toEqual(platformLastMonth());
    await click(button("This Month"));
    expect(analyticsPeriod()).toEqual(platformMonthToDate());

    const [from, to] = [...host.querySelectorAll<HTMLInputElement>('input[type="date"]')];
    await setValue(from!, "2026-03-29");
    await setValue(to!, "2026-10-25");
    await click(button("Apply"));
    expect(analyticsPeriod()).toEqual({ fromDate: "2026-03-29", toDate: "2026-10-25" });
    await click(button("All time"));
    expect(analyticsPeriod()).toEqual({});
  });
});

describe("E17 — Super Admin Finance in Cyprus time (P2.2.2)", () => {
  beforeEach(() => auth("admin-1", "SUPER_ADMIN"));
  const last = (url: string) => fx.requests.filter((r) => r.url === url).at(-1)?.params;

  it("Finance cards and the Transaction log request inclusive Cyprus dates; the default is labelled Last 90 days", async () => {
    await render(<SuperAdminFinance />);
    await waitFor(() => expect(last("/super-admin/finance/transactions")).toBeTruthy());
    const recent = platformRecentDays(90);
    expect(last("/super-admin/finance/summary")).toEqual({ from: recent.fromDate, to: recent.toDate });
    expect(last("/super-admin/finance/promo-discounts")).toEqual({ from: recent.fromDate, to: recent.toDate });
    expect(last("/super-admin/finance/transactions")).toMatchObject({ from: recent.fromDate, to: recent.toDate, page: "1", limit: "20" });
    expect(button("All time")).toBeUndefined();
    expect(button("Last 90 days")).toBeTruthy();
    expect(host.querySelector('[data-testid="finance-period-note"]')?.textContent).toContain("(Cyprus time)");
    expect(host.querySelector('[data-testid="finance-period-note"]')?.textContent).toContain("Recorded as paid to businesses is all");

    await click(button("Last Month"));
    await waitFor(() => expect(last("/super-admin/finance/summary")).toEqual({ from: platformLastMonth().fromDate, to: platformLastMonth().toDate }));
  });

  it("validates ranges before requesting, resets the log page, and exports the same Cyprus range", async () => {
    await render(<SuperAdminFinance />);
    await waitFor(() => expect(last("/super-admin/finance/transactions")).toBeTruthy());
    const dates = [...host.querySelectorAll<HTMLInputElement>('input[type="date"]')];
    // [0..1] = Finance card range, [2..3] = Transaction log range.
    const summaryCalls = fx.requests.filter((r) => r.url === "/super-admin/finance/summary").length;
    await setValue(dates[0]!, "2026-01-01");
    await setValue(dates[1]!, "2026-06-30");
    await click(button("Apply"));
    expect(host.textContent).toContain("Choose a range of at most 92 days.");
    expect(fx.requests.filter((r) => r.url === "/super-admin/finance/summary")).toHaveLength(summaryCalls);

    await setValue(dates[2]!, "2026-10-31");
    await setValue(dates[3]!, "2026-10-01");
    const applyButtons = [...host.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "Apply");
    await click(applyButtons[1]);
    expect(host.textContent).toContain("The start date must be on or before the end date.");

    await setValue(dates[2]!, "2026-10-01");
    await setValue(dates[3]!, "2026-10-31");
    await click(applyButtons[1]);
    await waitFor(() => expect(last("/super-admin/finance/transactions")).toMatchObject({ from: "2026-10-01", to: "2026-10-31", page: "1" }));
    expect(host.querySelector('[data-testid="finance-log-period"]')?.textContent).toContain("1 Oct 2026 – 31 Oct 2026 (Cyprus time)");

    await waitFor(() => expect(button("Export all 57 (CSV)")).toBeTruthy());
    await click(button("Export all 57 (CSV)"));
    await waitFor(() => expect(fx.downloads).toHaveLength(1));
    expect(fx.downloads[0]!.params).toEqual({ from: "2026-10-01", to: "2026-10-31", types: "NO_SHOW_FEE,CANCELLATION_FEE" });
  });
});

describe("P2.2.4 — Super Admin City and Day", () => {
  beforeEach(() => auth("admin-1", "SUPER_ADMIN"));
  const lastParams = (url: string) => fx.requests.filter((r) => r.url === url).at(-1)?.params;

  it("Overview City/Day selections reach the summary and Top services with Year; cards state their scope", async () => {
    await render(<SuperAdminDashboardContent />);
    await waitFor(() => expect(host.querySelectorAll('select[aria-label="City"] option')).toHaveLength(3));
    expect([...host.querySelectorAll<HTMLOptionElement>('select[aria-label="City"] option')].map((o) => o.textContent)).toEqual(["All cities", "Limassol", "Nicosia"]);
    await setValue(host.querySelector<HTMLSelectElement>('select[aria-label="Year"]')!, "2026");
    await setValue(host.querySelector<HTMLSelectElement>('select[aria-label="City"]')!, "Nicosia");
    await setValue(host.querySelector<HTMLSelectElement>('select[aria-label="Day"]')!, "MONDAY");
    const expected = { fromDate: "2026-01-01", toDate: "2026-12-31", city: "Nicosia", day: "MONDAY" };
    await waitFor(() => expect(lastParams("/super-admin/dashboard/summary")).toEqual(expected));
    expect(lastParams("/super-admin/analytics/top-services")).toEqual({ ...expected, limit: "6" });
    await waitFor(() => expect(card("Total Bookings")).toContain("Nicosia · Mondays"));
    expect(card("Total Customers")).toContain("not filtered by city or day");
    expect(card("Total Businesses")).toContain("Current · Nicosia");
    expect(card("Completed Payouts")).toContain("not affected by period, city or day");
    expect(host.querySelector('[data-testid="overview-period-note"]')?.textContent).toContain("Nicosia · Mondays (Cyprus time)");

    await setValue(host.querySelector<HTMLSelectElement>('select[aria-label="City"]')!, "");
    await setValue(host.querySelector<HTMLSelectElement>('select[aria-label="Day"]')!, "");
    await waitFor(() => expect(lastParams("/super-admin/dashboard/summary")).toEqual({ fromDate: "2026-01-01", toDate: "2026-12-31" }));
  });

  it("Analytics sends the same City/Day contract to every period-bound view and labels customers platform-wide", async () => {
    await render(<SuperAdminAnalytics />);
    await waitFor(() => expect(host.querySelectorAll('select[aria-label="City"] option')).toHaveLength(3));
    await setValue(host.querySelector<HTMLSelectElement>('select[aria-label="City"]')!, "Limassol");
    await setValue(host.querySelector<HTMLSelectElement>('select[aria-label="Day"]')!, "FRIDAY");
    await waitFor(() => expect(JSON.parse(host.querySelector('[data-testid="analytics-period"]')?.textContent ?? "{}")).toEqual({ city: "Limassol", day: "FRIDAY" }));
    expect(host.querySelector('[data-testid="analytics-scope-note"]')?.textContent).toContain("customer metrics are platform-wide");
  });

  it("a failed City list offers Retry and never sends an unvalidated city", async () => {
    citiesFail = true;
    await render(<SuperAdminDashboardContent />);
    await waitFor(() => expect(button("Retry cities")).toBeTruthy());
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="City"]')?.disabled).toBe(true);
    await click(button("Retry cities"));
    await waitFor(() => expect(host.querySelectorAll('select[aria-label="City"] option')).toHaveLength(3));
    expect(fx.requests.filter((r) => r.url === "/super-admin/dashboard/summary").every((r) => !r.params?.city)).toBe(true);
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

    await click(button("Payout records"));
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
