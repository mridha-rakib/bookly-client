/** F1C-A: real Customer/management reschedule components, real React Query and mutation hooks. */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingDetail, RescheduleAvailabilityResult } from "@/lib/api/bookings";
import type { AvailabilitySlot } from "@/lib/api/availability";
import { bookingKeys, useRescheduleByOwnerMutation } from "@/lib/bookings/hooks";
import { isRescheduleSlotCurrent, matchesRescheduleContext } from "@/lib/bookings/reschedule-availability";
import CustomerRescheduleModal from "@/app/customer/bookings/RescheduleModal";
import ClientBookingHistoryCard from "@/components/clients/ClientBookingHistoryCard";

type Request = { method?: string; url: string; params?: { fromDate: string; toDate: string }; data?: { startAt: string } };
const fx = vi.hoisted(() => ({ requests: [] as Request[], detail: undefined as unknown as BookingDetail,
  respond: undefined as undefined | ((req: Request) => unknown), saved: vi.fn(), closed: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: async (req: Request) => { fx.requests.push(req); return fx.respond!(req); },
}));
vi.mock("next/image", () => ({ default: () => <span /> }));
vi.mock("@/components/packages/PackageActionControls", () => ({ default: () => null }));
vi.mock("@/components/packages/BusinessPackageAppointmentHistory", () => ({ default: () => null }));
vi.mock("@/components/packages/FirstClassPackageIntegration", () => ({ ManagementPackageSettlement: () => null }));
vi.mock("@/app/venue/components/TimeStep", () => ({ default: ({ availability, onSelectDate, onSelectSlot, onNextMonth, selectedSlot }: {
  availability?: RescheduleAvailabilityResult; selectedSlot?: AvailabilitySlot; onSelectDate: (date: string) => void;
  onSelectSlot: (slot: AvailabilitySlot) => void; onNextMonth: () => void;
}) => <div><button onClick={onNextMonth}>Next month</button>{availability?.days.flatMap((day) => day.slots.map((slot) =>
  <button key={slot.startAt} aria-pressed={selectedSlot?.startAt === slot.startAt}
    onClick={() => { onSelectDate(day.date); onSelectSlot(slot); }}>Slot {slot.startAt.slice(11, 16)}</button>,
))}</div> }));

