/**
 * BOOKING-F1 — Venue hourly/per-person quantity and group availability party size.
 *
 * Part 1 unit-tests the pure helper. Part 2 renders the REAL Venue page (real React Query hooks,
 * real booking/catalog/package hooks) with only the transport (`apiRequest`) and the wizard's
 * presentational step components replaced, and asserts the exact availability params and
 * booking payloads the page sends.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvailabilityResult, AvailabilitySlot, BusinessCatalog, CatalogService } from "@/lib/api/catalog";
import { availabilityHours, availabilityPartySize, effectivePricingInput, stepPricingInput } from "@/app/venue/pricing-input";
import { bookingKeys } from "@/lib/bookings/hooks";
import { BooklyApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

const VENUE_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const base = { category: "Wellbeing", isFeatured: true, servedCities: [], assignedStaffMembershipIds: ["eeeeeeeeeeeeeeeeeeeeeeee", "ffffffffffffffffffffffff"] };
const groupService: CatalogService = {
  ...base, id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "Group class", isPackageDeal: false, pricingMode: "PER_PERSON",
  perPersonPricing: { ratePerPersonCents: 1500, minPersons: 2, maxPersons: 6, durationMin: 60 },
};
const hourlyService: CatalogService = {
  ...base, id: "cccccccccccccccccccccccc", name: "Studio hire", isPackageDeal: false, pricingMode: "HOURLY",
  hourlyPricing: { ratePerHourCents: 1000, minHours: 2, maxHours: 4 },
};
const fixedService: CatalogService = {
  ...base, id: "333333333333333333333333", name: "Massage", isPackageDeal: false, pricingMode: "FIXED",
  fixedPricing: { priceCents: 4500, durationMin: 60 },
};
const legacyPackage: CatalogService = {
  ...base, id: "dddddddddddddddddddddddd", name: "Legacy package", isPackageDeal: true,
  packagePricing: { bundlePriceCents: 12000, sessionsInPackage: 3, durationMin: 45 },
};
const catalog: BusinessCatalog = {
  business: {
    id: VENUE_ID, name: "Quantity Venue", category: "Wellbeing", subcategories: [], briefDescription: "Test fixture",
    visitType: "AT_BUSINESS_LOCATION", timezone: "UTC",
    address: { city: "Larnaca", area: "Centre", streetName: "Fixture Street", streetNumber: "1" },
    openStatus: { configured: true, isOpen: true, label: "Open now" }, hours: [], media: [],
  } as BusinessCatalog["business"],
  services: [groupService, hourlyService, fixedService, legacyPackage],
  staff: [
    { id: "eeeeeeeeeeeeeeeeeeeeeeee", firstName: "Small", role: "STAFF" },
    { id: "ffffffffffffffffffffffff", firstName: "Big", role: "STAFF" },
  ],
};
const firstClassOffers = [{ id: "fc-offer", businessId: VENUE_ID, name: "First-class offer" }];

/** Server-shaped availability: the 10:00 slot holds up to 6 people, but only `ffffffffffffffffffffffff` can
 * take a party larger than 2; the 11:00 slot has only 2 places left. Mirrors the API's own
 * filtering by `partySize` (availability.service.ts) — the client must not re-implement it. */
function availabilityFor(serviceId: string, params: { fromDate: string; partySize?: number; hours?: number }): AvailabilityResult {
  const date = `${params.fromDate.slice(0, 7)}-20`;
  const size = params.partySize ?? 1;
  const group = serviceId === groupService.id;
  const hours = serviceId === hourlyService.id ? params.hours ?? 2 : undefined;
  const slot = (hhmm: string, eligible: string[], remaining: number): AvailabilitySlot => ({
    startAt: `${date}T${hhmm}:00.000Z`,
    endAt: new Date(Date.parse(`${date}T${hhmm}:00.000Z`) + (hours ?? 1) * 3_600_000).toISOString(),
    eligibleStaffMembershipIds: eligible,
    ...(group ? { remainingCapacity: remaining } : {}), source: "AUTO",
  });
  const slots = group
    ? [
        ...(size <= 6 ? [slot("10:00", size > 2 ? ["ffffffffffffffffffffffff"] : ["eeeeeeeeeeeeeeeeeeeeeeee", "ffffffffffffffffffffffff"], 6)] : []),
        ...(size <= 2 ? [slot("11:00", ["eeeeeeeeeeeeeeeeeeeeeeee"], 2)] : []),
      ]
    : hours !== undefined && hours > 2
      ? [slot("10:00", ["ffffffffffffffffffffffff"], 1), ...(hours <= 3 ? [slot("11:00", ["ffffffffffffffffffffffff"], 1)] : [])]
      : [slot("10:00", ["eeeeeeeeeeeeeeeeeeeeeeee", "ffffffffffffffffffffffff"], 1), slot("11:00", ["eeeeeeeeeeeeeeeeeeeeeeee"], 1)];
  return { businessId: VENUE_ID, serviceId, timezone: "UTC", capacityMax: group ? 6 : 1, days: [{ date, isOpen: true, slots }] };
}

// ---------------------------------------------------------------------------------------------
// Transport + module mocks (hoisted)
// ---------------------------------------------------------------------------------------------

type Recorded = { method: string; url: string; params?: Record<string, unknown>; data?: Record<string, unknown> };
const fx = vi.hoisted(() => ({
  searchParams: "id=aaaaaaaaaaaaaaaaaaaaaaaa",
  requests: [] as Recorded[],
  committedBookings: {} as Record<string, string>,
  /** Optional per-request override for availability (used to delay a response). */
  availabilityOverride: undefined as undefined | ((params: Record<string, unknown>) => Promise<unknown> | undefined),
  venueServicesProps: undefined as undefined | { packages: unknown },
  respond: undefined as undefined | ((req: Recorded) => unknown),
  auth: { user: { id: "111111111111111111111111", role: "CUSTOMER", firstName: "Test" }, status: "authenticated", cacheEpoch: 1, isInitializing: false },
  authChanged: undefined as undefined | (() => void),
  stripeAvailable: false,
  stripeConfirm: vi.fn(async (_secret: string): Promise<{ error?: { message: string } }> => ({})),
  continueWizard: undefined as undefined | (() => void | Promise<void>),
  queryClient: undefined as undefined | QueryClient,
}));

vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: async (config: { method?: string; url?: string; params?: Record<string, unknown>; data?: Record<string, unknown> }) => {
    const req: Recorded = { method: config.method ?? "GET", url: config.url ?? "", params: config.params, data: config.data };
    fx.requests.push(req);
    if (req.url.endsWith("/availability") && fx.availabilityOverride) {
      const delayed = fx.availabilityOverride(req.params ?? {});
      if (delayed) return delayed;
    }
    const result = await fx.respond!(req);
    // P4A status fixtures attest only the Booking returned by this exact finalize,
    // never a requires_action response, redirect parameter or Stripe acknowledgement.
    if (req.url.endsWith("/bookings/finalize") && result && typeof result === "object" && "id" in result && typeof result.id === "string")
      fx.committedBookings[String(req.data?.idempotencyKey)] = result.id;
    return result;
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, back: () => undefined, refresh: () => undefined, prefetch: async () => undefined }),
  useSearchParams: () => new URLSearchParams(fx.searchParams),
  usePathname: () => "/venue",
}));
vi.mock("next/image", () => ({ default: ({ alt }: { alt?: string }) => <img alt={alt ?? ""} /> }));
vi.mock("next/link", () => ({ default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a> }));
vi.mock("@/lib/auth/store", async () => {
  const { useSyncExternalStore } = await import("react");
  const listeners = new Set<() => void>();
  fx.authChanged = () => { listeners.forEach((listener) => { listener(); }); };
  const logout = async () => "confirmed";
  let snapshot = fx.auth;
  let state = { ...snapshot, logout };
  const getState = () => {
    if (snapshot !== fx.auth) { snapshot = fx.auth; state = { ...snapshot, logout }; }
    return state;
  };
  return { useAuthStore: Object.assign(<T,>(selector: (s: ReturnType<typeof getState>) => T) =>
    useSyncExternalStore(
      (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
      () => selector(getState()),
    ), { getState }) };
});
vi.mock("@/lib/packages/view-hooks", () => ({
  usePackageView: () => ({ data: { packages: [{ id: "fc-offer", businessId: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "First-class offer" }] }, isPending: false, error: null }),
}));
vi.mock("@/lib/payments/stripe-client", () => ({ getStripe: async () =>
  fx.stripeAvailable ? { confirmCardPayment: fx.stripeConfirm } : null }));
vi.mock("@/components/Navbar", () => ({ default: () => <nav /> }));
vi.mock("@/components/Footer", () => ({ default: () => <footer /> }));
vi.mock("@/components/ServiceCard", () => ({
  default: ({ rec }: { rec: { id: string; title: string } }) => <div data-discovery-business={rec.id}>{rec.title}</div>,
}));
vi.mock("@/components/landing-page/Carousel", () => ({ default: () => <div /> }));
vi.mock("@/app/venue/components/VenueLocationMap", () => ({ default: () => <div /> }));
vi.mock("@/app/venue/components/VenueServices", () => ({
  default: (props: { services: CatalogService[]; packages: unknown; serviceLoading?: boolean; serviceError?: boolean; renderService: (s: CatalogService) => React.ReactNode }) => {
    fx.venueServicesProps = props;
    return <div data-catalog-loading={String(Boolean(props.serviceLoading))} data-catalog-error={String(Boolean(props.serviceError))}>{props.services.map((s) => <div key={s.id} data-service-card={s.id}>{props.renderService(s)}</div>)}</div>;
  },
}));
vi.mock("@/app/venue/components/AddonsStep", () => ({ default: () => <div /> }));
vi.mock("@/app/venue/components/ProfessionalsStep", () => ({
  default: ({ setSelectedProfessional }: { setSelectedProfessional: (id: string) => void }) => (
    <button onClick={() => setSelectedProfessional("ANY")}>Choose any professional</button>
  ),
}));
vi.mock("@/app/venue/components/TimeStep", () => ({
  default: ({ availability, onSelectDate, onSelectSlot, selectedSlot }: {
    availability?: AvailabilityResult; onSelectDate: (d: string) => void; onSelectSlot: (s: AvailabilitySlot) => void; selectedSlot?: AvailabilitySlot;
  }) => (
    <div data-testid="time-step">
      {(availability?.days ?? []).flatMap((day) => day.slots.map((slot) => (
        <button key={slot.startAt} aria-pressed={selectedSlot?.startAt === slot.startAt}
          onClick={() => { onSelectDate(day.date); onSelectSlot(slot); }}>{`Slot ${slot.startAt.slice(11, 16)}`}</button>
      )))}
    </div>
  ),
}));
vi.mock("@/app/venue/components/PaymentStep", () => ({
  default: ({ setHasSavedCard }: { setHasSavedCard: (v: boolean) => void }) => <button onClick={() => setHasSavedCard(true)}>Use saved card</button>,
}));
vi.mock("@/app/venue/components/ConfirmedStep", () => ({ default: () => <p>Booking confirmed</p> }));
vi.mock("@/app/venue/components/CheckoutSummaryAside", () => ({
  default: ({ onContinue, canContinue, preview }: { onContinue: () => void | Promise<void>; canContinue: boolean; preview?: { fixtureHours?: number } }) => {
    fx.continueWizard = onContinue;
    return <button data-preview-hours={preview?.fixtureHours} disabled={!canContinue} onClick={() => void onContinue()}>Wizard continue</button>;
  },
}));

import VenueDetailsPage from "@/app/venue/page";

// ---------------------------------------------------------------------------------------------
// Part 1 — pure helper
// ---------------------------------------------------------------------------------------------

describe("effectivePricingInput / stepPricingInput / availabilityPartySize", () => {
  it("F1-01: untouched HOURLY resolves to minHours (the displayed default)", () => {
    expect(effectivePricingInput(hourlyService, undefined)).toEqual({ hours: 2 });
    expect(effectivePricingInput(hourlyService, {})).toEqual({ hours: 2 });
  });
  it("F1-02: edited HOURLY is preserved", () => {
    expect(effectivePricingInput(hourlyService, { hours: 3 })).toEqual({ hours: 3 });
  });
  it("F1-03: untouched PER_PERSON resolves to minPersons", () => {
    expect(effectivePricingInput(groupService, undefined)).toEqual({ personCount: 2 });
    expect(availabilityPartySize(groupService, undefined)).toBe(2);
  });
  it("F1-04: edited PER_PERSON is preserved and becomes the party size", () => {
    expect(effectivePricingInput(groupService, { personCount: 5 })).toEqual({ personCount: 5 });
    expect(availabilityPartySize(groupService, { personCount: 5 })).toBe(5);
  });
  it("F1-08: only the field the pricing mode accepts is ever produced (stray fields dropped)", () => {
    expect(effectivePricingInput(hourlyService, { hours: 3, personCount: 9 })).toEqual({ hours: 3 });
    expect(effectivePricingInput(groupService, { hours: 3, personCount: 4 })).toEqual({ personCount: 4 });
    expect(effectivePricingInput(fixedService, { hours: 3, personCount: 4 })).toEqual({});
    expect(effectivePricingInput(legacyPackage, { hours: 3, personCount: 4 })).toEqual({});
  });
  it("F1-09: min/max — stored values outside the current range are clamped; steps stay in range", () => {
    expect(effectivePricingInput(hourlyService, { hours: 9 })).toEqual({ hours: 4 });
    expect(effectivePricingInput(hourlyService, { hours: 1 })).toEqual({ hours: 2 });
    expect(effectivePricingInput(groupService, { personCount: 50 })).toEqual({ personCount: 6 });
    expect(effectivePricingInput(groupService, { personCount: Number.NaN })).toEqual({ personCount: 2 });
    expect(stepPricingInput(groupService, undefined, -1)).toEqual({ personCount: 2 });
    expect(stepPricingInput(groupService, undefined, 1)).toEqual({ personCount: 3 });
    expect(stepPricingInput(groupService, { personCount: 6 }, 1)).toEqual({ personCount: 6 });
    expect(stepPricingInput(hourlyService, { hours: 4 }, 1)).toEqual({ hours: 4 });
    expect(stepPricingInput(hourlyService, undefined, -1)).toEqual({ hours: 2 });
    // An out-of-range stale value steps from the clamped value, never from the stale one.
    expect(stepPricingInput(groupService, { personCount: 50 }, -1)).toEqual({ personCount: 5 });
  });
  it("F1-10: FIXED and Package Deal take no quantity and no party size", () => {
    expect(effectivePricingInput(fixedService, undefined)).toEqual({});
    expect(availabilityPartySize(fixedService, undefined)).toBeUndefined();
    expect(availabilityPartySize(hourlyService, { hours: 3 })).toBeUndefined();
    expect(effectivePricingInput(legacyPackage, undefined)).toEqual({});
    expect(stepPricingInput(fixedService, undefined, 1)).toEqual({});
  });
});

// ---------------------------------------------------------------------------------------------
// Part 2 — real Venue page
// ---------------------------------------------------------------------------------------------

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;

const defaultRespond = (req: Recorded): unknown => {
  const { url } = req;
  if (url.endsWith("/bookings/operations/payment-status")) {
    const key = String(req.params?.idempotencyKey), bookingId = fx.committedBookings[key];
    return { businessId: VENUE_ID, idempotencyKey: key, state: bookingId ? "COMMITTED" : "UNRESOLVED", ...(bookingId ? { bookingId } : {}) };
  }
  if (url.endsWith("/availability")) {
    const serviceId = url.split("/services/")[1]!.split("/")[0]!;
    return availabilityFor(serviceId, req.params as { fromDate: string; partySize?: number });
  }
  if (url.endsWith("/addons")) return { addons: [] };
  if (url.endsWith("/reviews/summary")) return { averageRating: null, reviewCount: 0 };
  if (url.endsWith("/reviews")) return { reviews: [], pagination: { page: 1, limit: 5, total: 0 } };
  if (url === `/catalog/businesses/${VENUE_ID}`) return catalog;
  if (url === "/me/favorites/ids") return { businessIds: [] };
  if (url.endsWith("/preview")) return { lines: [], totals: {} };
  if (url.endsWith("/finalize") || url.endsWith("/purchase")) return { id: "booking-1", status: "UPCOMING" };
  return {};
};

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  fx.committedBookings = {};
  fx.auth = { user: { id: "111111111111111111111111", role: "CUSTOMER", firstName: "Test" }, status: "authenticated", cacheEpoch: 1, isInitializing: false };
  fx.stripeAvailable = false;
  fx.stripeConfirm.mockReset().mockResolvedValue({});
  fx.continueWizard = undefined;
  fx.searchParams = "id=aaaaaaaaaaaaaaaaaaaaaaaa";
  fx.requests.length = 0;
  fx.availabilityOverride = undefined;
  fx.venueServicesProps = undefined;
  fx.respond = defaultRespond;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
  fx.queryClient = client;
  await act(async () => root.render(<QueryClientProvider client={client}><VenueDetailsPage /></QueryClientProvider>));
  await waitFor(() => expect(card(groupService.id)).toBeTruthy());
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function waitFor(check: () => void, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  for (;;) {
    try { check(); return; } catch (error) { if (Date.now() - started > timeoutMs) throw error; }
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
}
const card = (serviceId: string) => host.querySelector(`[data-service-card="${serviceId}"]`) as HTMLElement | null;
const buttonIn = (scope: ParentNode, predicate: (b: HTMLButtonElement) => boolean, label: string) => {
  const found = [...scope.querySelectorAll("button")].find(predicate);
  if (!found) throw Error(`Missing button: ${label}`);
  return found;
};
const byText = (text: string) => buttonIn(host, (b) => b.textContent?.trim() === text, text);
async function click(button: HTMLButtonElement) { await act(async () => { button.click(); }); }
async function press(serviceId: string, sign: "+" | "-", times = 1) {
  for (let i = 0; i < times; i += 1) await click(buttonIn(card(serviceId)!, (b) => b.textContent?.trim() === sign, sign));
}
const stepperValue = (serviceId: string) =>
  buttonIn(card(serviceId)!, (b) => b.textContent?.trim() === "-", "-").nextElementSibling?.textContent?.trim();
const availabilityRequests = (serviceId: string) =>
  fx.requests.filter((r) => r.url.endsWith(`/services/${serviceId}/availability`));
const posts = (suffix: string) => fx.requests.filter((r) => r.method === "POST" && r.url.endsWith(suffix));
const lastPost = (suffix: string) => posts(suffix).at(-1)?.data as
  | { serviceLines: Array<{ serviceId: string; staffMembershipId: string; addonIds: string[]; pricingInput: Record<string, unknown> }>; startAt: string; idempotencyKey: string; promoCode?: string; notes?: string }
  | undefined;

async function openWizard(service: CatalogService) {
  await click(buttonIn(card(service.id)!, (b) => b.getAttribute("aria-label") === `Book ${service.name}`, `Book ${service.name}`));
}
/** addons → professionals ("any") → time. */
async function advanceToTime() {
  await waitFor(() => expect(byText("Wizard continue").disabled).toBe(false));
  await click(byText("Wizard continue")); // addons → professionals
  await click(byText("Choose any professional"));
  await waitFor(() => expect(byText("Wizard continue").disabled).toBe(false));
  await click(byText("Wizard continue")); // professionals → time
}
async function selectSlot(hhmm: string) {
  await waitFor(() => byText(`Slot ${hhmm}`));
  await click(byText(`Slot ${hhmm}`));
}
async function closeWizard() {
  await click(buttonIn(host, (b) => b.getAttribute("aria-label") === "Close modal", "Close modal"));
}
async function payAndConfirm() {
  await waitFor(() => expect(byText("Wizard continue").disabled).toBe(false));
  await click(byText("Wizard continue")); // time → payment
  await click(byText("Use saved card"));
  await waitFor(() => expect(byText("Wizard continue").disabled).toBe(false));
  await click(byText("Wizard continue")); // finalize
  await waitFor(() => expect(host.textContent).toContain("Booking confirmed"));
}

describe("Venue page — HOURLY quantity (V-1)", () => {
  it("F1-P1: untouched hourly stepper sends minHours in preview AND finalize; no partySize", async () => {
    expect(stepperValue(hourlyService.id)).toBe("2");
    expect(card(hourlyService.id)!.textContent).toContain("€20.00");
    await openWizard(hourlyService);
    await advanceToTime();
    await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]!.pricingInput).toEqual({ hours: 2 }));
    for (const r of availabilityRequests(hourlyService.id)) {
      expect(r.params?.partySize).toBeUndefined();
      expect(r.params?.hours).toBe(2);
    }
    await payAndConfirm();
    expect(lastPost("/bookings/finalize")?.serviceLines[0]!.pricingInput).toEqual({ hours: 2 });
  });

  it("F1-P2/P9: edited hourly quantity is displayed, priced and sent; clamps at max", async () => {
    await press(hourlyService.id, "+");
    expect(stepperValue(hourlyService.id)).toBe("3");
    expect(card(hourlyService.id)!.textContent).toContain("€30.00");
    await press(hourlyService.id, "+", 5);
    expect(stepperValue(hourlyService.id)).toBe("4");
    await press(hourlyService.id, "-", 9);
    expect(stepperValue(hourlyService.id)).toBe("2");
    await press(hourlyService.id, "+");
    await openWizard(hourlyService);
    await advanceToTime();
    await selectSlot("11:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]!.pricingInput).toEqual({ hours: 3 }));
    expect(availabilityRequests(hourlyService.id).at(-1)?.params?.hours).toBe(3);
    await payAndConfirm();
    expect(lastPost("/bookings/finalize")?.serviceLines[0]!.pricingInput).toEqual({ hours: 3 });
  });
});

