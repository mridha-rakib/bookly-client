import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { BookingCalendarEntry } from "@/lib/api/bookings";
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";

const fx = vi.hoisted(() => ({ bookings: [] as BookingCalendarEntry[], view: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/business/availability-hooks", () => ({ useCalendarBlocksQuery: () => ({ data: { blocks: [], closedPeriods: [], timezone: "UTC" } }), useChangeCalendarBlocksMutation: () => ({ isPending: false }) }));
vi.mock("@/components/notifications/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/dashboard/CalendarBookingCompletion", () => ({ default: () => null }));
vi.mock("@/lib/staff/hooks", () => ({ useStaffListQuery: () => ({ data: { members: [] } }) }));
vi.mock("@/lib/bookings/hooks", () => ({
  useBusinessCalendarQuery: () => ({ data: { bookings: fx.bookings, timezone: "UTC", openingHours: [] } }),
  useCancelByBusinessMutation: () => ({ mutate: vi.fn() }),
  useMarkNoShowMutation: () => ({ mutate: vi.fn() }),
  useWaiveFeeMutation: () => ({ mutate: vi.fn() }),
}));
it("Day view renders early, late and overlapping canonical bookings even for removed Staff", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  fx.bookings = [
    ["early", "05:30", "06:30"], ["overlap", "05:30", "06:00"], ["late", "23:00", "23:45"],
  ].map(([id, start, end]) => ({ id, firstClassPackage: false, reference: `BK-${id}`, status: "UPCOMING", source: "MANUAL",
    schedule: { startAt: `${date}T${start}:00Z`, endAt: `${date}T${end}:00Z`, timezone: "UTC" },
    serviceNames: [id!], customerName: id!, staffMembershipIds: ["former-staff"], staffNames: ["Former Professional"],
    totalCents: 1500, currency: "EUR", packageSessions: [] }) as BookingCalendarEntry);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const button = (name: string) => Array.from(host.querySelectorAll("button")).find(b => b.textContent?.trim() === name)!;
  try {
    await act(async () => root.render(createElement(DashboardCalendar, { businessId: "business", onViewBookingClick: fx.view })));
    await act(async () => button("Weekly").click()); await act(async () => button("Today").click());
    const card = (name: string) => Array.from(host.querySelectorAll("h4")).find(el => el.textContent === name)!.parentElement!.parentElement!;
    expect(card("early").style.top).toBe("80px");
    expect(card("early").style.width).toBe("47%"); expect(card("overlap").style.width).toBe("47%");
    expect(card("early").style.left).not.toBe(card("overlap").style.left);
    expect(card("late").style.top).toBe("2880px");
    expect(card("late").style.height).toBe("120px");
    expect(host.textContent).toContain("Former Professional");
    await act(async () => card("late").click()); await act(async () => button("View Booking").click());
    expect(fx.view).toHaveBeenCalledWith("late");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