const ID = "bbbbbbbbbbbbbbbbbbbbbbbb", BUSINESS = "aaaaaaaaaaaaaaaaaaaaaaaa";
function booking(mode: "HOURLY" | "PER_PERSON" | "FIXED" = "HOURLY"): BookingDetail {
  return {
    id: ID, businessId: BUSINESS, reference: "BK-F1CA", source: "BOOKLY_MANAGED", status: "UPCOMING",
    customer: { businessClientId: "client", firstName: "Customer", email: "customer@example.com", phone: { countryCode: "+357", nationalNumber: "99112233", e164: "+35799112233" } },
    createdBy: { actorRole: "CUSTOMER" }, fulfilment: { mode: "AT_BUSINESS_LOCATION" },
    serviceLines: [{ serviceId: "service", name: "Original service", pricingMode: mode, durationMin: 255,
      staffMembershipId: "staff", staffName: "Original professional", addons: [], amountCents: 4000,
      ...(mode === "HOURLY" ? { hours: 4 } : mode === "PER_PERSON" ? { personCount: 4 } : {}) }],
    financials: { currency: "EUR", servicesSubtotalCents: 4000, addonsSubtotalCents: 0, serviceDiscountCents: 0,
      travelFeeCents: 0, eligiblePlatformFeeBasisCents: 4000, platformFeeCents: 800, depositCents: 800, balanceDueCents: 3200, totalCents: 4000 },
    paymentSummary: { actualOnlinePaidCents: 800, originalVenueBalanceCents: 3200, venuePaidCents: 0, outstandingVenueBalanceCents: 3200, venueSettlementStatus: "NOT_RECORDED" },
    packageSessions: [], schedule: { timezone: "UTC", startAt: "2030-08-19T09:00:00.000Z", endAt: "2030-08-19T13:15:00.000Z" },
    customerRescheduleCount: 0, currency: "EUR", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
  } as BookingDetail;
}
function availability(params: { fromDate: string; toDate: string }, staff = "staff"): RescheduleAvailabilityResult {
  const date = `${params.fromDate.slice(0, 7)}-20`;
  return { bookingId: fx.detail.id, originalStartAt: fx.detail.schedule.startAt, bookingUpdatedAt: fx.detail.updatedAt,
    businessId: BUSINESS, serviceId: "service", timezone: "UTC", capacityMax: 1, days: [{ date, isOpen: true,
      slots: [{ startAt: `${date}T09:00:00.000Z`, endAt: `${date}T13:15:00.000Z`, eligibleStaffMembershipIds: [staff], source: "AUTO" }] }] };
}
function respond(req: Request): unknown {
  if (req.url.endsWith("/reschedule-availability")) return availability(req.params!);
  if (req.url.endsWith("/reschedule")) {
    fx.detail = { ...fx.detail, schedule: { ...fx.detail.schedule, startAt: req.data!.startAt,
      endAt: new Date(Date.parse(req.data!.startAt) + 255 * 60_000).toISOString() }, updatedAt: "2026-10-02T00:00:00.000Z" };
    return fx.detail;
  }
  if (req.url.startsWith("/catalog/")) return { business: { name: "Venue", visitType: "AT_BUSINESS_LOCATION", address: { streetName: "Main", streetNumber: "1", area: "Centre" } }, services: [], staff: [] };
  if (req.url.endsWith(`/bookings/${ID}`)) return fx.detail;
  return {};
}
function Management() {
  const mutation = useRescheduleByOwnerMutation();
  return <ClientBookingHistoryCard booking={fx.detail} businessId={BUSINESS} showFooterActions
    isReschedulePending={mutation.isPending}
    onReschedule={(startAt) => mutation.mutateAsync({ businessId: BUSINESS, bookingId: fx.detail.id, startAt })} />;
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement, client: QueryClient;
const button = (text: string) => {
  const found = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  if (!found) throw Error(`Missing button ${text}`);
  return found;
};
async function waitFor(check: () => void) {
  const start = Date.now();
  for (;;) { try { check(); return; } catch (error) { if (Date.now() - start > 3000) throw error; }
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); }); }
}
async function click(text: string) { await act(async () => button(text).click()); }
async function render(scope: "customer" | "business") {
  await act(async () => root.render(<QueryClientProvider client={client}>{scope === "customer"
    ? <CustomerRescheduleModal bookingId={ID} onSaved={fx.saved} onClose={fx.closed} /> : <Management />}</QueryClientProvider>));
  if (scope === "business") await click("Reschedule");
}
async function select(scope: "customer" | "business") {
  if (scope === "customer") { await waitFor(() => button("Slot 09:00")); await click("Slot 09:00"); }
  else { await waitFor(() => expect(button("20").disabled).toBe(false)); await click("20"); await click("9:00 AM"); }
}
const reads = () => fx.requests.filter((req) => req.url.endsWith("/reschedule-availability"));
const posts = () => fx.requests.filter((req) => req.url.endsWith("/reschedule") && req.method === "POST");
beforeEach(() => {
  fx.detail = booking(); fx.requests.length = 0; fx.respond = respond; fx.saved.mockClear(); fx.closed.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); });

