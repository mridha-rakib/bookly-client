import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PackageActionControls from "@/components/packages/PackageActionControls";
import PayoutsHistory from "@/components/payouts/PayoutsHistory";
import PayoutsBreakdown from "@/components/payouts/PayoutsBreakdown";
import DashboardPayoutsList from "@/components/dashboard/DashboardPayoutsList";
import { packagesApi } from "@/lib/api/packages";

const fx = vi.hoisted(() => ({ role: "CUSTOMER", query: { isLoading: false, isError: false, isFetching: false, data: undefined as unknown, refetch: vi.fn() } }));
vi.mock("@/lib/auth/store", () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: { role: fx.role } }) }));
vi.mock("@/lib/packages/hooks", () => ({ usePackageDetailQuery: () => fx.query, useBusinessPackageDetailQuery: () => fx.query }));
vi.mock("@/lib/finance/hooks", () => ({ usePayoutHistoryQuery: () => fx.query, useFinanceTransactionsQuery: () => fx.query, useFinanceSummaryQuery: () => fx.query }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));

describe("financial read retry controls", () => {
  let host: HTMLDivElement;
  let root: Root;
  let cache: QueryClient;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    fx.role = "CUSTOMER";
    Object.assign(fx.query, { isLoading: false, isError: false, isFetching: false, data: undefined });
    fx.query.refetch.mockReset();
    cache = new QueryClient();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); cache.clear(); vi.unstubAllGlobals(); });
  const render = (node: React.ReactElement) => act(() => root.render(<QueryClientProvider client={cache}>{React.cloneElement(node)}</QueryClientProvider>));

  it("shows package loading, retries errors and renders recovered actions", () => {
    const component = <PackageActionControls businessId="business" packageId="package" />;
    render(component);
    expect(host.textContent).toContain("Loading package actions");
    fx.query.isError = true;
    render(component);
    expect(host.textContent).toContain("Package actions could not be loaded");
    act(() => host.querySelector("button")!.click());
    expect(fx.query.refetch).toHaveBeenCalledTimes(1);
    fx.query.isFetching = true;
    render(component);
    expect(host.querySelector("button")?.disabled).toBe(true);
    expect(host.textContent).toContain("Retrying");
    Object.assign(fx.query, { isError: false, isFetching: false, data: { status: "ACTIVE", sessions: [] } });
    render(component);
    expect(host.textContent).toContain("Cancel entire package");
  });

  it("does not expose package controls to unauthorized roles", () => {
    fx.role = "STAFF";
    render(<PackageActionControls businessId="business" packageId="package" />);
    expect(host.textContent).toBe("");
  });
  it("sends only one package cancellation on rapid confirmation", async () => {
    fx.query.data = { status: "ACTIVE", sessions: [] };
    const request = vi.spyOn(packagesApi, "cancelFuture").mockImplementation(() => new Promise(() => {}));
    try {
      render(<PackageActionControls businessId="business" packageId="package" />);
      act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Cancel future scheduled appointments")!.click());
      const confirm = [...host.querySelectorAll("button")].find(button => button.textContent === "Confirm cancellation")!;
      await act(async () => { confirm.click(); confirm.click(); });
      expect(request).toHaveBeenCalledOnce();
    } finally { request.mockRestore(); }
  });

  it.each([
    ["history", <PayoutsHistory key="history" businessId="business" />, { payouts: [], pagination: { total: 0 } }, "No payouts yet"],
    ["breakdown", <PayoutsBreakdown key="breakdown" businessId="business" period={undefined} periodLabel="Month" />, { transactions: [], pagination: { total: 0 } }, "No no-show or late-cancellation fees"],
  ])("retries %s reads and displays recovered data", (_name, component, data, success) => {
    fx.query.isError = true;
    render(component);
    const button = Array.from(host.querySelectorAll("button")).find((item) => item.textContent === "Retry")!;
    act(() => button.click());
    expect(fx.query.refetch).toHaveBeenCalledTimes(1);
    fx.query.isFetching = true;
    render(component);
    const pending = Array.from(host.querySelectorAll("button")).find((item) => item.textContent === "Retrying...");
    expect(pending?.disabled).toBe(true);
    Object.assign(fx.query, { isError: false, isFetching: false, data });
    render(component);
    expect(host.textContent).toContain(success);
  });
  it("does not present unsuccessful fee attempts or pending payouts as paid", () => {
    fx.query.data = { transactions: ["PENDING", "FAILED", "WAIVED", "SUCCEEDED"].map((status, index) => ({ id: `${index}`, customerName: "Customer", date: "2026-01-01T00:10:00Z", type: "NO_SHOW_FEE", customerType: "RETURNING", amountCents: 1000, businessOwnedCents: status === "SUCCEEDED" ? 1000 : 0, status })), pagination: { total: 4 } };
    render(<PayoutsBreakdown businessId="business" period={{ from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" }} periodLabel="January" />);
    expect(host.textContent).toContain("FEE AMOUNT"); expect(host.textContent).not.toContain("FEE CHARGED");
    expect(host.textContent).toContain("Charge in progress"); expect(host.textContent).toContain("Charge failed — not collected"); expect(host.textContent).toContain("Waived — not collected");
    fx.query.data = { payouts: [{ id: "p", periodStart: "2026-01-01T00:00:00Z", grossBusinessOwnedCents: 1000, processingFeesCents: 0, netPayoutCents: 1000, status: "PENDING" }], pagination: { total: 1 } };
    render(<PayoutsHistory businessId="business" />);
    expect(host.textContent).toContain("including pending payouts"); expect(host.textContent).toContain("Pending");
  });
  it("retries the finance summary", () => {
    fx.query.isError = true;
    render(<DashboardPayoutsList businessId="business" />);
    const retry = [...host.querySelectorAll("button")].find(button => button.textContent === "Retry summary")!;
    act(() => retry.click()); expect(fx.query.refetch).toHaveBeenCalledOnce();
  });
});
