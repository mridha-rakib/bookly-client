/** F2D: synthetic fixtures only; real presenters, Customer view/card/result and query hooks. */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingDetail, BookingListItem, BookingRecoveryInboxPage } from "@/lib/api/bookings";
import { useAuthStore } from "@/lib/auth/store";
import { queryClient, rotateQueryClient } from "@/lib/query-client";
import Providers from "@/app/providers";
import BookingView from "@/app/customer/bookings/view/page";
import BookingsPage from "@/app/customer/bookings/page";
import ConfirmedStep from "@/app/venue/components/ConfirmedStep";
import BookingCard from "@/app/customer/bookings/BookingCard";
import CustomerCancellationFinancialResult from "@/components/bookings/CustomerCancellationFinancialResult";
import CustomerFinancialOutcome from "@/components/bookings/CustomerFinancialOutcome";
import { presentCancellation, presentOnlineSnapshot, presentVenuePayment, presentFinancialOutcome } from "@/lib/bookings/customer-financial";

type Request = { url: string; method?: string; data?: unknown };
const fx = vi.hoisted(() => ({ requests: [] as Request[], respond: undefined as undefined | ((req: Request) => unknown), push: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: async (req: Request) => { fx.requests.push(req); return fx.respond!(req); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: fx.push, replace: fx.replace }),
  usePathname: () => "/customer/bookings/view", useSearchParams: () => new URLSearchParams("id=bbbbbbbbbbbbbbbbbbbbbbbb") }));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span>{alt}</span> }));
vi.mock("@/components/Navbar", () => ({ default: () => <nav /> }));
vi.mock("@/components/Footer", () => ({ default: () => <footer /> }));
vi.mock("@/components/landing-page/SearchBar", () => ({ default: () => null }));
vi.mock("@/app/customer/packages/CustomerPackagesList", () => ({ default: () => null }));
vi.mock("@/components/auth/LogoutPendingNotice", () => ({ default: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/app/customer/bookings/BookingReviewCard", () => ({ default: () => null }));
vi.mock("@/app/customer/bookings/BookingLocationMap", () => ({ default: () => null }));
vi.mock("@/app/customer/bookings/RescheduleModal", () => ({ default: () => null }));
vi.mock("@/components/packages/FirstClassPackageIntegration", () => ({ FirstClassBookingContext: () => null }));

const ID = "bbbbbbbbbbbbbbbbbbbbbbbb", BUSINESS = "aaaaaaaaaaaaaaaaaaaaaaaa";
function booking(): BookingDetail {
  return {
    id: ID, businessId: BUSINESS, reference: "BK-F2D", source: "BOOKLY_MANAGED", status: "CANCELLED_BY_BUSINESS",
    customer: { businessClientId: "client", firstName: "Customer", email: "customer@example.com", phone: { countryCode: "+357", nationalNumber: "99112233", e164: "+35799112233" } },
    createdBy: { actorRole: "CUSTOMER" }, fulfilment: { mode: "AT_BUSINESS_LOCATION" },
    serviceLines: [{ serviceId: "service", name: "Recorded service", pricingMode: "HOURLY", durationMin: 255,
      staffMembershipId: "staff", staffName: "Recorded professional", addons: [], amountCents: 4000, hours: 4 }],
    financials: { currency: "EUR", servicesSubtotalCents: 4000, addonsSubtotalCents: 0, serviceDiscountCents: 0,
      travelFeeCents: 0, eligiblePlatformFeeBasisCents: 4000, platformFeeCents: 800, depositCents: 800, balanceDueCents: 3200, totalCents: 4000 },
    paymentSummary: { actualOnlinePaidCents: 800, originalVenueBalanceCents: 3200, venuePaidCents: 0, outstandingVenueBalanceCents: 3200, venueSettlementStatus: "NOT_RECORDED" },
    cancellationOutcome: { classifiedAt: "2026-10-26T10:00:00Z", tier: "MORE_THAN_72_HOURS", feeMode: "FREE",
      cancellationFeeCents: 0, depositAppliedCents: 0, additionalChargeCents: 0, refundOwedCents: 800, settlementStatus: "PENDING" },
    packageSessions: [], schedule: { timezone: "UTC", startAt: "2030-08-19T09:00:00.000Z", endAt: "2030-08-19T13:15:00.000Z" },
    customerRescheduleCount: 0, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-26T10:00:00Z",
  };
}
function confirmedOutcome(): NonNullable<BookingDetail["financialOutcome"]> {
  return { currency: "EUR", asOf: "2026-10-26T10:00:00Z", payments: { items: [], hasMore: false },
    refunds: { items: [{ origin: "BOOKLY", id: "internal-record", status: "SUCCEEDED", amountCents: 800,
      providerCallStarted: true, providerConfirmed: true, accountingConfirmed: true }], hasMore: false },
    disputes: { items: [], hasMore: false } };
}
function authenticate(id: string | null) {
  rotateQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  useAuthStore.setState({ user: id ? { id, email: `${id}@example.com`, role: "CUSTOMER", status: "ACTIVE" } : null,
    status: id ? "authenticated" : "unauthenticated", isInitializing: false,
    restoreSession: vi.fn(async () => undefined), cacheEpoch: useAuthStore.getState().cacheEpoch + 1 });
}
let host: HTMLDivElement, root: Root, detail: BookingDetail;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
async function render(node: React.ReactNode) { await act(async () => root.render(<Providers>{node}</Providers>)); }
async function waitFor(check: () => void) {
  const start = Date.now();
  for (;;) { try { check(); return; } catch (error) { if (Date.now() - start > 3000) throw error; }
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); }); }
}
beforeEach(() => {
  detail = booking(); fx.requests.length = 0; fx.push.mockClear(); fx.replace.mockClear(); authenticate("customer-a");
  fx.respond = (req) => req.url === `/me/bookings/${ID}` ? detail
    : req.url.startsWith("/catalog/") ? { business: { name: "Actual venue", visitType: "AT_BUSINESS_LOCATION" }, services: [], staff: [] } : {};
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); queryClient.clear(); host.remove(); });
const texts = (rows: ReturnType<typeof presentCancellation>) => rows.map((row) => row.label).join(" ");
const detailReads = () => fx.requests.filter((req) => req.url === `/me/bookings/${ID}`);