describe("Venue page — PER_PERSON quantity and party size (V-1, V-2)", () => {
  it("F1-P3/P5: untouched group stepper sends minPersons as personCount and availability partySize", async () => {
    expect(stepperValue(groupService.id)).toBe("2");
    expect(card(groupService.id)!.textContent).toContain("€30.00");
    await openWizard(groupService);
    await advanceToTime();
    await waitFor(() => expect(availabilityRequests(groupService.id).length).toBeGreaterThan(0));
    for (const r of availabilityRequests(groupService.id)) expect(r.params?.partySize).toBe(2);
    await selectSlot("11:00"); // only offered for parties of up to 2
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]!.pricingInput).toEqual({ personCount: 2 }));
    await payAndConfirm();
    expect(lastPost("/bookings/finalize")?.serviceLines[0]!.pricingInput).toEqual({ personCount: 2 });
  });

  it("F1-P4/P5: edited party size is sent to availability, slots follow the server, payload matches", async () => {
    await press(groupService.id, "+");
    expect(stepperValue(groupService.id)).toBe("3");
    expect(card(groupService.id)!.textContent).toContain("€45.00");
    await openWizard(groupService);
    await advanceToTime();
    await waitFor(() => byText("Slot 10:00"));
    for (const r of availabilityRequests(groupService.id)) expect(r.params?.partySize).toBe(3);
    // The server did not offer 11:00 for 3 people, so the page does not show it.
    expect(host.textContent).not.toContain("Slot 11:00");
    await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]).toMatchObject({
      pricingInput: { personCount: 3 }, staffMembershipId: "ffffffffffffffffffffffff",
    }));
  });

  it("F1-P6: changing the party size clears a slot chosen for the old size (no stale eligible staff)", async () => {
    await openWizard(groupService);
    await advanceToTime();
    await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]).toMatchObject({
      pricingInput: { personCount: 2 }, staffMembershipId: "eeeeeeeeeeeeeeeeeeeeeeee",
    }));
    await closeWizard();
    await press(groupService.id, "+"); // 3 people: eeeeeeeeeeeeeeeeeeeeeeee can no longer take the 10:00 slot
    await click(byText("Continue →")); // re-enter WITHOUT re-selecting the Service
    await advanceToTime();
    await waitFor(() => byText("Slot 10:00"));
    expect(byText("Slot 10:00").getAttribute("aria-pressed")).toBe("false");
    expect(byText("Wizard continue").disabled).toBe(true);
    // No quote was ever requested for 3 people with the slot/staff selected for 2.
    for (const p of posts("/bookings/preview")) {
      const line = (p.data as NonNullable<ReturnType<typeof lastPost>>).serviceLines[0]!;
      if (line.pricingInput.personCount === 3) expect(line.staffMembershipId).toBe("ffffffffffffffffffffffff");
    }
    await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]).toMatchObject({
      pricingInput: { personCount: 3 }, staffMembershipId: "ffffffffffffffffffffffff",
    }));
  });

  it("F1-P7: rapid changes request only the final size; a late response for an old size is never shown", async () => {
    // Size 2: hold the response.
    const held: { release?: (value: unknown) => void } = {};
    fx.availabilityOverride = (params) =>
      params.partySize === 2 ? new Promise((resolve) => { held.release = resolve; }) : undefined;
    await openWizard(groupService);
    await advanceToTime();
    await waitFor(() => expect(held.release).toBeDefined());
    await closeWizard();
    await press(groupService.id, "+", 4); // 2 → 6, rapid
    await press(groupService.id, "-", 2); // 6 → 4
    expect(stepperValue(groupService.id)).toBe("4");
    await click(byText("Continue →"));
    await advanceToTime();
    await waitFor(() => byText("Slot 10:00"));
    // Late, out-of-order answer for the OLD size (would offer 11:00 and eeeeeeeeeeeeeeeeeeeeeeee).
    await act(async () => { held.release!(availabilityFor(groupService.id, { fromDate: availabilityRequests(groupService.id)[0]!.params!.fromDate as string, partySize: 2 })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(host.textContent).not.toContain("Slot 11:00");
    const sizes = availabilityRequests(groupService.id).map((r) => r.params?.partySize);
    expect(sizes).toEqual([2, 4]); // never 3, 5 or 6: only the size in effect when Time opened
    await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]).toMatchObject({
      pricingInput: { personCount: 4 }, staffMembershipId: "ffffffffffffffffffffffff",
    }));
  });
});

