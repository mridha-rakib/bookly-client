import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BookingCalendarEntry } from "@/lib/api/bookings";
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";

const fx = vi.hoisted(() => ({ rows: [] as BookingCalendarEntry[], completion: vi.fn(), calendar: vi.fn(), ordinary: vi.fn(), cancel: vi.fn(), waive: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: fx.error, success: fx.success } }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/business/availability-hooks", () => ({ useCalendarBlocksQuery: () => ({ data: { blocks: [], closedPeriods: [] } }), useChangeCalendarBlocksMutation: () => ({ isPending: false }) }));
vi.mock("@/components/notifications/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/dashboard/CalendarBookingCompletion", () => ({
  default: (props: unknown) => { fx.completion(props); return createElement("p", {}, "Authoritative completion entry"); },
}));
vi.mock("@/lib/staff/hooks", () => ({ useStaffListQuery: () => ({ data: { members: [{ membershipId: "staff", name: "Professional" }] } }) }));
vi.mock("@/lib/bookings/hooks", () => ({
  useBusinessCalendarQuery: (businessId: string) => { fx.calendar(businessId); return { data: { bookings: fx.rows } }; },
  useCompleteBookingMutation: () => { fx.ordinary(); return { mutate: vi.fn() }; },
  useCancelByBusinessMutation: () => ({ mutate: fx.cancel }),
  useMarkNoShowMutation: () => ({ mutate: vi.fn() }),
  useWaiveFeeMutation: () => ({ mutate: fx.waive }),
}));

let root: Root, host: HTMLDivElement;
const view = vi.fn();
const mount = async (businessId = "managed-business", navigate = true) => {
  await act(async () => root.render(createElement(DashboardCalendar,
    { businessId, ...(navigate ? { onViewBookingClick: view } : {}) })));
};
const openCard = async () => {
  const service = Array.from(host.querySelectorAll("div")).find((div) => div.textContent === "Test service")!;
  await act(async () => service.click());
};
const action = (text: string) => Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === text)!;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // Keep appointments in the current visible week without changing the host clock.
  const start = new Date(); start.setHours(10, 0, 0, 0);
  fx.rows = [{ id: "selected-booking", firstClassPackage: false, reference: "BK-1", status: "UPCOMING",
    source: "BOOKLY_MANAGED", schedule: { startAt: start.toISOString(), endAt: new Date(start.getTime() + 3600000).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, serviceNames: ["Test service"], customerName: "Customer",
    staffMembershipIds: ["staff"], staffNames: ["Professional"], totalCents: 999999, currency: "EUR", packageSessions: [] }];
  fx.completion.mockReset(); fx.ordinary.mockReset(); fx.calendar.mockReset(); view.mockReset();
  fx.cancel.mockReset(); fx.waive.mockReset(); fx.error.mockReset(); fx.success.mockReset();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it.each(["owner-business", "supervisor-business"])("First-Class Calendar routes selected context from %s to existing detail", async (businessId) => {
  fx.rows[0]!.firstClassPackage = true;
  await mount(businessId); await openCard();
  expect(action("Complete")).toBeUndefined();
  await act(async () => action("Manage package appointment").click());
  expect(fx.calendar).toHaveBeenCalledWith(businessId);
  expect(view).toHaveBeenCalledWith("selected-booking");
  expect(fx.completion).not.toHaveBeenCalled(); expect(fx.ordinary).not.toHaveBeenCalled();
});

it("cannot fall back to ordinary completion when package detail navigation is unavailable", async () => {
  fx.rows[0]!.firstClassPackage = true;
  await mount("managed-business", false); await openCard();
  expect(action("Manage package appointment").disabled).toBe(true);
  await act(async () => action("Manage package appointment").click());
  expect(fx.completion).not.toHaveBeenCalled(); expect(fx.ordinary).not.toHaveBeenCalled();
});

it.each([false, true])("ordinary/legacy=%s passes only identity to the authoritative detail entry", async (legacy) => {
  if (legacy) fx.rows[0]!.packageSessions = [{ packageProgressId: "legacy", sessionIndex: 1,
    sessionsInPackage: 3 }];
  await mount(); await openCard(); await act(async () => action("Complete").click());
  expect(view).not.toHaveBeenCalled();
  expect(fx.completion).toHaveBeenLastCalledWith(expect.objectContaining({
    businessId: "managed-business", bookingId: "selected-booking", onViewBooking: view,
  }));
  expect(fx.completion.mock.lastCall?.[0]).not.toHaveProperty("defaultBalanceDueCents");
  expect(fx.ordinary).not.toHaveBeenCalled();
});
it.each(["Cancel Booking", "Waive charge"])("BC-F03 reports a failed %s action", async (label) => {
  if (label === "Waive charge") fx.rows[0]!.status = "PENDING";
  const mutation = label === "Cancel Booking" ? fx.cancel : fx.waive;
  mutation.mockImplementation((_input, callbacks) => callbacks?.onError?.(Error("Lifecycle request failed")));
  await mount(); await openCard();
  await act(async () => action(label).click());
  await act(async () => action("Yes").click());
  expect(mutation).toHaveBeenCalledTimes(1);
  expect(fx.error).toHaveBeenCalledWith(expect.stringContaining("Lifecycle request failed"));
  expect(fx.success).not.toHaveBeenCalled();
});
