import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import Cities from "@/components/super-admin/analytics/SuperAdminCitiesAnalytics";
import { useSuperAdminCityCoverageQuery } from "@/lib/superAdminAnalytics/hooks";
vi.mock("@/lib/superAdminAnalytics/hooks", () => ({ useSuperAdminCityCoverageQuery: vi.fn() }));
vi.mock("@/components/super-admin/bookings/SuperAdminBookingsAnalytics", () => ({
  default: ({ period }: { period: unknown }) => <pre data-testid="booking-period">{JSON.stringify(period)}</pre>,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = document.createElement("div");
let root = createRoot(host);
afterEach(async () => { await act(async () => root.unmount()); root = createRoot(host); vi.clearAllMocks(); });
const coverage = {
  data: { cities: [
    { city: "Nicosia", premisesCount: 2, mobileCount: 1, approvedCount: 2 },
    { city: "Limassol", premisesCount: 4, mobileCount: 0, approvedCount: 3 },
    { city: "", premisesCount: 1, mobileCount: 0, approvedCount: 0 },
  ] }, isLoading: false, isError: false, refetch: vi.fn(),
};
it("filters current coverage by city and forwards identical city/day/date filters to the existing booking report", async () => {
  vi.mocked(useSuperAdminCityCoverageQuery).mockReturnValue(coverage as never);
  const period = { city: "Nicosia", day: "SUNDAY" as const, fromDate: "2026-08-01", toDate: "2026-10-31" };
  await act(async () => root.render(<Cities period={period} />));
  expect(host.textContent).toContain("Nicosia");
  expect(host.textContent).not.toContain("Limassol");
  expect(host.textContent).toContain("2 premises");
  expect(host.querySelector('[data-testid="booking-period"]')?.textContent).toBe(JSON.stringify(period));
  expect(host.textContent).toContain("current state");
});
it("shows unassigned coverage and a clear filtered empty state", async () => {
  vi.mocked(useSuperAdminCityCoverageQuery).mockReturnValue(coverage as never);
  await act(async () => root.render(<Cities />));
  expect(host.textContent).toContain("Unassigned");
  await act(async () => root.render(<Cities period={{ city: "Paphos" }} />));
  expect(host.textContent).toContain("No businesses for this city");
});
it("shows loading and retryable coverage errors without fabricated totals", async () => {
  vi.mocked(useSuperAdminCityCoverageQuery).mockReturnValue({ isLoading: true } as never);
  await act(async () => root.render(<Cities />));
  expect(host.textContent).toContain("Loading");
  vi.mocked(useSuperAdminCityCoverageQuery).mockReturnValue({ ...coverage, isError: true } as never);
  await act(async () => root.render(<Cities />));
  expect(host.textContent).toContain("Failed to load city coverage");
  await act(async () => host.querySelector("button")!.click());
  expect(coverage.refetch).toHaveBeenCalledTimes(1);
});
