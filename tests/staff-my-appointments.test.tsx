import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The Staff Business comes from the session (/auth/me), exactly as StaffMySchedule reads it.
const session = vi.hoisted(() => ({ businessId: "2".repeat(24) as string | undefined }));
vi.mock("@/lib/auth/hooks", () => ({
  useCurrentUserQuery: () => ({ data: session.businessId ? { business: { id: session.businessId } } : {} }),
}));
vi.mock("@/components/dashboard/DashboardHeader", () => ({
  default: ({ title }: { title: string }) => createElement("h1", null, title),
}));
vi.mock("@/components/dashboard/StaffSidebar", () => ({ default: ({ setActiveTab }: { setActiveTab: (tab: string) => void }) =>
  createElement("button", { onClick: () => setActiveTab("Calendar") }, "Calendar") }));
vi.mock("@/components/dashboard/StaffOverview", () => ({ default: () => null }));
vi.mock("@/components/dashboard/StaffSettings", () => ({ default: () => null }));
vi.mock("@/components/dashboard/StaffMySchedule", () => ({ default: () => null }));
vi.mock("@/components/dashboard/DashboardReviewsList", () => ({ default: () => null }));
vi.mock("@/components/support/ContactSupport", () => ({ default: () => null }));

import StaffMyAppointments from "@/components/dashboard/StaffMyAppointments";
import StaffDashboard from "@/components/dashboard/StaffDashboard";
import { bookingsApi } from "@/lib/api/bookings";
import { BooklyApiError } from "@/lib/api/client";
import { staffAppointmentsApi, type StaffAppointment, type StaffAppointmentDetail } from "@/lib/api/staff-appointments";
import { useAuthStore } from "@/lib/auth/store";
import { formatBookingDate, formatBookingTimeRange } from "@/lib/bookings/format";

// P4C-1 — Staff read-only appointments (Owner decision D-S1).

const businessId = "2".repeat(24);
let root: Root, host: HTMLDivElement, client: QueryClient;
const appointment = (overrides: Partial<StaffAppointment> = {}): StaffAppointment => ({
  id: "5".repeat(24), reference: "BK-7F3K9QZC", businessId, status: "UPCOMING",
  schedule: { startAt: "2030-08-20T06:00:00.000Z", endAt: "2030-08-20T06:45:00.000Z", timezone: "Europe/Nicosia" },
  fulfilment: { mode: "AT_BUSINESS_LOCATION", businessLocation: { city: "Larnaca", area: "Center", streetName: "Main", streetNumber: "1" } },
  customer: { displayName: "Dana Klein" },
  services: [{ serviceName: "Haircut", durationMin: 45, occupiedDurationMin: 60, addonNames: ["Beard trim"], isPackageSession: false }],
  sharedWithOtherProfessionals: false,
  ...overrides,
});
const page = (appointments: StaffAppointment[], hasMore = false) => ({ appointments, page: 1, limit: 20, hasMore,
  range: { fromDate: "x", toDate: "y" } });
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); }); };
const mount = async (view: "Upcoming" | "Canceled" | "Calendar" = "Upcoming") => {
  await act(async () => root.render(createElement(QueryClientProvider, { client },
    createElement(StaffMyAppointments, { view }))));
  await flush();
};
const click = async (text: string) => {
  const target = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes(text));
  expect(target).toBeTruthy();
  await act(async () => target!.click());
  await flush();
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  session.businessId = businessId;
  useAuthStore.setState({ cacheEpoch: 1, status: "authenticated",
    user: { id: "a".repeat(24), email: "staff@example.com", role: "STAFF", status: "ACTIVE" } });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