describe("Venue page — switching service types and unaffected flows", () => {
  it("F1-P8: switching services never carries a quantity across; edited values are kept per service", async () => {
    await press(groupService.id, "+", 2); // group = 4
    await openWizard(hourlyService);
    await advanceToTime();
    await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]!.pricingInput).toEqual({ hours: 2 }));
    for (const r of availabilityRequests(hourlyService.id)) expect(r.params?.partySize).toBeUndefined();
    await closeWizard();

    await openWizard(fixedService);
    await advanceToTime();
    await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]).toMatchObject({ serviceId: fixedService.id, pricingInput: {} }));
    for (const r of availabilityRequests(fixedService.id)) {
      expect(r.params?.partySize).toBeUndefined();
      expect(r.params?.hours).toBeUndefined();
    }
    await closeWizard();

    await openWizard(groupService);
    await advanceToTime();
    await waitFor(() => byText("Slot 10:00"));
    for (const r of availabilityRequests(groupService.id)) {
      expect(r.params?.partySize).toBe(4);
      expect(r.params?.hours).toBeUndefined();
    }
  });

  it("F1-P10/P11: FIXED booking payload is unchanged ({} quantity) and finalize repeats the quoted request", async () => {
    expect([...card(fixedService.id)!.querySelectorAll("button")].some((b) => b.textContent?.trim() === "-")).toBe(false);
    expect(card(fixedService.id)!.textContent).toContain("€45.00");
    await openWizard(fixedService);
    await advanceToTime();
    await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")).toBeDefined());
    await payAndConfirm();
    const quoted = lastPost("/bookings/preview")!;
    const finalized = lastPost("/bookings/finalize")!;
    expect(finalized).toEqual(quoted);
    expect(finalized.serviceLines).toEqual([
      { serviceId: fixedService.id, staffMembershipId: "eeeeeeeeeeeeeeeeeeeeeeee", addonIds: [], pricingInput: {} },
    ]);
    expect(typeof finalized.idempotencyKey).toBe("string");
    expect(finalized.promoCode).toBeUndefined();
  });

  it("F1-P12: legacy package card and purchase payload unchanged; first-class offers passed through untouched", async () => {
    const pkg = card(legacyPackage.id)!;
    expect(pkg.textContent).toContain("Package total");
    expect(pkg.textContent).toContain("€120.00");
    expect([...pkg.querySelectorAll("button")].some((b) => b.textContent?.trim() === "-")).toBe(false);
    expect(fx.venueServicesProps?.packages).toEqual(firstClassOffers);
    await openWizard(legacyPackage);
    await advanceToTime();
    await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/packages/preview")?.serviceLines[0]!.pricingInput).toEqual({}));
    expect(posts("/bookings/preview").filter((p) => !p.url.includes("/packages/"))).toHaveLength(0);
    for (const r of availabilityRequests(legacyPackage.id)) expect(r.params?.partySize).toBeUndefined();
  });
});

