import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import DashboardOverview from "@/components/dashboard/DashboardOverview";

const fx = vi.hoisted(() => ({ retry: vi.fn() }));
vi.mock("@/lib/business/hooks", () => ({ useMyBusinessProfileQuery: () => ({ data: { primary: { id: "business" } } }) }));
vi.mock("@/lib/review/hooks", () => ({ useBusinessRatingSummaryQuery: () => ({ isError: true, isLoading: false, isFetching: false, refetch: fx.retry }) }));
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: () => ({ data: {} }) }));
vi.mock("@/lib/dashboardOverview/hooks", () => ({ useDashboardOverviewQuery: () => ({}) }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("opens the calendar and offers a retry instead of claiming failed reviews are empty", async () => {
  const navigate = vi.fn();
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<DashboardOverview onViewCalendar={navigate} />));
    expect(host.textContent).toContain("Reviews unavailable");
    expect(host.textContent).not.toContain("No reviews yet");
    await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("View full calendar"))!.click());
    expect(navigate).toHaveBeenCalledOnce();
    await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Retry reviews")!.click());
    expect(fx.retry).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); }
});