it("lists only the Staff member's assigned appointments in the Business timezone, scoped by the session Business", async () => {
  const list = vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([appointment()]));
  await mount();
  const [calledBusiness, params] = list.mock.calls[0]!;
  expect(calledBusiness).toBe(businessId);
  expect(params).toMatchObject({ status: ["UPCOMING", "PENDING"], page: 1, limit: 20 });
  expect(Object.keys(params!)).not.toContain("staffMembershipId");
  const schedule = appointment().schedule;
  expect(host.textContent).toContain(formatBookingDate(schedule.startAt, schedule.timezone));
  expect(host.textContent).toContain(formatBookingTimeRange(schedule));
  expect(formatBookingTimeRange(schedule)).toMatch(/9:00/); // 06:00Z is 09:00 in Nicosia (summer).
  expect(host.textContent).toContain("Haircut · 45 min");
  expect(host.textContent).toContain("Dana Klein");
  expect(host.textContent).toContain("Upcoming");
});

it("shows an empty state and the Canceled view requests only cancelled statuses", async () => {
  const list = vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([]));
  await mount("Canceled");
  expect(list.mock.calls[0]![1]).toMatchObject({
    status: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_BUSINESS", "LATE_CANCELLATION"] });
  const { fromDate, toDate } = list.mock.calls[0]![1]!;
  expect(new Date(toDate!).getTime() - new Date(fromDate!).getTime()).toBeLessThanOrEqual(93 * 24 * 3_600_000);
  expect(host.textContent).toContain("None of your appointments were cancelled");
});

it("opens a read-only detail with no Booking, payment or Package controls", async () => {
  vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([appointment()]));
  const get = vi.spyOn(staffAppointmentsApi, "getMine").mockResolvedValue(appointment({ sharedWithOtherProfessionals: true }));
  await mount();
  await click("Haircut");
  expect(get).toHaveBeenCalledWith(businessId, "5".repeat(24), expect.any(AbortSignal));
  expect(host.querySelector("[aria-label='Appointment details']")).toBeTruthy();
  expect(host.textContent).toContain("Main 1, Center, Larnaca");
  expect(host.textContent).toContain("60 min reserved");
  expect(host.textContent).toContain("with Beard trim");
  expect(host.textContent).toContain("Other professionals also have services");
  const labels = Array.from(host.querySelectorAll("button")).map((button) => button.textContent ?? "");
  expect(labels).toEqual(["Back to appointments"]);
  for (const forbidden of [/cancel/i, /reschedule/i, /complete/i, /no-show/i, /pay/i, /refund/i, /redeem/i, /waive/i])
    expect(labels.some((label) => forbidden.test(label))).toBe(false);
  await click("Back to appointments");
  expect(host.querySelector("[aria-label='Assigned appointments']")).toBeTruthy();
});

it("shows unavailable guidance when the server withholds the travel address", async () => {
  vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([appointment({ fulfilment: { mode: "TRAVEL_TO_CUSTOMER" } })]));
  vi.spyOn(staffAppointmentsApi, "getMine").mockResolvedValue(appointment({ fulfilment: { mode: "TRAVEL_TO_CUSTOMER" } }));
  await mount();
  await click("Haircut");
  expect(host.textContent).toContain("At the customer's address");
  expect(host.textContent).toContain("Travel address isn't available. Contact the business owner.");
});

const travelDetail = (): StaffAppointmentDetail => ({
  ...appointment({ fulfilment: { mode: "TRAVEL_TO_CUSTOMER" } }),
  travelAddress: { city: "Larnaca", area: "Center", streetName: "Destination".repeat(40), streetNumber: "42",
    floorUnit: "3", aptRoom: "7" },
});