// F1B extends the original F1 coverage without replacing its group/payment/package assertions.
describe("Venue page — duration-aware availability (F1B)", () => {
  it("a quote completing after duration changes cannot become the current booking preview", async () => {
    let resolveOld!: (value: unknown) => void;
    const pending = new Promise((resolve) => { resolveOld = resolve; });
    fx.respond = (req) => {
      if (req.url.endsWith("/bookings/preview")) {
        const hours = (req.data as NonNullable<ReturnType<typeof lastPost>>).serviceLines[0]!.pricingInput.hours;
        return hours === 2 ? pending : { fixtureHours: hours, lines: [], totals: {} };
      }
      return defaultRespond(req);
    };
    await openWizard(hourlyService); await advanceToTime(); await selectSlot("10:00");
    await waitFor(() => expect(posts("/bookings/preview").length).toBeGreaterThan(0));
    await closeWizard(); await press(hourlyService.id, "+", 2);
    await click(byText("Continue →")); await advanceToTime();
    await act(async () => { resolveOld({ fixtureHours: 2, lines: [], totals: {} }); });
    expect(byText("Wizard continue").getAttribute("data-preview-hours")).toBeNull();
    expect(byText("Wizard continue").disabled).toBe(true);
    await selectSlot("10:00");
    await waitFor(() => expect(byText("Wizard continue").getAttribute("data-preview-hours")).toBe("4"));
  });
  it("uses the same helper authority for fractional duration and omits duration for other modes", () => {
    expect(availabilityHours(hourlyService, undefined)).toBe(2);
    expect(availabilityHours(hourlyService, { hours: 2.5 })).toBe(2.5);
    for (const service of [fixedService, groupService, legacyPackage]) {
      expect(availabilityHours(service, { hours: 3 })).toBeUndefined();
    }
  });
  it("duration change invalidates a selected slot even when its start remains; staff and quote are refreshed", async () => {
    await openWizard(hourlyService);
    await advanceToTime();
    await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]).toMatchObject({
      pricingInput: { hours: 2 }, staffMembershipId: "eeeeeeeeeeeeeeeeeeeeeeee",
    }));
    await closeWizard();
    await press(hourlyService.id, "+", 2);
    await click(byText("Continue →"));
    await advanceToTime();
    await waitFor(() => expect(availabilityRequests(hourlyService.id).at(-1)?.params?.hours).toBe(4));
    await waitFor(() => byText("Slot 10:00"));
    expect(host.textContent).not.toContain("Slot 11:00");
    expect(byText("Slot 10:00").getAttribute("aria-pressed")).toBe("false");
    expect(byText("Wizard continue").disabled).toBe(true);
    await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]).toMatchObject({
      pricingInput: { hours: 4 }, staffMembershipId: "ffffffffffffffffffffffff",
    }));
    await payAndConfirm();
    expect(lastPost("/bookings/finalize")?.serviceLines[0]).toMatchObject({ pricingInput: { hours: 4 }, staffMembershipId: "ffffffffffffffffffffffff" });
  });
  it("a late two-hour response cannot replace four-hour slots or staff eligibility", async () => {
    let resolveOld!: (value: unknown) => void;
    const pending = new Promise((resolve) => { resolveOld = resolve; });
    let oldParams: Record<string, unknown> | undefined;
    fx.availabilityOverride = (params) => {
      if (params.hours === 2) { oldParams = params; return pending; }
      return undefined;
    };
    await openWizard(hourlyService);
    await advanceToTime();
    await waitFor(() => expect(oldParams?.hours).toBe(2));
    await closeWizard();
    await press(hourlyService.id, "+", 2);
    await click(byText("Continue →"));
    await advanceToTime();
    await waitFor(() => byText("Slot 10:00"));
    await act(async () => { resolveOld(availabilityFor(hourlyService.id, oldParams as { fromDate: string; hours: number })); });
    expect(host.textContent).not.toContain("Slot 11:00");
    await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]).toMatchObject({ pricingInput: { hours: 4 }, staffMembershipId: "ffffffffffffffffffffffff" }));
  });
});

