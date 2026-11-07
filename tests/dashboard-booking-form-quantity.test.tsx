/** F1B: real Manual Booking form and availability hook; read context/transport are mocked. */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogService } from "@/lib/api/catalog";
import type { AvailabilityResult, AvailabilitySlot, GetAvailabilityParams } from "@/lib/api/availability";

const fx = vi.hoisted(() => ({
  services: [] as CatalogService[],
  requests: [] as GetAvailabilityParams[],
  create: vi.fn().mockResolvedValue({ id: "created" }),
  createClient: vi.fn(),
  omitAddress: false,
  delay: undefined as undefined | ((params: GetAvailabilityParams) => Promise<AvailabilityResult> | undefined),
}));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: async ({ params }: { params: GetAvailabilityParams }) => {
    fx.requests.push(params);
    const delayed = fx.delay?.(params);
    if (delayed) return delayed;
    return response(params);
  },
}));
vi.mock("@/lib/bookings/hooks", () => ({
  useBookableServicesQuery: () => ({ data: { services: fx.services }, isLoading: false }),
  useBookableAddonsForServiceQuery: () => ({ data: { addons: [] } }),
  useCreateManualBookingMutation: () => ({ mutateAsync: fx.create, isPending: false }),
}));
vi.mock("@/lib/staff/hooks", () => ({ useStaffListQuery: () => ({ data: { members: [
  { membershipId: "staff", name: "Professional", employmentActive: true },
] } }) }));
vi.mock("@/lib/clients/hooks", () => ({
  useClientsQuery: () => ({ data: { clients: [{ id: "client", firstName: "Customer", email: "test@example.com",
    phone: { countryCode: "+357", nationalNumber: "99112233" },
    ...(fx.omitAddress ? {} : { address: { city: "Larnaca", propertyType: "HOUSE", area: "Centre", streetName: "Main", streetNumber: "1" } }),
  }] } }),
  useCreateClientMutation: () => ({ mutateAsync: fx.createClient, isPending: false }),
}));
vi.mock("@/lib/superAdminSettings/hooks", () => ({ usePublicBookingConfigQuery: () => ({ data: { maxServicesPerBooking: 5 } }) }));
vi.mock("next/image", () => ({ default: () => <span /> }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => <header /> }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/app/venue/components/TimeStep", () => ({ default: ({ availability, selectedSlot, onSelectDate, onSelectSlot }: {
  availability?: AvailabilityResult; selectedSlot?: AvailabilitySlot;
  onSelectDate: (date: string) => void; onSelectSlot: (slot: AvailabilitySlot) => void;
}) => <div>{availability?.days.flatMap((day) => day.slots.map((slot) =>
  <button key={slot.startAt} aria-pressed={selectedSlot?.startAt === slot.startAt}
    onClick={() => { onSelectDate(day.date); onSelectSlot(slot); }}>Slot {slot.startAt.slice(11, 16)}</button>,
))}</div> }));
import DashboardBookingForm from "@/components/dashboard/DashboardBookingForm";