it("D-S2 shows the minimal long destination only in detail, without storage or mutation controls", async () => {
  const local = vi.spyOn(Storage.prototype, "setItem");
  vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([appointment({ fulfilment: { mode: "TRAVEL_TO_CUSTOMER" } })]));
  vi.spyOn(staffAppointmentsApi, "getMine").mockResolvedValue(travelDetail());
  await mount();
  expect(host.textContent).not.toContain("Destination");
  await click("Haircut");
  expect(host.textContent).toContain("Service Location");
  expect(host.textContent).toContain(travelDetail().travelAddress!.streetName);
  expect(host.textContent).toContain("Floor / unit: 3");
  expect(host.textContent).toContain("Apartment / room: 7");
  expect(host.querySelector("dd.break-words")?.className).toContain("[overflow-wrap:anywhere]");
  expect(Array.from(host.querySelectorAll("button")).map((button) => button.textContent)).toEqual(["Back to appointments"]);
  expect(local.mock.calls.some((args) => JSON.stringify(args).includes("Destination"))).toBe(false);
  expect(JSON.stringify(client.getQueryCache().getAll().map((query) => query.state.data))).not.toContain("Destination");
  await click("Back to appointments");
  expect(host.textContent).not.toContain("Destination");
});

it.each([401, 403, 404, 500])("D-S2 clears sensitive detail before revalidation and on %s", async (status) => {
  vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([appointment()]));
  let rejectRequest: (error: unknown) => void = () => undefined;
  vi.spyOn(staffAppointmentsApi, "getMine").mockResolvedValueOnce(travelDetail())
    .mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; }));
  await mount();
  await click("Haircut");
  expect(host.textContent).toContain("Destination");
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(host.textContent).not.toContain("Destination");
  expect(host.textContent).toContain("Loading appointment");
  await act(async () => rejectRequest(new BooklyApiError({ message: "Denied", status })));
  await flush();
  expect(host.querySelector("[role=alert]")).toBeTruthy();
  expect(host.textContent).not.toContain("Destination");
  expect(JSON.stringify(client.getQueryCache().getAll().map((query) => query.state.data))).not.toContain("Destination");
});

it("D-S2 clears on account/Business switch and logout and ignores late old responses", async () => {
  vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([appointment()]));
  let resolveOld: (value: StaffAppointmentDetail) => void = () => undefined;
  const get = vi.spyOn(staffAppointmentsApi, "getMine").mockResolvedValueOnce(travelDetail())
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockRejectedValue(new BooklyApiError({ message: "Denied", status: 404 }));
  await mount();
  await click("Haircut");
  expect(host.textContent).toContain("Destination");
  await act(async () => {
    useAuthStore.setState({ cacheEpoch: 2,
      user: { id: "b".repeat(24), email: "next@example.com", role: "STAFF", status: "ACTIVE" } });
  });
  expect(host.textContent).not.toContain("Destination");
  session.businessId = "9".repeat(24);
  await mount();
  await act(async () => resolveOld(travelDetail()));
  await flush();
  expect(host.textContent).not.toContain("Destination");
  expect(get).toHaveBeenLastCalledWith(session.businessId, "5".repeat(24), expect.any(AbortSignal));
  await act(async () => { useAuthStore.setState({ cacheEpoch: 3, status: "unauthenticated", user: null }); });
  expect(host.textContent).not.toContain("Destination");
});

it("D-S2 drops addresses on hidden tabs and fetches fresh detail when visible again", async () => {
  vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([appointment()]));
  const get = vi.spyOn(staffAppointmentsApi, "getMine").mockResolvedValueOnce(travelDetail())
    .mockResolvedValueOnce(appointment({ fulfilment: { mode: "TRAVEL_TO_CUSTOMER" } }));
  await mount();
  await click("Haircut");
  await act(async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(host.textContent).not.toContain("Destination");
  await act(async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await flush();
  expect(get).toHaveBeenCalledTimes(2);
  expect(host.textContent).not.toContain("Destination");
  expect(host.textContent).toContain("Travel address isn't available");
});

it("P4D clears sensitive detail when revalidation fails without an HTTP response", async () => {
  vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([appointment()]));
  vi.spyOn(staffAppointmentsApi, "getMine").mockResolvedValueOnce(travelDetail())
    .mockRejectedValueOnce(new Error("Network Error"));
  await mount();
  await click("Haircut");
  expect(host.textContent).toContain("Destination");
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  await flush();
  expect(host.querySelector("[role=alert]")).toBeTruthy();
  expect(host.textContent).not.toContain("Destination");
});