// F2A: these sections have no supported branch/service-proximity contract and are removed.
describe("Venue page — unsupported discovery rows removed (F2A)", () => {
  const expectNoInventedDiscovery = () => {
    expect(host.textContent).not.toContain("Other locations");
    expect(host.textContent).not.toContain("Services nearby");
    for (const name of ["Soho Vintage Barbers", "Zara Hair & Beauty", "Gold Gym Spa & Massage", "Elite Car Detailing"]) {
      expect(host.textContent).not.toContain(name);
    }
    expect(host.querySelectorAll("[data-discovery-business]")).toHaveLength(0);
    expect(host.querySelector('a[href*="id=2001"], a[href*="id=2002"], a[href*="id=2003"], a[href*="id=2004"]')).toBeNull();
    expect(fx.requests.filter((req) => req.url.startsWith("/discovery/"))).toHaveLength(0);
  };

  it("shows only transport-backed venue services; current venue is not another location", () => {
    expect(host.textContent).toContain(catalog.business.name);
    for (const service of catalog.services) expect(card(service.id)?.textContent).toContain(service.name);
    expectNoInventedDiscovery();
    const catalogReads = fx.requests.filter((req) => req.url === `/catalog/businesses/${VENUE_ID}`);
    expect(catalogReads).toHaveLength(1);
  });

  it.each(["empty", "loading", "error", "catalog omits a service"] as const)("%s catalog never produces fallback discovery records or headings", async (state) => {
    const pending = new Promise<unknown>(() => undefined);
    fx.respond = (req) => {
      if (req.url === `/catalog/businesses/${VENUE_ID}`) {
        if (state === "loading") return pending;
        if (state === "error") throw new Error("Catalog unavailable");
        return { ...catalog, services: state === "empty" ? [] : catalog.services.filter((service) => service.id !== fixedService.id) };
      }
      return defaultRespond(req);
    };
    const freshClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
    await act(async () => root.render(<QueryClientProvider key={state} client={freshClient}><VenueDetailsPage /></QueryClientProvider>));
    if (state === "catalog omits a service") {
      await waitFor(() => expect(card(hourlyService.id)).toBeTruthy());
      expect(card(fixedService.id)).toBeNull();
    }
    if (state === "empty") {
      await waitFor(() => expect(host.querySelector('[data-catalog-loading="false"]')).not.toBeNull());
      expect(host.querySelectorAll("[data-service-card]")).toHaveLength(0);
    }
    if (state === "loading") expect(host.querySelector('[data-catalog-loading="true"]')).not.toBeNull();
    if (state === "error") await waitFor(() => expect(host.querySelector('[data-catalog-error="true"]')).not.toBeNull());
    expectNoInventedDiscovery();
  });

  it("real fixed service still reaches preview/finalize with original business/service identity", async () => {
    await openWizard(fixedService); await advanceToTime(); await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]?.serviceId).toBe(fixedService.id));
    await payAndConfirm();
    expect(posts("/bookings/finalize").at(-1)?.url).toBe(`/businesses/${VENUE_ID}/bookings/finalize`);
    expect(lastPost("/bookings/finalize")?.serviceLines[0]).toMatchObject({ serviceId: fixedService.id, pricingInput: {} });
    expectNoInventedDiscovery();
  });

  it("hourly and group controls keep their display, quantity authority and availability params without discovery fetches", async () => {
    await press(hourlyService.id, "+");
    expect(stepperValue(hourlyService.id)).toBe("3");
    await openWizard(hourlyService); await advanceToTime(); await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]?.pricingInput).toEqual({ hours: 3 }));
    expect(availabilityRequests(hourlyService.id).at(-1)?.params?.hours).toBe(3);
    await closeWizard(); await press(groupService.id, "+");
    expect(stepperValue(groupService.id)).toBe("3");
    await openWizard(groupService); await advanceToTime(); await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]?.pricingInput).toEqual({ personCount: 3 }));
    expect(availabilityRequests(groupService.id).at(-1)?.params?.partySize).toBe(3);
    expectNoInventedDiscovery();
  });
});

