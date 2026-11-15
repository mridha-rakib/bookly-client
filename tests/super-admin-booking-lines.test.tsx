import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import SuperAdminBookingDrawer from "@/components/super-admin/bookings/SuperAdminBookingDrawer";

vi.mock("@/lib/superAdminBookings/hooks", () => ({ useSuperAdminBookingDetailQuery: () => ({ data: {
  reference: "BK-TEST", status: "UPCOMING", customer: { firstName: "Jane", phone: { e164: "+35799000000" } },
  serviceLines: [
    { serviceId: "a", name: "Hair", staffName: "Alex", addons: [{ name: "Conditioner" }], packageProgressId: "p", sessionIndex: 1, sessionsInPackage: 3 },
    { serviceId: "b", name: "Nails", staffName: "Blair", addons: [{ name: "Polish" }] },
  ], schedule: { startAt: "2030-08-20T07:00:00Z", endAt: "2030-08-20T08:00:00Z", timezone: "Europe/Nicosia" },
  fulfilment: { mode: "AT_BUSINESS_LOCATION" }, financials: { totalCents: 10000, depositCents: 0, platformFeeCents: 0 }, source: "MANUAL",
} }) }));

it("shows each assigned professional, line add-ons and package identity without asserting payment", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<SuperAdminBookingDrawer bookingId="booking" businessName="Salon" onClose={() => {}} />));
    expect(host.textContent).toContain("Hair — Alex");
    expect(host.textContent).toContain("Nails — Blair");
    expect(host.textContent).toContain("Add-ons: Conditioner");
    expect(host.textContent).toContain("Add-ons: Polish");
    expect(host.textContent).toContain("Session 1 of 3");
    expect(host.textContent).toContain("do not by themselves confirm payment or refund settlement");
  } finally { act(() => root.unmount()); vi.unstubAllGlobals(); }
});