it("P4D reauthorizes at appointment end and removes the expired destination", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-08-20T06:44:00.000Z"));
  try {
    vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([appointment()]));
    const get = vi.spyOn(staffAppointmentsApi, "getMine").mockResolvedValueOnce(travelDetail())
      .mockResolvedValueOnce(appointment({ fulfilment: { mode: "TRAVEL_TO_CUSTOMER" } }));
    await act(async () => root.render(createElement(QueryClientProvider, { client },
      createElement(StaffMyAppointments, { view: "Upcoming" }))));
    await act(async () => { await vi.advanceTimersByTimeAsync(20); });
    const row = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Haircut"));
    expect(row).toBeTruthy();
    await act(async () => { row!.click(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(20); });
    expect(host.textContent).toContain("Destination");
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(get).toHaveBeenCalledTimes(2);
    expect(host.textContent).not.toContain("Destination");
    expect(host.textContent).toContain("Travel address isn't available");
  } finally {
    vi.useRealTimers();
  }
});

it("shows loading, then an error with a working retry", async () => {
  let resolveFirst: (value: never) => void = () => undefined;
  const list = vi.spyOn(staffAppointmentsApi, "listMine")
    .mockImplementationOnce(() => new Promise((_, reject) => { resolveFirst = () => reject(new BooklyApiError({ message: "Server error", status: 500 })); }))
    .mockResolvedValueOnce(page([appointment()]));
  await act(async () => root.render(createElement(QueryClientProvider, { client }, createElement(StaffMyAppointments, { view: "Upcoming" }))));
  expect(host.textContent).toContain("Loading appointments");
  await act(async () => resolveFirst(undefined as never)); await flush();
  expect(host.querySelector("[role=alert]")).toBeTruthy();
  await click("Try again");
  expect(list).toHaveBeenCalledTimes(2);
  expect(host.textContent).toContain("Haircut");
});

it("an inactive or revoked membership (404) shows the access state, not an empty list", async () => {
  vi.spyOn(staffAppointmentsApi, "listMine").mockRejectedValue(new BooklyApiError({ message: "Staff member not found", status: 404 }));
  await mount();
  expect(host.textContent).toContain("staff access to this business isn't active");
  expect(host.textContent).not.toContain("no upcoming appointments");
});

it("a detail that is no longer assigned (404) says so", async () => {
  vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([appointment()]));
  vi.spyOn(staffAppointmentsApi, "getMine").mockRejectedValue(new BooklyApiError({ message: "Booking not found", status: 404 }));
  await mount();
  await click("Haircut");
  expect(host.textContent).toContain("no longer assigned to you");
});

it("requests nothing without an active Business on the session", async () => {
  session.businessId = undefined;
  const list = vi.spyOn(staffAppointmentsApi, "listMine");
  await mount();
  expect(list).not.toHaveBeenCalled();
  expect(host.textContent).toContain("isn't linked to an active business");
});

it("pages through results with Next and Previous only when the server reports more", async () => {
  const list = vi.spyOn(staffAppointmentsApi, "listMine")
    .mockResolvedValueOnce(page([appointment()], true))
    .mockResolvedValueOnce(page([appointment({ id: "6".repeat(24), reference: "BK-SECOND1" })], false));
  await mount();
  await click("Next");
  expect(list.mock.calls[1]![1]).toMatchObject({ page: 2 });
  expect(host.textContent).toContain("BK-SECOND1");
  const labels = Array.from(host.querySelectorAll("button")).map((button) => button.textContent ?? "");
  expect(labels).toContain("Previous");
  expect(labels).not.toContain("Next");
});