// F2B Book Again is a navigation hint, never a historical request/payment replay.
describe("Venue page — Book Again preselection (F2B)", () => {
  async function arrive(serviceId: string) {
    fx.searchParams = `id=${VENUE_ID}&serviceId=${serviceId}`;
    fx.requests.length = 0;
    const freshClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
    await act(async () => root.render(<QueryClientProvider key={`book-again-${serviceId}`} client={freshClient}><VenueDetailsPage /></QueryClientProvider>));
    await waitFor(() => expect(card(fixedService.id)).toBeTruthy());
  }
  it.each([fixedService, hourlyService, groupService])("preselects current $pricingMode service, requires live availability/quote and sends a NEW booking", async (service) => {
    await arrive(service.id);
    await waitFor(() => byText("Wizard continue"));
    expect(posts("/bookings/preview")).toHaveLength(0);
    expect(posts("/bookings/finalize")).toHaveLength(0);
    expect(availabilityRequests(service.id)).toHaveLength(0);
    await advanceToTime(); await selectSlot("10:00");
    const expected = service === hourlyService ? { hours: 2 } : service === groupService ? { personCount: 2 } : {};
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]).toMatchObject({ serviceId: service.id, pricingInput: expected }));
    expect(availabilityRequests(service.id).length).toBeGreaterThan(0);
    expect(posts("/bookings/finalize")).toHaveLength(0);
    await payAndConfirm();
    const input = lastPost("/bookings/finalize")!;
    expect(input.serviceLines).toHaveLength(1); // no historical multi-line request is replayed
    expect(input.serviceLines[0]).toMatchObject({ serviceId: service.id, pricingInput: expected });
    expect(input).not.toHaveProperty("originalBookingId");
    expect(input).not.toHaveProperty("paymentIntentId");
    expect(input.idempotencyKey).toBeTruthy();
    expect(host.textContent).not.toContain("Other locations");
    expect(host.textContent).not.toContain("Services nearby");
  });
  it("ignores removed/inactive or first-class package hints absent from the current catalog", async () => {
    await arrive("unavailable-or-first-class-service");
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Wizard continue")).toBe(false);
    expect(posts("/bookings/preview")).toHaveLength(0);
    expect(posts("/bookings/finalize")).toHaveLength(0);
  });
  it("uses current catalog pricing and defaults rather than a previous booking's price/quantity", async () => {
    fx.respond = (req) => req.url === `/catalog/businesses/${VENUE_ID}` ? {
      ...catalog, services: catalog.services.map((service) => service.id === hourlyService.id ? {
        ...service, hourlyPricing: { ratePerHourCents: 2500, minHours: 3, maxHours: 5 },
      } : service),
    } : defaultRespond(req);
    await arrive(hourlyService.id);
    expect(stepperValue(hourlyService.id)).toBe("3");
    expect(card(hourlyService.id)!.textContent).toContain("€75.00");
    expect(posts("/bookings/preview")).toHaveLength(0);
    await advanceToTime(); await selectSlot("10:00");
    await waitFor(() => expect(lastPost("/bookings/preview")?.serviceLines[0]!.pricingInput).toEqual({ hours: 3 }));
    expect(availabilityRequests(hourlyService.id).at(-1)?.params?.hours).toBe(3);
  });
  it("a legacy package hint enters only the supported new purchase wizard and never redeems credits on navigation", async () => {
    await arrive(legacyPackage.id);
    await waitFor(() => byText("Wizard continue"));
    expect(fx.requests.filter((req) => req.method === "POST")).toHaveLength(0);
    await advanceToTime(); await selectSlot("10:00");
    await waitFor(() => expect(posts("/bookings/packages/preview").length).toBeGreaterThan(0));
    expect(posts("/bookings/packages/purchase")).toHaveLength(0);
    expect(fx.requests.some((req) => /redeem|consent/.test(req.url))).toBe(false);
  });
});

