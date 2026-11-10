import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import DashboardBookingsList from "@/components/dashboard/DashboardBookingsList";
import { BOOKING_STATUS_LABELS, BUSINESS_BOOKING_STATUS_LABELS } from "@/lib/bookings/format";
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/staff/hooks", () => ({ useStaffListQuery: () => ({ data: { members: [] } }) }));
vi.mock("@/lib/bookings/hooks", () => ({ useBusinessBookingsQuery: () => ({ data: {
  bookings: [{ id: "fixture", reference: "BK-FIXTURE", status: "CANCELLED_BY_CUSTOMER", customerName: "Test customer", serviceNames: ["Service"], staffNames: ["Professional"], schedule: { startAt: "2026-11-13T13:00:00Z", endAt: "2026-11-13T14:00:00Z", timezone: "Europe/Nicosia" }, totalCents: 1000, currency: "EUR", packageSessions: [] }],
  pagination: { page: 1, limit: 20, total: 1 },
} }) }));
it("business rows and filters identify customer cancellation without changing Customer wording or statuses", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div"); const root = createRoot(host);
  try {
    await act(async () => root.render(<DashboardBookingsList activeTab="All Bookings" businessId="business" />));
    expect(host.querySelector("tbody")?.textContent).toContain("Cancelled by customer");
    expect(host.textContent).not.toContain("Cancelled by you");
    expect(BOOKING_STATUS_LABELS.CANCELLED_BY_CUSTOMER).toBe("Cancelled by you");
    expect(BUSINESS_BOOKING_STATUS_LABELS.CANCELLED_BY_BUSINESS).toBe("Cancelled by business");
  } finally { await act(async () => root.unmount()); }
});
