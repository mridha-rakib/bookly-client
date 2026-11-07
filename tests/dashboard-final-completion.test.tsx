import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import DashboardAnalytics from "@/components/dashboard/DashboardAnalytics";
import DashboardReviewsList from "@/components/dashboard/DashboardReviewsList";
import DashboardPayoutsList from "@/components/dashboard/DashboardPayoutsList";
import { invalidateBusinessBookingViews, invalidateStaffSchedulingViews } from "@/lib/bookings/dashboard-cache";

const fx = vi.hoisted(() => ({ failed: true, retry: vi.fn(), overview: vi.fn(), transactions: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/business/hooks", () => ({ useMyBusinessProfileQuery: () => ({ data: { primary: { id: "business" } }, refetch: fx.retry }), useManagedBusinessContext: () => ({ businessId: "business", isLoading: false }) }));
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: () => ({ data: {} }) }));
vi.mock("@/lib/dashboardOverview/hooks", () => ({ useDashboardOverviewQuery: (id: string, range: object) => { fx.overview(id, range); return { isError: false, isLoading: false }; } }));
vi.mock("@/lib/dashboardAnalytics/hooks", () => ({ useDashboardAnalyticsQuery: () => ({ isError: fx.failed, isLoading: false, refetch: fx.retry }) }));
vi.mock("@/lib/review/hooks", () => ({
  useBusinessRatingSummaryQuery: () => ({}),
  useBusinessRatingSummaryForDashboardQuery: () => ({ isError: fx.failed, refetch: fx.retry }),
  useBusinessReviewsForDashboardQuery: () => ({ isError: fx.failed, data: fx.failed ? undefined : { reviews: [], pagination: { total: 0 } }, refetch: fx.retry }),
}));
vi.mock("@/lib/finance/hooks", () => ({
  useFinanceSummaryQuery: () => ({}),
  useFinanceTransactionsQuery: (id: string, period: object, pagination: object) => { fx.transactions(id, period, pagination); return { data: { transactions: [], pagination: { total: 100 } } }; },
  usePayoutHistoryQuery: () => ({ data: { payouts: [], pagination: { total: 0 } } }),
}));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  fx.failed = true; fx.retry.mockClear(); fx.overview.mockClear(); fx.transactions.mockClear();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const button = (name: string) => Array.from(host.querySelectorAll("button")).find(value => value.textContent?.trim() === name)!;
it("Overview range controls change the authoritative query without client-side fake totals", async () => {
  await act(async () => root.render(createElement(DashboardOverview)));
  expect(fx.overview).toHaveBeenLastCalledWith("business", { range: "Today" });
  await act(async () => button("7D").click());
  expect(fx.overview).toHaveBeenLastCalledWith("business", { range: "7D" });
  await act(async () => button("30D").click());
  expect(fx.overview).toHaveBeenLastCalledWith("business", { range: "30D" });
});
it("Analytics failure is retryable and successful retry clears the stale error", async () => {
  await act(async () => root.render(createElement(DashboardAnalytics)));
  expect(host.textContent).toContain("Could not load analytics"); expect(host.textContent).not.toContain("Loading analytics");
  await act(async () => button("Retry").click()); expect(fx.retry).toHaveBeenCalled();
  fx.failed = false;
  await act(async () => root.render(createElement(DashboardAnalytics)));
  expect(host.querySelector('[role="alert"]')).toBeNull();
});
it("Reviews distinguishes failure from genuine empty results and retries existing queries", async () => {
  await act(async () => root.render(createElement(DashboardReviewsList)));
  expect(host.textContent).toContain("Could not load reviews"); expect(host.textContent).not.toContain("No reviews yet");
  await act(async () => button("Retry").click()); expect(fx.retry).toHaveBeenCalledTimes(2);
  fx.failed = false; await act(async () => root.render(createElement(DashboardReviewsList)));
  expect(host.textContent).toContain("No reviews yet"); expect(host.querySelector('[role="alert"]')).toBeNull();
});
it("Finance resets page to one when the selected month changes", async () => {
  await act(async () => root.render(createElement(DashboardPayoutsList, { businessId: "business" })));
  await act(async () => button("Next").click());
  expect(fx.transactions).toHaveBeenLastCalledWith("business", expect.anything(), expect.objectContaining({ page: 2 }));
  const month = host.querySelectorAll("select")[1]!;
  await act(async () => { month.value = month.value === "January" ? "February" : "January"; month.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(fx.transactions).toHaveBeenLastCalledWith("business", expect.anything(), expect.objectContaining({ page: 1 }));
});
it("Booking and Staff invalidation target the affected Business and customer availability", async () => {
  const client = new QueryClient(), invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
  await invalidateBusinessBookingViews(client, "business-a");
  for (const queryKey of [["dashboardOverview", "business-a"], ["dashboardAnalytics", "business-a"], ["finance", "summary", "business-a"], ["bookings", "calendar", "business-a"], ["catalog", "availability", "business-a"]]) expect(invalidate).toHaveBeenCalledWith({ queryKey });
  invalidate.mockClear(); await invalidateStaffSchedulingViews(client, "business-a");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["staff", "my-schedule", "business-a"] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["catalog", "availability", "business-a"] });
  for (const call of invalidate.mock.calls) expect(call[0]?.queryKey).not.toEqual([]);
});