// F3B: transport/Stripe mocks exercise the real page and real finalize/query hooks.
describe("F3B payment continuation and authoritative confirmation", () => {
  const requiresAction = { status: "requires_action", clientSecret: "synthetic_client_secret", paymentIntentId: "pi_synthetic" };
  async function readyToPay() {
    await openWizard(fixedService);
    await advanceToTime();
    await selectSlot("10:00");
    await click(byText("Wizard continue"));
    await click(byText("Use saved card"));
    await waitFor(() => expect(byText("Wizard continue").disabled).toBe(false));
  }
  function finalizeResponses(respond: (count: number) => unknown) {
    let count = 0;
    fx.respond = (req) => req.url.endsWith("/bookings/finalize") ? respond(++count) : defaultRespond(req);
  }
  function expectNoConfirmation() { expect(host.textContent).not.toContain("Booking confirmed"); }

  it("P4A keeps the real wizard pending when the original status has not verified finalization", async () => {
    finalizeResponses(() => ({ id: "awaiting-finalization", status: "UPCOMING" }));
    const respond = fx.respond!;
    fx.respond = (req) => req.url.endsWith("/bookings/operations/payment-status")
      ? { state: "FINALIZATION_PENDING", businessId: VENUE_ID, idempotencyKey: req.params?.idempotencyKey }
      : respond(req);
    await readyToPay(); await click(byText("Wizard continue"));
    await waitFor(() => expect(host.textContent).toContain("Booking finalization is pending"));
    expectNoConfirmation(); expect(posts("/bookings/finalize")).toHaveLength(1);
  });

  it("confirms only after the same-input server retry returns a persisted Booking", async () => {
    fx.stripeAvailable = true;
    finalizeResponses((count) => count === 1 ? requiresAction : { id: "f3b-confirmed", status: "UPCOMING" });
    await readyToPay();
    await click(byText("Wizard continue"));
    await waitFor(() => expect(host.textContent).toContain("Booking confirmed"));
    expect(fx.stripeConfirm).toHaveBeenCalledWith("synthetic_client_secret");
    expect(posts("/bookings/finalize")).toHaveLength(2);
    expect(posts("/bookings/finalize")[0]!.data).toEqual(posts("/bookings/finalize")[1]!.data);
    expect(fx.queryClient!.getQueryData(bookingKeys.customerDetail("f3b-confirmed"))).toMatchObject({ id: "f3b-confirmed" });
  });

  it("keeps an abandoned/failed challenge unconfirmed and reuses its key on explicit retry", async () => {
    fx.stripeAvailable = true;
    fx.stripeConfirm.mockResolvedValue({ error: { message: "Authentication cancelled" } });
    finalizeResponses(() => requiresAction);
    await readyToPay();
    await click(byText("Wizard continue"));
    await waitFor(() => expect(host.textContent).toContain("Authentication cancelled"));
    expectNoConfirmation();
    const key = lastPost("/bookings/finalize")!.idempotencyKey;
    await click(byText("Wizard continue"));
    await waitFor(() => expect(posts("/bookings/finalize")).toHaveLength(2));
    expect(lastPost("/bookings/finalize")!.idempotencyKey).toBe(key);
    expectNoConfirmation();
  });

  it("does not infer completion from a successful challenge when the server still requires action", async () => {
    fx.stripeAvailable = true;
    finalizeResponses(() => requiresAction);
    await readyToPay();
    await click(byText("Wizard continue"));
    await waitFor(() => expect(posts("/bookings/finalize")).toHaveLength(2));
    await waitFor(() => expect(host.textContent).toContain("Payment could not be confirmed"));
    expectNoConfirmation();
    expect(posts("/bookings/finalize")[0]!.data).toEqual(posts("/bookings/finalize")[1]!.data);
  });

  it("rejects simultaneous Confirm handler invocations before React pending state renders", async () => {
    const pending = Promise.withResolvers<unknown>();
    finalizeResponses(() => pending.promise);
    await readyToPay();
    await act(async () => { void fx.continueWizard!(); void fx.continueWizard!(); });
    await waitFor(() => expect(posts("/bookings/finalize")).toHaveLength(1));
    expectNoConfirmation();
    await act(async () => { pending.resolve({ id: "single-confirm", status: "UPCOMING" }); });
    await waitFor(() => expect(host.textContent).toContain("Booking confirmed"));
  });

  it("retains its logical key after an unclassified network failure rather than inventing a new operation", async () => {
    finalizeResponses((count) => count === 1 ? Promise.reject(new Error("synthetic connection lost")) : { id: "resumed", status: "UPCOMING" });
    await readyToPay();
    await click(byText("Wizard continue"));
    await waitFor(() => expect(posts("/bookings/finalize")).toHaveLength(1));
    await waitFor(() => expect(host.textContent).toContain("synthetic connection lost"));
    await waitFor(() => expect(byText("Wizard continue").disabled).toBe(false));
    expectNoConfirmation();
    const key = lastPost("/bookings/finalize")!.idempotencyKey;
    await click(byText("Wizard continue"));
    await waitFor(() => expect(host.textContent).toContain("Booking confirmed"));
    expect(lastPost("/bookings/finalize")!.idempotencyKey).toBe(key);
  });

  it("leaves a delayed/uncertain server retry unconfirmed and keeps its original identity", async () => {
    fx.stripeAvailable = true;
    finalizeResponses((count) => count === 1 ? requiresAction : count === 2
      ? Promise.reject(new BooklyApiError({ message: "Still processing", status: 503 }))
      : { id: "eventually-confirmed", status: "UPCOMING" });
    await readyToPay();
    await click(byText("Wizard continue"));
    await waitFor(() => expect(host.textContent).toContain("Still processing"));
    expectNoConfirmation();
    await click(byText("Wizard continue"));
    await waitFor(() => expect(host.textContent).toContain("Booking confirmed"));
    const requests = posts("/bookings/finalize");
    expect(requests).toHaveLength(3);
    expect(requests[0]!.data).toEqual(requests[1]!.data);
    expect(requests[1]!.data).toEqual(requests[2]!.data);
  });

  it("does not confirm a declined or invalidated request", async () => {
    finalizeResponses(() => Promise.reject(new BooklyApiError({ message: "Payment declined", status: 402, code: "PAYMENT_FAILED" })));
    await readyToPay();
    await click(byText("Wizard continue"));
    await waitFor(() => expect(posts("/bookings/finalize")).toHaveLength(1));
    await waitFor(() => expect(host.textContent).toContain("Payment declined"));
    await waitFor(() => expect(byText("Wizard continue").disabled).toBe(false));
    expectNoConfirmation();
    expect(fx.stripeConfirm).not.toHaveBeenCalled();
  });

  it.each(["account", "epoch", "logout"])("ignores an old finalize response/cache seed after %s change", async (change) => {
    const pending = Promise.withResolvers<unknown>();
    finalizeResponses(() => pending.promise);
    await readyToPay();
    await click(byText("Wizard continue"));
    await waitFor(() => expect(posts("/bookings/finalize")).toHaveLength(1));
    await act(async () => {
      fx.auth = { ...fx.auth,
        user: { ...fx.auth.user, id: change === "account" ? "222222222222222222222222" : "111111111111111111111111" },
        cacheEpoch: change === "epoch" ? 2 : 1,
        status: change === "logout" ? "unauthenticated" : "authenticated",
      };
      fx.authChanged!();
    });
    await act(async () => { pending.resolve({ id: "old-private-booking", status: "UPCOMING" }); });
    expectNoConfirmation();
    expect(fx.queryClient!.getQueryData(bookingKeys.customerDetail("old-private-booking"))).toBeUndefined();
    expect(fx.stripeConfirm).not.toHaveBeenCalled();
  });

  it("does not post a 3DS retry after the Customer changes during a delayed challenge", async () => {
    const challenge = Promise.withResolvers<{ error?: { message: string } }>();
    fx.stripeAvailable = true;
    fx.stripeConfirm.mockImplementation(() => challenge.promise);
    finalizeResponses(() => requiresAction);
    await readyToPay();
    await click(byText("Wizard continue"));
    await waitFor(() => expect(fx.stripeConfirm).toHaveBeenCalledOnce());
    await act(async () => {
      fx.auth = { ...fx.auth, user: { ...fx.auth.user, id: "222222222222222222222222" }, cacheEpoch: 2 };
      fx.authChanged!();
      challenge.resolve({});
    });
    expect(posts("/bookings/finalize")).toHaveLength(1);
    expectNoConfirmation();
  });

  it("refuses dispatch if the session changes between Confirm and the mutation transport", async () => {
    await readyToPay();
    await act(async () => {
      void fx.continueWizard!();
      fx.auth = { ...fx.auth, user: { ...fx.auth.user, id: "222222222222222222222222" }, cacheEpoch: 2 };
      fx.authChanged!();
    });
    expect(posts("/bookings/finalize")).toHaveLength(0);
    expectNoConfirmation();
  });

  it("does not reopen confirmation after the wizard was closed during a pending response", async () => {
    const pending = Promise.withResolvers<unknown>();
    finalizeResponses(() => pending.promise);
    await readyToPay();
    await click(byText("Wizard continue"));
    await waitFor(() => expect(posts("/bookings/finalize")).toHaveLength(1));
    await closeWizard();
    await act(async () => { pending.resolve({ id: "closed-booking", status: "UPCOMING" }); });
    expectNoConfirmation();
    expect(host.querySelector('[aria-label="Close modal"]')).toBeNull();
    // A real persisted same-account Booking may still enter its history cache; closing is not cancellation.
  });

  it("does not turn redirect query parameters or a page remount into a payment success", async () => {
    fx.searchParams = `id=${VENUE_ID}&payment_intent=pi_synthetic&redirect_status=succeeded`;
    await act(async () => root.render(<QueryClientProvider client={fx.queryClient!}><VenueDetailsPage key="fresh-page" /></QueryClientProvider>));
    await waitFor(() => expect(card(fixedService.id)).toBeTruthy());
    expectNoConfirmation();
    expect(posts("/bookings/finalize")).toHaveLength(0);
    expect(fx.stripeConfirm).not.toHaveBeenCalled();
  });
});