describe("F2D financial presentation", () => {
  it("authorized First-Class details stay mounted through loading, readback invalidation and same-account refresh", async () => {
    detail.status = "UPCOMING"; delete detail.cancellationOutcome;
    detail.serviceLines[0]!.packageProgressId = "progress";
    detail.serviceLines[0]!.packageItemId = "item";
    detail.serviceLines[0]!.packageRole = "PURCHASE";
    let finish: (value: BookingDetail) => void;
    let initial = true;
    fx.respond = (request) => request.url === `/me/bookings/${ID}`
      ? initial ? (initial = false, new Promise<BookingDetail>((resolve) => { finish = resolve; })) : detail
      : request.url.startsWith("/catalog/") ? { business: { name: "Actual venue" }, services: [], staff: [] } : {};
    await render(<BookingView />);
    expect(host.textContent).toContain("Loading your booking");
    expect(fx.push).not.toHaveBeenCalled(); expect(fx.replace).not.toHaveBeenCalled();
    await act(async () => finish!(detail));
    await waitFor(() => expect(host.textContent).toContain("Original initial Package appointment"));
    const heading = host.querySelector("h1");
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["customerBookings"] });
      await queryClient.invalidateQueries({ queryKey: ["packageViews"] });
      useAuthStore.setState({ user: { ...useAuthStore.getState().user!, email: "refreshed@example.com" } });
    });
    await render(<BookingView />);
    expect(host.querySelector("h1")).toBe(heading);
    expect(host.textContent).toContain("Original initial Package appointment");
    expect(host.querySelector('a[href="/customer/bookings"]')).not.toBeNull();
    expect(host.querySelector('a[href="/customer/packages"]')).not.toBeNull();
    expect(fx.push).not.toHaveBeenCalled(); expect(fx.replace).not.toHaveBeenCalled();
  });
  it.each(["AT_BUSINESS_LOCATION", "TRAVEL_TO_CUSTOMER"] as const)("common details use the persisted %s address and visit direction", async (mode) => {
    const savedAddress = { city: "Larnaca" as const, area: "Booked area", streetName: "Booked street", streetNumber: "12", floorUnit: "3", aptRoom: "8", location: { lat: 34.92, lng: 33.62 } };
    detail.fulfilment = mode === "AT_BUSINESS_LOCATION" ? { mode, businessLocation: savedAddress }
      : { mode, travelAddress: { ...savedAddress, propertyType: "Apartment", additionalDirections: "Use the side entrance" } };
    detail.status = "UPCOMING"; delete detail.cancellationOutcome;
    detail.financials.travelFeeCents = mode === "TRAVEL_TO_CUSTOMER" ? 1200 : 0;
    detail.serviceLines[0]!.addons = [{ addonId: "addon", name: "Recorded add-on", priceCents: 500 }];
    detail.serviceLines[0]!.packageItemId = "item"; detail.serviceLines[0]!.packageProgressId = "progress";
    detail.serviceLines[0]!.packageRole = "REDEMPTION"; detail.serviceLines[0]!.packageName = "Purchased package name";
    fx.respond = (req) => req.url === `/me/bookings/${ID}` ? detail : req.url.startsWith("/catalog/")
      ? { business: { name: "Actual venue", visitType: mode === "AT_BUSINESS_LOCATION" ? "TRAVEL_TO_CUSTOMER" : "AT_BUSINESS_LOCATION", address: { ...savedAddress, streetName: "MUTABLE PROFILE ADDRESS" } }, services: [], staff: [] } : {};
    await render(<BookingView />);
    await waitFor(() => expect(host.textContent).toContain("Booked street"));
    expect(host.textContent).toContain(mode === "TRAVEL_TO_CUSTOMER" ? "Professional visits your location" : "Visit the business");
    expect(host.textContent).toContain("Floor / unit: 3"); expect(host.textContent).toContain("Apartment / room: 8");
    expect(host.textContent).not.toContain("MUTABLE PROFILE ADDRESS");
    expect(host.textContent).toContain("Upcoming"); expect(host.textContent).toContain("Recorded professional");
    expect(host.textContent).toContain("Purchased package name"); expect(host.textContent).toContain("Recorded add-on");
    expect(host.textContent).toContain("UTC"); expect(host.textContent).toContain("255 min");
    const maps = [...host.querySelectorAll("a")].find((link) => link.textContent === "Open in maps")!;
    expect(maps.href).toContain("34.92%2C33.62");
    expect(host.querySelector('a[href="/customer/packages/progress?kind=first-class"]')).not.toBeNull();
    if (mode === "TRAVEL_TO_CUSTOMER") { expect(host.textContent).toContain("Use the side entrance"); expect(host.textContent).toContain("Travel fee"); }
    expect(fx.requests.some((req) => req.method === "POST")).toBe(false);
  });
  it("missing or mismatched address snapshots never fall back to a current profile or the opposite address", async () => {
    detail.fulfilment = { mode: "TRAVEL_TO_CUSTOMER", businessLocation: { city: "Larnaca", area: "Wrong area", streetName: "PRIVATE WRONG ADDRESS", streetNumber: "7" } };
    await render(<BookingView />);
    await waitFor(() => expect(host.textContent).toContain("The booked service address is unavailable"));
    expect(host.textContent).not.toContain("PRIVATE WRONG ADDRESS");
    expect([...host.querySelectorAll("a")].some((link) => link.textContent === "Open in maps")).toBe(false);
  });
  it("normal Booking details retain the existing cancellation and reschedule actions", async () => {
    detail.status = "UPCOMING"; delete detail.cancellationOutcome;
    await render(<BookingView />);
    await waitFor(() => expect(host.textContent).toContain("Recorded service"));
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Cancel")).toBe(true);
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Reschedule")).toBe(true);
  });
  it("a real legacy Package Booking retains the common detail and original Package destination", async () => {
    detail.status = "UPCOMING"; delete detail.cancellationOutcome;
    detail.serviceLines[0]!.packageProgressId = "legacy-progress";
    detail.serviceLines[0]!.sessionIndex = 2; detail.serviceLines[0]!.sessionsInPackage = 6;
    await render(<BookingView />);
    await waitFor(() => expect(host.textContent).toContain("Package session 2 of 6"));
    expect(host.querySelector('a[href="/customer/packages/legacy-progress"]')).not.toBeNull();
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Cancel session")).toBe(true);
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Reschedule session")).toBe(true);
  });
  it.each(["NOT_APPLICABLE", "PENDING", "SUCCEEDED", "FAILED", "WAIVED"] as const)("maps %s in refund/charge/neither contexts without raw enums or assumed completion", (status) => {
    const outcome = detail.cancellationOutcome!;
    for (const mode of ["refund", "charge", "neither"]) {
      const rows = presentCancellation({ ...outcome, settlementStatus: status,
        refundOwedCents: mode === "refund" ? 800 : 0, cancellationFeeCents: mode === "charge" ? 300 : 0,
        depositAppliedCents: mode === "charge" ? 100 : 0, additionalChargeCents: mode === "charge" ? 200 : 0 });
      expect(texts(rows)).not.toContain(`Settlement: ${status.toLowerCase()}`);
      expect(texts(rows)).not.toContain(status);
      if (mode === "refund") expect(rows.find((row) => row.label === "Refund amount owed")).toMatchObject({ amountCents: 800 });
      if (status !== "SUCCEEDED") expect(rows.some((row) => row.tone === "success")).toBe(false);
      if (mode === "charge" && status === "WAIVED") expect(texts(rows)).toContain("Additional fee waived");
      if (status === "SUCCEEDED" && mode === "refund") expect(texts(rows)).toContain("Refund recorded as successful");
    }
  });
  it("preserves missing/unknown/contradictory outcomes instead of zero/success", () => {
    expect(texts(presentCancellation(undefined))).toContain("unavailable");
    expect(texts(presentCancellation({ ...detail.cancellationOutcome!, settlementStatus: "FUTURE" } as never))).toContain("unavailable");
    const rows = presentCancellation({ ...detail.cancellationOutcome!, additionalChargeCents: 200, settlementStatus: "SUCCEEDED" });
    expect(rows.some((row) => row.tone === "success")).toBe(false);
    expect(texts(rows)).toContain("unavailable");
  });
  it("uses actual historical promo charge, distinguishes platform/service amount, zero and missing", () => {
    detail.promo = { code: "OLD", type: "FIXED", value: 300, discountCents: 300, chargeCents: 500, fundingOwner: "BOOKLY", appliedAt: "2026-10-01T00:00:00Z" };
    expect(presentOnlineSnapshot(detail)).toMatchObject({ amountCents: 500, label: "Historical platform booking charge" });
    detail.financials.platformFeeCents = 0; expect(presentOnlineSnapshot(detail).label).toContain("service deposit");
    detail.promo.chargeCents = 0; expect(presentOnlineSnapshot(detail).amountCents).toBe(0);
    detail.promo.chargeCents = Number.NaN; expect(presentOnlineSnapshot(detail).amountCents).toBeUndefined();
    detail.source = "MANUAL"; expect(presentOnlineSnapshot(detail).amountCents).toBeUndefined();
  });
  it("labels venue payment as the business's record and does not manufacture missing legacy amounts", () => {
    detail.completionPayment = { paid: true, recordedAt: "2026-10-26T10:00:00Z" };
    expect(texts(presentVenuePayment(detail))).toContain("amount and remaining balance are unavailable");
    detail.completionPayment.amountCents = 1000;
    detail.paymentSummary = { ...detail.paymentSummary, venuePaidCents: 1000, outstandingVenueBalanceCents: 2200, venueSettlementStatus: "PARTIALLY_PAID" };
    expect(texts(presentVenuePayment(detail))).toContain("Business recorded a partial venue payment");
  });
  it("requires correlated confirmation flags, never treats disputes as Customer refunds or promises bank arrival", () => {
    const outcome = confirmedOutcome();
    const rows = presentFinancialOutcome(outcome); expect(texts(rows)).toContain("Payment provider confirmed a refund");
    outcome.refunds.items[0]!.providerConfirmed = false as never;
    expect(texts(presentFinancialOutcome(outcome))).not.toContain("Payment provider confirmed a refund");
    outcome.refunds.items = []; outcome.disputes.items = [{ id: "dispute", providerStatus: "lost", final: true, outcome: "LOST", amountCents: 300, lastObservedAt: outcome.asOf }];
    expect(texts(presentFinancialOutcome(outcome))).toContain("Payment dispute closed");
    expect(texts(presentFinancialOutcome(outcome))).not.toMatch(/You won|You lost|arrived|days|Refund completed/);
  });
  it("shows absent optional data honestly and announces truncated collections without fake totals", async () => {
    await render(<CustomerFinancialOutcome booking={detail} />);
    expect(host.textContent).toContain("currently unavailable");
    detail.financialOutcome = confirmedOutcome(); detail.financialOutcome.refunds.hasMore = true;
    await render(<CustomerFinancialOutcome booking={detail} />);
    expect(host.textContent).toContain("More refund records exist");
    expect(host.textContent).toContain("€8.00"); expect(host.textContent).not.toContain("Total refunded");
    expect(fx.requests).toHaveLength(0);
  });
  it("real Customer detail renders owed/pending separately from verified provider refund and performs no mutation", async () => {
    detail.financialOutcome = confirmedOutcome(); await render(<BookingView />);
    await waitFor(() => expect(host.textContent).toContain("Refund amount owed"));
    expect(host.textContent).toContain("Refund outcome is awaiting confirmation");
    expect(host.textContent).toContain("Payment provider confirmed a refund");
    expect(host.textContent).not.toMatch(/Settlement:|Fee charged|Deposit paid online|refund status: succeeded/);
    expect(host.textContent).toContain("Historical platform booking charge");
    expect(detailReads()).toHaveLength(1);
    expect(fx.requests.filter((req) => req.method === "POST")).toHaveLength(0);
  });
  it("real Booking confirmation keeps historical promo/zero amount separate from a successful card claim", async () => {
    detail.promo = { code: "OLD", type: "FIXED", value: 800, discountCents: 800, chargeCents: 0, fundingOwner: "BOOKLY", appliedAt: "2026-10-01T00:00:00Z" };
    await render(<ConfirmedStep booking={detail} setBookingStep={vi.fn()} />);
    expect(host.textContent).toContain("Booking Confirmed!");
    expect(host.textContent).toContain("Historical platform booking charge");
    expect(host.textContent).toContain("€0.00");
    expect(host.textContent).not.toMatch(/Deposit paid|Paid online|Payment successful/);
    expect(fx.requests).toHaveLength(0);
  });
  it("real cancellation confirmation preserves missing financial data and refreshes only owned detail", async () => {
    detail.status = "UPCOMING"; delete detail.cancellationOutcome;
    const item = { ...detail, primaryServiceName: "Recorded service", serviceCount: 1, staffNames: [],
      totalCents: 4000, depositCents: 800, currency: "EUR", platformFeeCents: 800, firstClassPackage: false };
    fx.respond = (req) => {
      if (req.url === "/me/bookings") return { bookings: [item], pagination: { page: 1, limit: 50, total: 1 } };
      if (req.url === "/me/bookings/recovery-inbox") {
        return { requests: [], resolved: [], hasMore: false, scanned: 0 } satisfies BookingRecoveryInboxPage;
      }
      if (req.url === `/me/bookings/${ID}/cancel`) { detail = { ...detail, status: "CANCELLED_BY_CUSTOMER" }; return detail; }
      if (req.url === `/me/bookings/${ID}`) return detail;
      return { business: { name: "Actual venue" }, services: [], staff: [] };
    };
    await render(<BookingsPage />);
    const click = async (text: string) => {
      const found = [...host.querySelectorAll("button")].find((node) => node.textContent?.trim() === text);
      if (!found) throw new Error(`Missing ${text}`);
      await act(async () => found.click());
    };
    await waitFor(() => expect(host.textContent).toContain("Recorded service"));
    expect(detailReads()).toHaveLength(0);
    await click("Cancel"); await click("Yes, cancel");
    await waitFor(() => expect(host.textContent).toContain("Cancellation Confirmed"));
    expect(host.textContent).toContain("Financial outcome information is currently unavailable");
    expect(host.textContent).not.toContain("No charge applied");
    await waitFor(() => expect(detailReads()).toHaveLength(1));
    expect(fx.requests.filter((req) => req.method === "POST")).toHaveLength(1); // only explicit cancellation
    await act(async () => authenticate("customer-b"));
    expect(host.textContent).not.toContain("Cancellation Confirmed");
  });
  it("history details remain lazy across many cards, with no financial request fan-out", async () => {
    const item = { ...detail, primaryServiceName: "Recorded service", serviceCount: 1, staffNames: [],
      customerName: [detail.customer.firstName, detail.customer.lastName].filter(Boolean).join(" "),
      businessClientId: detail.customer.businessClientId,
      totalCents: 4000, depositCents: 800, currency: "EUR", platformFeeCents: 800, firstClassPackage: false } satisfies BookingListItem;
    await render(<>{[1, 2, 3].map((i) => <BookingCard key={i} booking={{ ...item, id: `${ID.slice(0, -1)}${i}` }} onCancel={vi.fn()} onReschedule={vi.fn()} />)}</>);
    expect(fx.requests.some((req) => req.url.startsWith("/me/bookings/"))).toBe(false);
    await render(<BookingCard booking={item} onCancel={vi.fn()} onReschedule={vi.fn()} />);
    await act(async () => {
      const heading = [...host.querySelectorAll("span")].find((node) => node.textContent === "Payment details")!;
      (heading.parentElement as HTMLElement).click();
    });
    await waitFor(() => expect(host.textContent).toContain("Refund outcome is awaiting confirmation"));
    expect(detailReads()).toHaveLength(1);
    expect(fx.requests.filter((req) => req.method === "POST")).toHaveLength(0);
  });
  it("cancellation result consumes fresh owned GET rather than freezing the mutation's old settlement", async () => {
    const snapshot = booking(); detail = { ...detail, cancellationOutcome: { ...detail.cancellationOutcome!, settlementStatus: "SUCCEEDED" }, financialOutcome: confirmedOutcome() };
    await render(<CustomerCancellationFinancialResult booking={snapshot} />);
    await waitFor(() => expect(host.textContent).toContain("Refund recorded as successful"));
    expect(host.textContent).toContain("Payment provider confirmed a refund");
    expect(host.textContent).toContain("Appointment cancellation and financial settlement are separate");
    expect(detailReads()).toHaveLength(1);
  });
  it("handles loading/failure without inventing an empty settled history", async () => {
    let reject!: (error: Error) => void;
    fx.respond = () => new Promise((_, fail) => { reject = fail; });
    await render(<BookingView />); expect(host.textContent).toContain("Loading your booking");
    await act(async () => reject(new Error("offline")));
    await waitFor(() => expect(host.textContent).toContain("could not be loaded"));
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Retry booking details")).toBe(true);
    expect(host.textContent).not.toMatch(/Payment provider confirmed|No refunds|Everything settled/);
  });
  it("retains last recorded facts with a refresh error, without calling it a financial failure", async () => {
    detail.financialOutcome = confirmedOutcome(); await render(<BookingView />);
    await waitFor(() => expect(host.textContent).toContain("Payment provider confirmed a refund"));
    fx.respond = (req) => { if (req.url === `/me/bookings/${ID}`) throw new Error("offline"); return {}; };
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ["customerBookings", "detail", ID] }); });
    await waitFor(() => expect(host.textContent).toContain("Showing the last recorded information"));
    expect(host.textContent).not.toContain("Refund failed");
  });
  it("real auth Provider retires cached and late old-account detail on account/session changes and logout", async () => {
    let resolveOld!: (value: BookingDetail) => void;
    fx.respond = (req) => req.url === `/me/bookings/${ID}` ? new Promise((resolve) => { resolveOld = resolve; }) : {};
    await render(<BookingView />); await waitFor(() => expect(detailReads()).toHaveLength(1));
    detail = { ...detail, reference: "SECOND-ACCOUNT", financialOutcome: confirmedOutcome() };
    fx.respond = (req) => req.url === `/me/bookings/${ID}` ? detail : { business: { name: "Venue" }, services: [], staff: [] };
    await act(async () => authenticate("customer-b"));
    await waitFor(() => expect(host.textContent).toContain("SECOND-ACCOUNT"));
    await act(async () => resolveOld({ ...booking(), reference: "OLD-ACCOUNT" }));
    expect(host.textContent).not.toContain("OLD-ACCOUNT");
    await act(async () => authenticate(null));
    expect(host.textContent).not.toContain("SECOND-ACCOUNT");
    expect(host.textContent).not.toContain("Payment provider confirmed a refund");
  });
});
