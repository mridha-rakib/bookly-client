import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import SuperAdminBookingDrawer from "@/components/super-admin/bookings/SuperAdminBookingDrawer";
import { useCancelByBusinessMutation } from "@/lib/bookings/hooks";

const state = vi.hoisted(() => ({ status: "UPCOMING", fail: false }));
vi.mock("@/lib/api/bookings", () => ({ bookingsApi: {
  cancelByBusiness: vi.fn(async () => {
    if (state.fail) throw new Error("failed");
    state.status = "CANCELLED_BY_BUSINESS";
    return { id: "a", businessId: "business", status: state.status, serviceLines: [], packageSessions: [] };
  }),
} }));
vi.mock("@/lib/api/superAdminBookings", () => ({ superAdminBookingsApi: {
  getById: vi.fn(async (id: string) => ({
    id, reference: id === "a" ? "BOOK-A" : "BOOK-B", status: id === "a" ? state.status : "UPCOMING",
    customer: { firstName: id === "a" ? "Alice" : "Bob", phone: { e164: "+35799000000" } },
    serviceLines: [], schedule: { startAt: "2030-08-20T07:00:00Z", endAt: "2030-08-20T08:00:00Z", timezone: "Europe/Nicosia" },
    fulfilment: { mode: "AT_BUSINESS_LOCATION" }, financials: { totalCents: 0, depositCents: 0, platformFeeCents: 0 }, source: "MANUAL",
  })),
} }));

it("refetches an open admin booking after a successful business cancellation and switches identity", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.status = "UPCOMING"; state.fail = false;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement("div"), root = createRoot(host);
  let cancel = async () => {};
  function Screen({ id }: { id: string }) {
    const mutation = useCancelByBusinessMutation();
    cancel = async () => { await mutation.mutateAsync({ businessId: "business", bookingId: "a" }); };
    return <SuperAdminBookingDrawer bookingId={id} onClose={() => {}} />;
  }
  const render = async (id: string) => { await act(async () => { root.render(<QueryClientProvider client={client}><Screen id={id} /></QueryClientProvider>); }); };
  const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); };
  try {
    await render("a");
    await settle();
    expect(host.textContent).toContain("Alice");
    state.fail = true;
    await act(async () => { await expect(cancel()).rejects.toThrow("failed"); });
    expect(host.textContent).toContain("Upcoming");
    state.fail = false;
    await act(async () => { await cancel(); });
    await settle();
    expect(host.textContent).toContain("Cancelled");
    await render("b");
    await settle();
    expect(host.textContent).toContain("Bob");
    expect(host.textContent).not.toContain("Alice");
  } finally { await act(async () => root.unmount()); client.clear(); vi.unstubAllGlobals(); }
});