const base = { category: "Wellbeing", isFeatured: false, isPackageDeal: false, servedCities: [], assignedStaffMembershipIds: ["staff"] };
const hourly: CatalogService = { ...base, id: "hourly", name: "Hourly", pricingMode: "HOURLY", hourlyPricing: { ratePerHourCents: 1000, minHours: 2, maxHours: 4 } };
const group: CatalogService = { ...base, id: "group", name: "Group", pricingMode: "PER_PERSON", perPersonPricing: { ratePerPersonCents: 1000, minPersons: 2, maxPersons: 4, durationMin: 60 } };
const fixed: CatalogService = { ...base, id: "fixed", name: "Fixed", pricingMode: "FIXED", fixedPricing: { priceCents: 1000, durationMin: 60 } };
function response(params: GetAvailabilityParams): AvailabilityResult {
  const date = `${params.fromDate.slice(0, 7)}-20`;
  const slot = (time: string): AvailabilitySlot => ({ startAt: `${date}T${time}:00.000Z`,
    endAt: new Date(Date.parse(`${date}T${time}:00Z`) + (params.hours ?? 1) * 3_600_000).toISOString(),
    eligibleStaffMembershipIds: ["staff"], source: "AUTO" });
  return { businessId: "business", serviceId: "service", timezone: "UTC", capacityMax: 1,
    days: [{ date, isOpen: true, slots: [slot("09:00"), ...((params.hours ?? 2) <= 2 && (params.partySize ?? 2) <= 2 ? [slot("11:00")] : [])] }] };
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement, queryClient: QueryClient;
const button = (text: string) => {
  const found = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
};
async function waitFor(check: () => void) {
  const start = Date.now();
  for (;;) {
    try { check(); return; } catch (error) { if (Date.now() - start > 3000) throw error; }
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
}
async function click(text: string) { await act(async () => button(text).click()); }
async function selectProfessional() {
  // Native button role; its text-derived name includes a separate avatar initial.
  // Match the professional's name within that accessible name, not all textContent.
  const controls = [...host.querySelectorAll("button")].filter((control) => {
    const name = control.getAttribute("aria-label") ?? [...control.childNodes]
      .map((node) => node.textContent ?? "").join(" ").replace(/\s+/g, " ").trim();
    return /(?:^|\s)Professional$/.test(name);
  });
  expect(controls).toHaveLength(1);
  expect(controls[0]!.disabled).toBe(false);
  await act(async () => controls[0]!.click());
}
async function chooseService(id: string) {
  const select = [...host.querySelectorAll("select")].find((el) => [...el.options].some((o) => o.value === id))!;
  await act(async () => { select.value = id; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function setup(service: CatalogService) {
  await chooseService(service.id);
  await selectProfessional();
  await waitFor(() => button("Slot 09:00"));
}
beforeEach(async () => {
  fx.omitAddress = false; fx.services = [hourly, group, fixed]; fx.requests.length = 0; fx.create.mockReset().mockResolvedValue({ id: "created" }); fx.createClient.mockReset(); fx.delay = undefined;
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<QueryClientProvider client={queryClient}><DashboardBookingForm businessId="business"
    visitType="AT_BUSINESS_LOCATION" onClose={() => undefined} onCreated={() => undefined} /></QueryClientProvider>));
  const input = host.querySelector('input[placeholder^="Type a client"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Customer");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Customer +357 99112233 • test@example.com");
});
afterEach(async () => { await act(async () => root.unmount()); queryClient.clear(); host.remove(); });

describe("Manual Booking quantity (F1B)", () => {
  it.each([hourly, group])("sends default/edited quantities for $name, clears slots and preserves explicit staff", async (service) => {
    await setup(service);
    const field = service === hourly ? "hours" : "partySize";
    expect(fx.requests.at(-1)?.[field]).toBe(2);
    expect(host.textContent).toContain("20.00");
    await click("Slot 09:00");
    expect(button("Create booking").disabled).toBe(false);
    await click("+");
    await waitFor(() => expect(fx.requests.at(-1)?.[field]).toBe(3));
    expect(host.textContent).toContain("30.00");
    await waitFor(() => button("Slot 09:00"));
    expect(button("Slot 09:00").getAttribute("aria-pressed")).toBe("false");
    expect(button("Create booking").disabled).toBe(true);
    expect(host.textContent).not.toContain("Slot 11:00");
    expect(fx.requests.at(-1)?.staffMembershipId).toBe("staff");
    await click("Slot 09:00"); await click("Create booking");
    const input = fx.create.mock.calls.at(-1)![0].input;
    expect(fx.create.mock.calls.at(-1)![0].businessId).toBe("business");
    expect(input.businessClientId).toBe("client");
    expect(input.serviceLines[0].serviceId).toBe(service.id);
    expect(input.serviceLines[0].pricingInput).toEqual(service === hourly ? { hours: 3 } : { personCount: 3 });
    expect(input.serviceLines[0].staffMembershipId).toBe("staff");
  });
  it.each([hourly, group])("isolates late quantity responses for $name", async (service) => {
    let resolveOld!: (value: AvailabilityResult) => void;
    const pending = new Promise<AvailabilityResult>((resolve) => { resolveOld = resolve; });
    let old!: GetAvailabilityParams;
    fx.delay = (params) => {
      if ((service === hourly ? params.hours : params.partySize) === 2) { old = params; return pending; }
      return undefined;
    };
    await chooseService(service.id); await selectProfessional();
    await waitFor(() => expect(old).toBeDefined());
    await click("+"); await click("+");
    await waitFor(() => expect(service === hourly ? fx.requests.at(-1)?.hours : fx.requests.at(-1)?.partySize).toBe(4));
    await waitFor(() => button("Slot 09:00"));
    await act(async () => resolveOld(response(old)));
    expect(host.textContent).not.toContain("Slot 11:00");
    expect(button("Create booking").disabled).toBe(true);
    await click("Slot 09:00"); await click("Create booking");
    expect(fx.create.mock.calls.at(-1)![0].input.serviceLines[0].pricingInput).toEqual(service === hourly ? { hours: 4 } : { personCount: 4 });
  });
  it("revalidates a previously selected staff/slot after a fresh response removes eligibility", async () => {
    await setup(hourly); await click("Slot 09:00");
    fx.delay = async (params) => ({ ...response(params), days: [{ ...response(params).days[0]!, slots: [] }] });
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ["availability"] }); });
    await waitFor(() => expect(button("Create booking").disabled).toBe(true));
    await click("Create booking");
    expect(fx.create).not.toHaveBeenCalled();
  });
  it("fixed booking omits both quantities and preserves its final payload", async () => {
    await setup(fixed);
    expect(fx.requests.at(-1)?.hours).toBeUndefined();
    expect(fx.requests.at(-1)?.partySize).toBeUndefined();
    await click("Slot 09:00"); await click("Create booking");
    expect(fx.create.mock.calls.at(-1)![0].input.serviceLines).toEqual([
      { serviceId: fixed.id, staffMembershipId: "staff", addonIds: [], pricingInput: {} },
    ]);
  });
});

