import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import SuperAdminBookings from "@/components/super-admin/bookings/SuperAdminBookings";

const read = vi.hoisted(() => vi.fn((params: unknown) => { void params; return { data: undefined, isLoading: false, isError: false }; }));
vi.mock("@/lib/superAdminBookings/hooks", () => ({ useSuperAdminBookingsQuery: read, useSuperAdminBookingDetailQuery: () => ({}) }));
vi.mock("@/components/super-admin/bookings/SuperAdminBookingDrawer", () => ({ default: () => null }));

it("includes the entire selected UTC end date in the booking query", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<SuperAdminBookings />));
    const input = host.querySelector<HTMLInputElement>("#admin-bookings-to")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2030-08-20");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(read.mock.calls.at(-1)?.[0]).toMatchObject({ toDate: "2030-08-20T23:59:59.999Z" });
    expect(host.textContent).toContain("Date filters use UTC, inclusive");
  } finally { act(() => root.unmount()); vi.unstubAllGlobals(); }
});
