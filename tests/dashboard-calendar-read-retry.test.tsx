import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";

const fx = vi.hoisted(() => ({ query: { isLoading: false, isError: true, isFetching: false, refetch: vi.fn(), data: undefined as unknown }, members: [] as { membershipId: string; name: string }[], staffError: false, staffRetry: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ default: () => null }));
vi.mock("@/lib/staff/hooks", () => ({ useStaffListQuery: () => ({ data: { members: fx.members }, isError: fx.staffError, refetch: fx.staffRetry }) }));
vi.mock("@/lib/bookings/hooks", () => ({ useBusinessCalendarQuery: () => fx.query, useCancelByBusinessMutation: () => ({}), useMarkNoShowMutation: () => ({}), useWaiveFeeMutation: () => ({}) }));
vi.mock("@/lib/business/availability-hooks", () => ({ useCalendarBlocksQuery: () => ({}), useChangeCalendarBlocksMutation: () => ({}) }));
vi.mock("@/components/dashboard/CalendarActionModals", () => ({ NoShowModal: () => null, CancelBookingModal: () => null }));
vi.mock("@/components/dashboard/WaiveChargeModal", () => ({ default: () => null }));
vi.mock("@/components/dashboard/CalendarBookingCompletion", () => ({ default: () => null }));

it("retries a failed calendar read and prevents duplicate pending retries", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<DashboardCalendar businessId="business" />));
    expect(host.textContent).toContain("Couldn't load calendar");
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Retry calendar")!.click());
    expect(fx.query.refetch).toHaveBeenCalledOnce();
    fx.query.isFetching = true;
    act(() => root.render(<DashboardCalendar businessId="business" />));
    expect([...host.querySelectorAll("button")].find(button => button.textContent === "Retrying…")?.disabled).toBe(true);
  } finally { act(() => root.unmount()); vi.unstubAllGlobals(); }
});

it("offers a staff-list retry instead of silently presenting an empty calendar", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); fx.staffError = true;
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<DashboardCalendar businessId="business" />));
    expect(host.textContent).toContain("Staff could not be loaded");
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Retry staff")!.click());
    expect(fx.staffRetry).toHaveBeenCalledOnce();
  } finally { act(() => root.unmount()); fx.staffError = false; vi.unstubAllGlobals(); }
});

it("filters staff with the same name by membership identity", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fx.members = [{ membershipId: "one", name: "Alex" }, { membershipId: "two", name: "Alex" }];
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<DashboardCalendar businessId="business" />));
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "All Staff")!.click());
    const choices = [...host.querySelectorAll("button")].filter(button => button.textContent === "Alex");
    expect(choices).toHaveLength(2);
    act(() => choices[1].click());
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Alex" && !button.hasAttribute("aria-pressed"))!.click());
    const reopened = [...host.querySelectorAll("button")].filter(button => button.textContent === "Alex" && button.hasAttribute("aria-pressed"));
    expect(reopened.map(button => button.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
  } finally { act(() => root.unmount()); fx.members = []; vi.unstubAllGlobals(); }
});