describe.each(["customer", "business"] as const)("F1C-A %s reschedule", (scope) => {
  it.each(["HOURLY", "PER_PERSON", "FIXED"] as const)("uses the owned %s booking, retains history and sends only startAt", async (mode) => {
    fx.detail = booking(mode);
    const original = structuredClone(fx.detail.serviceLines);
    await render(scope); await select(scope);
    await waitFor(() => expect(button("Save changes").disabled).toBe(false));
    expect(host.textContent).toContain("Original service");
    expect(host.querySelectorAll('input[type="number"], select')).toHaveLength(0);
    const read = reads().at(-1)!;
    expect(read.url).toBe(scope === "customer" ? `/me/bookings/${ID}/reschedule-availability` : `/businesses/${BUSINESS}/bookings/${ID}/reschedule-availability`);
    expect(Object.keys(read.params!).sort()).toEqual(["fromDate", "toDate"]);
    expect(read.params!.fromDate.endsWith("-01")).toBe(true);
    const [year, month] = read.params!.fromDate.split("-").map(Number);
    expect(read.params!.toDate).toBe(`${year}-${String(month).padStart(2, "0")}-${new Date(year!, month!, 0).getDate()}`);
    await click("Save changes");
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]!.data).toEqual({ startAt: `${read.params!.fromDate.slice(0, 7)}-20T09:00:00.000Z` });
    expect(fx.detail.serviceLines).toEqual(original);
  });
  it.each(["end", "staff", "removed"] as const)("clears selection when fresh slot %s changes", async (change) => {
    await render(scope); await select(scope);
    expect(button("Save changes").disabled).toBe(false);
    fx.respond = (req) => {
      if (!req.url.endsWith("/reschedule-availability")) return respond(req);
      const result = availability(req.params!, change === "staff" ? "other-staff" : "staff");
      if (change === "end") result.days[0]!.slots[0]!.endAt = result.days[0]!.slots[0]!.endAt.replace("13:15", "14:15");
      if (change === "removed") result.days[0]!.slots = [];
      return result;
    };
    await act(async () => { await client.invalidateQueries({ queryKey: bookingKeys.rescheduleAvailability }); });
    expect(button("Save changes").disabled).toBe(true);
    expect(posts()).toHaveLength(0);
  });
  it("a refreshed Booking version clears selection even when the next response offers the same slot", async () => {
    await render(scope); await select(scope);
    const before = reads().length;
    fx.detail = { ...fx.detail, updatedAt: "2026-10-03T00:00:00.000Z" };
    await act(async () => {
      client.setQueryData(scope === "customer" ? bookingKeys.customerDetail(ID) : bookingKeys.detail(BUSINESS, ID), fx.detail);
      if (scope === "business") root.render(<QueryClientProvider client={client}><Management /></QueryClientProvider>);
    });
    await waitFor(() => expect(reads().length).toBeGreaterThan(before));
    expect(button("Save changes").disabled).toBe(true);
    await select(scope);
    await waitFor(() => expect(button("Save changes").disabled).toBe(false));
  });
  it("blocks while refetching and after error, even if a prior slot remains in cache", async () => {
    await render(scope); await select(scope);
    let reject!: (error: Error) => void;
    const pending = new Promise((_, rejectFn) => { reject = rejectFn; });
    fx.respond = (req) => req.url.endsWith("/reschedule-availability") ? pending : respond(req);
    let invalidation!: Promise<void>;
    await act(async () => { invalidation = client.invalidateQueries({ queryKey: bookingKeys.rescheduleAvailability }); });
    await waitFor(() => expect(button("Save changes").disabled).toBe(true));
    await act(async () => { reject(new Error("read failed")); await invalidation; });
    expect(button("Save changes").disabled).toBe(true);
    await click("Save changes"); expect(posts()).toHaveLength(0);
  });
  it("isolates late previous-month responses and clears the old selection", async () => {
    await render(scope); await select(scope);
    const oldParams = reads().at(-1)!.params!;
    let resolveOld!: (value: unknown) => void;
    const oldResponse = availability(oldParams, "wrong-staff");
    const pending = new Promise((resolve) => { resolveOld = resolve; });
    fx.respond = (req) => req.url.endsWith("/reschedule-availability") && req.params!.fromDate === oldParams.fromDate ? pending : respond(req);
    let invalidation!: Promise<void>;
    await act(async () => { invalidation = client.invalidateQueries({ queryKey: bookingKeys.rescheduleAvailability }); });
    await click(scope === "customer" ? "Next month" : ">");
    await waitFor(() => expect(reads().at(-1)!.params!.fromDate).not.toBe(oldParams.fromDate));
    await act(async () => { resolveOld(oldResponse); await invalidation; });
    expect(button("Save changes").disabled).toBe(true);
    await select(scope);
    await waitFor(() => expect(button("Save changes").disabled).toBe(false));
  });
  it("historical optional DTO quantities are not replaced by client minimums or echoed to the read", async () => {
    delete fx.detail.serviceLines[0]!.hours;
    delete fx.detail.serviceLines[0]!.personCount;
    await render(scope); await select(scope);
    expect(Object.keys(reads().at(-1)!.params!).sort()).toEqual(["fromDate", "toDate"]);
    expect(button("Save changes").disabled).toBe(false);
  });
  it("a final conflict stays visible and cannot reuse the old selection", async () => {
    await render(scope); await select(scope);
    fx.respond = (req) => { if (req.url.endsWith("/reschedule")) throw new Error("conflict"); return respond(req); };
    await click("Save changes");
    await waitFor(() => expect(button("Save changes").disabled).toBe(true));
    expect(host.textContent).toContain("Reschedule booking");
    expect(fx.saved).not.toHaveBeenCalled();
  });
});

it("requires matching Booking identity/version, end and original staff in the current response", () => {
  const detail = booking(); fx.detail = detail;
  const result = availability({ fromDate: "2030-08-01", toDate: "2030-08-31" });
  const selected = result.days[0]!.slots[0]!;
  expect(isRescheduleSlotCurrent(detail, result, "2030-08-20", selected)).toBe(true);
  expect(isRescheduleSlotCurrent(detail, result, "2030-08-21", selected)).toBe(false);
  expect(isRescheduleSlotCurrent(detail, result, "2030-08-20", { ...selected, endAt: "2030-08-20T10:00:00Z" })).toBe(false);
  expect(matchesRescheduleContext(detail, { ...result, bookingId: "foreign" })).toBe(false);
  expect(matchesRescheduleContext(detail, { ...result, bookingUpdatedAt: "old" })).toBe(false);
});
