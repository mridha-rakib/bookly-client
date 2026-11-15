import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import SuperAdminBusinessDetail from "@/components/super-admin/businesses/business-detail/SuperAdminBusinessDetail";

const state = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/superAdminBusiness", () => ({ superAdminBusinessApi: { getById: state.get } }));
vi.mock("@/lib/superAdminFinance/hooks", () => ({ useSuperAdminBusinessSummaryQuery: () => ({}) }));
vi.mock("@/components/super-admin/businesses/business-detail/BusinessOverviewTab", () => ({ default: () => null }));
vi.mock("@/components/super-admin/businesses/business-detail/BusinessBookingsTab", () => ({ default: () => null }));
vi.mock("@/components/super-admin/businesses/business-detail/BusinessFinanceTab", () => ({ default: () => null }));
vi.mock("@/components/super-admin/businesses/business-detail/BusinessIssuesTab", () => ({ default: () => null }));
vi.mock("@/components/super-admin/businesses/business-detail/BusinessAnalyticsTab", () => ({ default: () => null }));

it("switches Business details without showing the prior entity while the next read loads", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const business = (name: string) => ({ name, status: "APPROVED", address: { city: "Larnaca" }, owner: { lastLoginAt: null }, createdAt: "2030-01-01T00:00:00Z", reviewsCount: 0, rating: null, bookingMode: null });
  let resolveB: (value: unknown) => void = () => {};
  state.get.mockImplementation((id: string) => id === "a" ? Promise.resolve(business("Business Alpha")) : new Promise(resolve => { resolveB = resolve; }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement("div"), root = createRoot(host);
  const render = async (id: string) => { await act(async () => root.render(<QueryClientProvider client={client}><SuperAdminBusinessDetail businessId={id} onBack={() => {}} onSuspend={() => {}} /></QueryClientProvider>)); };
  const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); };
  try {
    await render("a"); await settle(); expect(host.textContent).toContain("Business Alpha");
    await render("b"); await settle(); expect(host.textContent).not.toContain("Business Alpha"); expect(host.textContent).toContain("Loading");
    await act(async () => resolveB(business("Business Beta"))); await settle();
    expect(host.textContent).toContain("Business Beta"); expect(host.textContent).not.toContain("Business Alpha");
  } finally { await act(async () => root.unmount()); client.clear(); vi.unstubAllGlobals(); vi.clearAllMocks(); }
});
