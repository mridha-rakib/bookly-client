import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import StaffOverview from "@/components/dashboard/StaffOverview";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: () => ({ data: { business: { id: "business" } }, isPending: false }) }));
vi.mock("@/lib/review/hooks", () => ({ useBusinessRatingSummaryQuery: () => ({ data: { averageRating: null, reviewCount: 0 } }) }));
vi.mock("@/lib/dashboardOverview/hooks", () => ({ useDashboardOverviewQuery: () => ({ data: {
  scope: "STAFF_SCOPED", todayBookingsCount: 1, todayRemainingCount: 1, financials: null,
  schedule: [{ bookingId: "one", time: "10:00", customerName: "Customer", serviceName: "My service", packageSessions: [] }],
  timeline: [],
} }) }));

it("shows operational details without financial columns and navigates to the staff calendar", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  const navigate = vi.fn();
  try {
    act(() => root.render(<StaffOverview onNavigate={navigate} />));
    expect(host.textContent).toContain("My service");
    expect(host.textContent).not.toMatch(/Total Payment|Platform fee|Remaining fee/);
    const calendar = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("View full calendar"));
    expect(calendar).toBeDefined();
    act(() => calendar?.click());
    expect(navigate).toHaveBeenCalledWith("Calendar");
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