it("labels a customer cancellation from the professional's side", async () => {
  vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([appointment({ status: "CANCELLED_BY_CUSTOMER" })]));
  await mount("Canceled");
  expect(host.textContent).toContain("Cancelled by customer");
  expect(host.textContent).not.toContain("Cancelled by you");
});

async function changeCalendarMonth(value: string) {
  await act(async () => {
    const field = host.querySelector<HTMLInputElement>('[aria-label="Calendar month"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

it("P4E Staff calendar uses assigned reads and local-month boundaries, with the existing read-only detail", async () => {
  const localAugust = appointment({ reference: "AUGUST-LOCAL", schedule: {
    startAt: "2030-07-31T22:00:00Z", endAt: "2030-07-31T23:00:00Z", timezone: "Europe/Nicosia" } });
  const list = vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([
    localAugust,
    appointment({ id: "6".repeat(24), reference: "JULY-LOCAL", schedule: {
      startAt: "2030-07-31T10:00:00Z", endAt: "2030-07-31T11:00:00Z", timezone: "Europe/Nicosia" } }),
    appointment({ id: "7".repeat(24), reference: "SEPTEMBER-LOCAL", schedule: {
      startAt: "2030-08-31T23:00:00Z", endAt: "2030-09-01T00:00:00Z", timezone: "Europe/Nicosia" } }),
  ]));
  const get = vi.spyOn(staffAppointmentsApi, "getMine").mockResolvedValue(localAugust);
  await mount("Calendar");
  await changeCalendarMonth("2030-08");
  expect(host.textContent).toContain("My calendar");
  expect(host.textContent).toContain("AUGUST-LOCAL");
  expect(host.textContent).not.toContain("JULY-LOCAL");
  expect(host.textContent).not.toContain("SEPTEMBER-LOCAL");
  const params = list.mock.calls.at(-1)![1]!;
  expect(list.mock.calls.at(-1)![0]).toBe(businessId);
  expect(params).toMatchObject({ fromDate: "2030-07-31T00:00:00.000Z", toDate: "2030-09-02T00:00:00.000Z" });
  expect(params.status).toContain("COMPLETED");
  expect(Object.keys(params)).not.toContain("staffMembershipId");
  await click("Haircut");
  expect(get).toHaveBeenCalledWith(businessId, localAugust.id, expect.any(AbortSignal));
  expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["Back to appointments"]);
});

it("P4E changing calendar month resets paging and keeps API date ranges bounded", async () => {
  const list = vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([appointment()], true));
  await mount("Calendar");
  await click("Next");
  expect(list.mock.calls.at(-1)![1]?.page).toBe(2);
  await changeCalendarMonth("2030-02");
  const params = list.mock.calls.at(-1)![1]!;
  expect(params.page).toBe(1);
  expect(Date.parse(params.toDate!) - Date.parse(params.fromDate!)).toBeLessThanOrEqual(33 * 86_400_000);
});

it("P4E never presents the old Business list while a different Business is loading", async () => {
  vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValueOnce(page([appointment()]))
    .mockImplementationOnce(() => new Promise(() => undefined));
  await mount();
  expect(host.textContent).toContain("Dana Klein");
  session.businessId = "9".repeat(24);
  await mount();
  expect(host.textContent).not.toContain("Dana Klein");
  expect(host.textContent).toContain("Loading appointments");
});

it("P4E Staff Dashboard Calendar routes to own reads rather than the management calendar", async () => {
  const own = vi.spyOn(staffAppointmentsApi, "listMine").mockResolvedValue(page([]));
  const management = vi.spyOn(bookingsApi, "getCalendar");
  await act(async () => root.render(createElement(QueryClientProvider, { client }, createElement(StaffDashboard))));
  await click("Calendar");
  expect(host.textContent).toContain("My calendar");
  expect(own).toHaveBeenCalled();
  expect(management).not.toHaveBeenCalled();
});
