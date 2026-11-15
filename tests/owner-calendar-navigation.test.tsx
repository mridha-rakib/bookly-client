import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";

const fx = vi.hoisted(() => ({ timezone: "Europe/Nicosia", bookings: [] as unknown[], ranges: [] as string[][], view: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ default: () => null }));
vi.mock("@/lib/business/availability-hooks", () => ({ useCalendarBlocksQuery: () => ({ data: { timezone: fx.timezone, blocks: [], closedPeriods: [] } }), useChangeCalendarBlocksMutation: () => ({}) }));
vi.mock("@/lib/staff/hooks", () => ({ useStaffListQuery: () => ({ data: { members: [{ membershipId: "one", name: "Alex", schedule: [] }, { membershipId: "two", name: "Alex", schedule: [] }] } }) }));
vi.mock("@/lib/bookings/hooks", () => ({
  useBusinessCalendarQuery: (_id: string, from: string, to: string) => { fx.ranges.push([from, to]); return { data: { bookings: fx.bookings, timezone: fx.timezone, openingHours: [] } }; },
  useCancelByBusinessMutation: () => ({}), useMarkNoShowMutation: () => ({}), useWaiveFeeMutation: () => ({}),
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
const named = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const textButton = (label: string) => [...host.querySelectorAll("button")].find(button => button.textContent?.trim() === label)!;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-31T09:00:00Z")); fx.timezone = "Europe/Nicosia"; fx.bookings = []; fx.ranges = []; fx.view.mockReset(); host = document.createElement("div"); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); });
const mount = () => act(() => root.render(<DashboardCalendar businessId="business" onViewBookingClick={fx.view} />));
const click = (button: HTMLButtonElement) => act(() => button.click());

it("navigates day, week and month without skipping February and pages the picker across years", () => {
  mount();
  expect(named("Choose date").textContent).toContain("26 Jan - 1 Feb");
  click(named("Next date")); expect(named("Choose date").textContent).toContain("2 Feb - 8 Feb");
  click(named("Previous date")); expect(named("Choose date").textContent).toContain("26 Jan - 1 Feb");
  click(textButton("Weekly")); click(textButton("Monthly"));
  expect(named("Choose date").textContent).toContain("January 2026");
  click(named("Next date")); expect(named("Choose date").textContent).toContain("February 2026");
  click(named("Go to today")); expect(named("Choose date").textContent).toContain("January 2026");
  click(named("Choose date")); click(named("Previous picker month"));
  expect(host.textContent).toContain("December 2025");
  click(named("Next picker month")); expect(host.textContent).toContain("January 2026");
  const [from, to] = fx.ranges.at(-1)!;
  expect(from).toBe("2025-12-30T00:00:00.000Z"); expect(to).toBe("2026-02-02T23:59:59.999Z");
});

it("initializes and returns to today in the Business timezone", () => {
  vi.setSystemTime(new Date("2026-01-31T22:30:00Z"));
  mount(); click(textButton("Weekly")); click(textButton("Today"));
  expect(named("Choose date").textContent).toContain("1 Feb");
  click(named("Previous date")); expect(named("Choose date").textContent).toContain("31 Jan");
  click(named("Go to today")); expect(named("Choose date").textContent).toContain("1 Feb");
});

it("retains a membership filter in monthly view for staff with the same name", () => {
  fx.bookings = ["one", "two"].map((id) => ({ id, firstClassPackage: false, status: "UPCOMING", schedule: { startAt: "2026-01-31T08:00:00Z", endAt: "2026-01-31T09:00:00Z", timezone: fx.timezone }, staffMembershipIds: [id], staffNames: ["Alex"], serviceNames: [id], customerName: `Customer ${id}`, packageSessions: [], totalCents: 1000 }));
  mount(); click(textButton("All Staff"));
  const choices = [...host.querySelectorAll("button")].filter(button => button.textContent?.trim() === "Alex" && button.hasAttribute("aria-pressed"));
  click(choices[1]!); click(textButton("Weekly")); click(textButton("Monthly"));
  expect(host.textContent).toContain("Customer two"); expect(host.textContent).not.toContain("Customer one");
});

it("renders a parallel booking in both professional rows with the same identity across the DST transition", () => {
  vi.setSystemTime(new Date("2026-03-29T01:30:00Z"));
  fx.bookings = [{ id: "parallel", reference: "BK-1", firstClassPackage: false, status: "UPCOMING", schedule: { startAt: "2026-03-29T01:30:00Z", endAt: "2026-03-29T02:30:00Z", timezone: "Europe/Nicosia" }, staffMembershipIds: ["one", "two"], staffNames: ["Alex", "Alex"], serviceNames: ["Hair", "Facial"], customerName: "Parallel customer", packageSessions: [], totalCents: 1000 }];
  mount();
  expect(host.textContent).toContain("23 Mar - 29 Mar");
  const labels = [...host.querySelectorAll("div")].filter(element => element.textContent === "Hair, Facial");
  expect(labels).toHaveLength(2);
  expect(host.textContent).toContain("4:30 AM–5:30 AM Parallel customer");
  expect(fx.ranges.at(-1)).toEqual(["2026-03-21T00:00:00.000Z", "2026-03-31T23:59:59.999Z"]);
  const cards = host.querySelectorAll<HTMLElement>('[role="button"][aria-label="Booking BK-1"]');
  expect(cards).toHaveLength(2);
  act(() => cards[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  const viewButtons = [...host.querySelectorAll("button")].filter(button => button.textContent?.trim() === "View Booking");
  expect(viewButtons).toHaveLength(1);
  click(viewButtons[0]!); expect(fx.view).toHaveBeenCalledWith("parallel");
});

it("renders both repeated hours and positions fall-back appointments by real time", () => {
  vi.setSystemTime(new Date("2026-10-25T00:00:00Z"));
  fx.bookings = [
    ["first", "2026-10-25T00:15:00Z", "2026-10-25T00:45:00Z"],
    ["crossing", "2026-10-25T00:45:00Z", "2026-10-25T01:15:00Z"],
    ["second", "2026-10-25T01:15:00Z", "2026-10-25T01:45:00Z"],
  ].map(([id, startAt, endAt]) => ({ id, reference: id, firstClassPackage: false, status: "UPCOMING", schedule: { startAt, endAt, timezone: "Europe/Nicosia" }, staffMembershipIds: ["one"], staffNames: ["Alex"], serviceNames: ["Service"], customerName: id, packageSessions: [], totalCents: 1000 }));
  mount(); click(textButton("Weekly")); click(textButton("Today"));
  expect(host.querySelector('[aria-label="3:00 AM GMT+3"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="3:00 AM GMT+2"]')).not.toBeNull();
  const card = (id: string) => host.querySelector<HTMLElement>(`[aria-label="Booking ${id}"]`)!;
  expect(card("first").style.top).toBe("520px");
  expect(card("crossing").style.top).toBe("600px");
  expect(card("second").style.top).toBe("680px");
  for (const id of ["first", "crossing", "second"]) {
    expect(card(id).style.height).toBe("80px");
    expect(card(id).style.width).toBe("94%");
  }
  expect(host.textContent).toContain("Clock change · editing unavailable");
  const ambiguousSlot = host.querySelector<HTMLElement>('[title="This time cannot be edited because local clock changes are ambiguous."]')!;
  act(() => ambiguousSlot.click());
  expect(host.textContent).not.toContain("1 slot selected");
});