async function fillInput(placeholder: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function newClientForm() {
  await click("Change"); await click("+ Add new client");
  for (const [placeholder, value] of [["John", "New"], ["Doe", "Client"], ["example@email.com", "new@example.com"], ["99111111", "99123456"], ["e.g. Mackenzie, finikoudes", "Centre"], ["e.g. Emrou", "Main"], ["e.g. 14", "1"]]) {
    await fillInput(placeholder!, value!);
  }
  for (const value of ["Larnaca", "House"]) {
    const select = [...host.querySelectorAll("select")].find(el => [...el.options].some(option => option.value === value))!;
    await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
  }
  fx.createClient.mockResolvedValue({ id: "new-client", firstName: "New", email: "new@example.com",
    phone: { countryCode: "+357", nationalNumber: "99123456" },
    address: { city: "Larnaca", propertyType: "HOUSE", area: "Centre", streetName: "Main", streetNumber: "1" },
  });
  await setup(fixed); await click("Slot 09:00");
}
it("BC-F02 retries booking with the already created client instead of creating it again", async () => {
  await newClientForm();
  fx.create.mockRejectedValueOnce(Error("Booking unavailable"));
  await click("Create booking");
  expect(fx.createClient).toHaveBeenCalledTimes(1);
  expect(fx.create).toHaveBeenCalledTimes(1);
  await click("Create booking");
  expect(fx.createClient).toHaveBeenCalledTimes(1);
  expect(fx.create).toHaveBeenCalledTimes(2);
  expect(fx.create.mock.calls[1]![0].input.businessClientId).toBe("new-client");
  expect(fx.create.mock.calls[1]![0].input.idempotencyKey).toBe(fx.create.mock.calls[0]![0].input.idempotencyKey);
});
it("BC-F02 client creation failure never dispatches a booking", async () => {
  await newClientForm();
  fx.createClient.mockRejectedValueOnce(Error("Contact conflict"));
  await click("Create booking");
  expect(fx.create).not.toHaveBeenCalled();
});
it("BC-F02 coalesces rapid submission while new-client creation is pending", async () => {
  await newClientForm();
  let finish!: (value: unknown) => void;
  const result = new Promise(resolve => { finish = resolve; });
  fx.createClient.mockReturnValue(result);
  await act(async () => { button("Create booking").click(); button("Create booking").click(); });
  expect(fx.createClient).toHaveBeenCalledTimes(1);
  await act(async () => finish({ id: "new-client", firstName: "New", email: "new@example.com", phone: { countryCode: "+357", nationalNumber: "99123456" }, address: { city: "Larnaca", propertyType: "House", area: "Centre", streetName: "Main", streetNumber: "1" } }));
  expect(fx.create).toHaveBeenCalledTimes(1);
});
it("BC-F02 accepts an existing client without a structured address for an at-venue booking", async () => {
  await click("Change"); fx.omitAddress = true;
  const search = host.querySelector<HTMLInputElement>('input[placeholder^="Type a client"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, "Customer");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Customer +357 99112233 • test@example.com");
  await setup(fixed); await click("Slot 09:00"); await click("Create booking");
  expect(fx.create).toHaveBeenCalledTimes(1);
  expect(fx.create.mock.calls[0]![0].input.businessClientId).toBe("client");
});
it("BC-F02 sends the selected travel city with the booking address", async () => {
  await act(async () => root.render(<QueryClientProvider client={queryClient}><DashboardBookingForm businessId="business"
    visitType="TRAVEL_TO_CUSTOMER" onClose={() => undefined} onCreated={() => undefined} /></QueryClientProvider>));
  await setup(fixed); await click("Slot 09:00"); await click("Create booking");
  expect(fx.create.mock.calls[0]![0].input.travelAddress.city).toBe("Larnaca");
  expect(fx.create.mock.calls[0]![0].input.customerCity).toBe("Larnaca");
});
