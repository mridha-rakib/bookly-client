import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ConfirmedStep from "@/app/venue/components/ConfirmedStep";
import { FirstClassBookingConfirmation } from "@/components/packages/FirstClassBookingConfirmation";
import { apiRequest } from "@/lib/api/client";
import type { BookingDetail } from "@/lib/api/bookings";
import { owned } from "./visual/package-view-fixtures";
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<object>(), apiRequest: vi.fn() }));
vi.mock("@/lib/auth/store", () => ({ useAuthStore: (select: (value: unknown) => unknown) => select({ user: { id: "customer" }, cacheEpoch: 1 }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
function booking(id: string, role: "PURCHASE" | "REDEMPTION" = "PURCHASE", travel = false): BookingDetail {
  return { id, businessId: owned.businessId, reference: `BK-${id}`, source: "BOOKLY_MANAGED", status: "UPCOMING", customer: { businessClientId: "client", firstName: "Customer", email: "customer@example.com", phone: { countryCode: "+357", nationalNumber: "99112233", e164: "+35799112233" } }, createdBy: { actorRole: "CUSTOMER" },
    fulfilment: travel ? { mode: "TRAVEL_TO_CUSTOMER", travelAddress: { city: "Larnaca", area: "Saved area", streetName: "Booked customer street", streetNumber: "9", propertyType: "Apartment", floorUnit: "3", aptRoom: "7", additionalDirections: "Use saved side entrance" } } : { mode: "AT_BUSINESS_LOCATION", businessLocation: { city: "Larnaca", area: "Business area", streetName: "Booked business street", streetNumber: "2" } },
    serviceLines: [{ serviceId: "service", name: `Recorded service ${id}`, pricingMode: "FIXED", durationMin: 60, staffMembershipId: "staff", staffName: `Professional ${id}`, addons: [{ addonId: "addon", name: "Purchased add-on", priceCents: 500 }], amountCents: role === "REDEMPTION" ? 0 : 10000, packageProgressId: owned.id, packageItemId: "fixed", packageRole: role, packageName: "Purchased bundle" }],
    financials: { currency: "EUR", servicesSubtotalCents: role === "REDEMPTION" ? 0 : 10000, addonsSubtotalCents: 500, serviceDiscountCents: 0, travelFeeCents: travel ? 1200 : 0, eligiblePlatformFeeBasisCents: 10000, platformFeeCents: 0, depositCents: 0, balanceDueCents: 10500 + (travel ? 1200 : 0), totalCents: 10500 + (travel ? 1200 : 0) },
    paymentSummary: { actualOnlinePaidCents: 0, originalVenueBalanceCents: 10500, venuePaidCents: 0, outstandingVenueBalanceCents: 10500, venueSettlementStatus: "NOT_RECORDED" }, packageSessions: [], schedule: { timezone: "Europe/Nicosia", startAt: "2030-08-21T10:00:00Z", endAt: "2030-08-21T11:00:00Z" }, customerRescheduleCount: 0, createdAt: "2030-08-19T10:00:00Z", updatedAt: "2030-08-19T10:00:00Z" };
}
let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); vi.mocked(apiRequest).mockReset(); navigation.push.mockReset(); navigation.replace.mockReset(); });
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); });
async function render(node: React.ReactNode) { await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)); await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); }); }
async function click(text: string, index = 0) { await act(async () => [...host.querySelectorAll("button")].filter((button) => button.textContent === text)[index]!.click()); }
function arrange(records: BookingDetail[], verified = true) {
  vi.mocked(apiRequest).mockImplementation(async (request) => {
    if (request.url?.startsWith("/me/bookings/")) return records.find((record) => request.url === `/me/bookings/${record.id}`) as never;
    if (request.url?.startsWith("/package-views/owned/")) return { packages: [{ ...owned, originBookingId: records[0]!.id, purchaseCompletion: verified ? "VERIFIED" : "NOT_ESTABLISHED", sessions: records.map((record) => ({ bookingId: record.id })) }] } as never;
    if (request.url?.startsWith("/catalog/")) return { business: { name: "Real business", visitType: "AT_BUSINESS_LOCATION", address: { streetName: "MUTABLE WRONG ADDRESS" } } } as never;
    throw Error("Unexpected endpoint");
  });
}
it("shared confirmation shows all verified initial appointments and stays until explicit navigation", async () => {
  arrange([booking("primary", "PURCHASE", true), booking("second")]);
  const view = <FirstClassBookingConfirmation businessId={owned.businessId} progressId={owned.id} bookingIds={["second", "primary"]} primaryBookingId="primary" kind="PURCHASE" classification="RETURNING" />;
  await render(view);
  expect(host.querySelectorAll("h1")).toHaveLength(1); expect(host.textContent).toContain("Booking Confirmed!");
  for (const text of ["BK-primary", "BK-second", "Recorded service primary", "Professional second", "Real business", "Europe/Nicosia", "RETURNING", "Professional visits your location", "Visit the business", "Booked customer street", "Floor / unit: 3", "Apartment / room: 7", "Use saved side entrance", "Purchased add-on"]) expect(host.textContent).toContain(text);
  expect(host.textContent).not.toContain("MUTABLE WRONG ADDRESS"); expect(host.querySelector("img")).toBeNull();
  const summaries = host.querySelectorAll('[aria-label="Appointment payment summary"]');
  expect(summaries).toHaveLength(2); expect(summaries[0]!.textContent).toContain("Recorded online amount€0.00");
  expect(summaries[0]!.textContent).toContain("Outstanding venue balance");
  await act(async () => { await client.invalidateQueries({ queryKey: ["packageConfirmation"] }); }); await render(view);
  expect(navigation.push).not.toHaveBeenCalled(); expect(navigation.replace).not.toHaveBeenCalled();
  await click("View Booking", 1); expect(navigation.push).toHaveBeenLastCalledWith("/customer/bookings/view?id=second");
  await click("View Package"); expect(navigation.push).toHaveBeenLastCalledWith(`/customer/packages/${owned.id}?kind=first-class`);
  await click("My Booking"); expect(navigation.push).toHaveBeenLastCalledWith("/customer/bookings");
  await click("My Packages"); expect(navigation.push).toHaveBeenLastCalledWith("/customer/packages");
  expect(vi.mocked(apiRequest).mock.calls.every(([request]) => request.method === "GET")).toBe(true);
});
it("committed redemption uses the same screen and independent charges without a second bundle charge", async () => {
  arrange([booking("redeemed", "REDEMPTION", true)]);
  await render(<FirstClassBookingConfirmation businessId={owned.businessId} progressId={owned.id} bookingIds={["redeemed"]} kind="REDEMPTION" />);
  expect(host.textContent).toContain("Booking Confirmed!"); expect(host.textContent).toContain("Remaining session booked");
  expect(host.textContent).toContain("Included service base: €0.00"); expect(host.textContent).toContain("bundle is not charged again");
  expect(navigation.push).not.toHaveBeenCalled();
});
it.each(["unverified", "foreign"])("%s owned readback never displays confirmation", async (mode) => {
  const record = booking("booking"); if (mode === "foreign") record.businessId = "another-business";
  arrange([record], mode !== "unverified");
  await render(<FirstClassBookingConfirmation businessId={owned.businessId} progressId={owned.id} bookingIds={["booking"]} kind="PURCHASE" />);
  expect(host.textContent).not.toContain("Booking Confirmed!"); expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(navigation.push).not.toHaveBeenCalled();
});
it("failed detail read offers only a read retry and recovers the original confirmation", async () => {
  vi.mocked(apiRequest).mockRejectedValue(Error("offline"));
  const view = <FirstClassBookingConfirmation businessId={owned.businessId} progressId={owned.id} bookingIds={["booking"]} kind="PURCHASE" />;
  await render(view); expect(host.textContent).not.toContain("Booking Confirmed!");
  arrange([booking("booking")]); await click("Retry confirmation details"); await render(view);
  expect(host.textContent).toContain("Booking Confirmed!"); expect(navigation.push).not.toHaveBeenCalled();
});
it("normal and legacy confirmation keep their explicit View Booking and wizard exit behavior", async () => {
  const close = vi.fn(), record = booking("normal"); delete record.serviceLines[0]!.packageItemId; delete record.serviceLines[0]!.packageRole;
  await render(<ConfirmedStep booking={record} setBookingStep={close} isPackagePurchase packageSessionsTotal={6} businessName="Real business" />);
  expect(host.textContent).toContain("Booking Confirmed!"); expect(host.textContent).toContain("Includes 6 sessions");
  expect(navigation.push).not.toHaveBeenCalled(); await click("View Booking");
  expect(close).toHaveBeenCalledExactlyOnceWith(null); expect(navigation.push).toHaveBeenCalledExactlyOnceWith("/customer/bookings/view?id=normal");
});
