import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClientBookingHistoryCard from "@/components/clients/ClientBookingHistoryCard";
import { FirstClassSessionActions } from "@/components/packages/FirstClassLifecycleControls";
import type { AuthUser } from "@/lib/api/auth";
import type { BookingDetail } from "@/lib/api/bookings";
import { useAuthStore } from "@/lib/auth/store";
import { completionWindow, noShowWindow } from "@/lib/bookings/action-timing";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: request,
}));
vi.mock("next/image", () => ({ default: () => <span /> }));
vi.mock("next/link", () => ({ default: ({ children }: React.PropsWithChildren) => <>{children}</> }));
vi.mock("@/components/packages/PackageActionControls", () => ({ default: () => null }));
vi.mock("@/components/packages/BusinessPackageAppointmentHistory", () => ({ default: () => null }));
vi.mock("@/components/packages/LegacyPackageBalancePanel", () => ({ default: () => null }));
vi.mock("@/components/packages/FirstClassPackageIntegration", () => ({ ManagementPackageSettlement: () => null }));

const START = "2030-08-19T09:00:00.000Z";
const START_MS = Date.parse(START);

const booking = (overrides: Partial<BookingDetail> = {}): BookingDetail =>
  ({
    id: "bbbbbbbbbbbbbbbbbbbbbbbb", businessId: "aaaaaaaaaaaaaaaaaaaaaaaa", reference: "BK-F5", source: "BOOKLY_MANAGED", status: "UPCOMING",
    customer: { businessClientId: "client", firstName: "Customer", email: "customer@example.com", phone: { countryCode: "+357", nationalNumber: "99112233", e164: "+35799112233" } },
    createdBy: { actorRole: "CUSTOMER" }, fulfilment: { mode: "AT_BUSINESS_LOCATION" },
    serviceLines: [{ serviceId: "service", name: "Haircut", pricingMode: "FIXED", durationMin: 60, staffMembershipId: "staff", staffName: "Pro", addons: [], amountCents: 4000 }],
    financials: { currency: "EUR", servicesSubtotalCents: 4000, addonsSubtotalCents: 0, serviceDiscountCents: 0, travelFeeCents: 0, eligiblePlatformFeeBasisCents: 4000, platformFeeCents: 800, depositCents: 800, balanceDueCents: 3200, totalCents: 4000 },
    paymentSummary: { actualOnlinePaidCents: 800, originalVenueBalanceCents: 3200, venuePaidCents: 0, outstandingVenueBalanceCents: 3200, venueSettlementStatus: "NOT_RECORDED" },
    packageSessions: [], schedule: { timezone: "UTC", startAt: START, endAt: "2030-08-19T10:00:00.000Z" },
    customerRescheduleCount: 0, currency: "EUR", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  }) as BookingDetail;

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  request.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  client.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  useAuthStore.setState({ status: "unauthenticated", user: null });
});

const completeButton = () =>
  Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Complete Booking");

describe("Fix #5 — time-boundary helpers", () => {
  it("completion opens at the scheduled start, inclusive, with no end-time wait", () => {
    expect(completionWindow({ startAt: START }, START_MS - 1).state).toBe("before");
    expect(completionWindow({ startAt: START }, START_MS).state).toBe("open");
    expect(completionWindow({ startAt: START }, START_MS + 10 * 24 * 3600_000).state).toBe("open");
  });

  it("legacy no-show opens at the start with no closing bound; a category window keeps its own", () => {
    const legacy = { schedule: { startAt: START } };
    expect(noShowWindow(legacy, START_MS - 1).state).toBe("before");
    expect(noShowWindow(legacy, START_MS).state).toBe("open");
    expect(noShowWindow(legacy, START_MS + 365 * 24 * 3600_000).state).toBe("open");
    const windowed = { schedule: { startAt: START }, noShowEligibilitySnapshot: {
      opensAt: new Date(START_MS + 15 * 60_000).toISOString(), closesAt: new Date(START_MS + 120 * 60_000).toISOString() } };
    expect(noShowWindow(windowed, START_MS).state).toBe("before");
    expect(noShowWindow(windowed, START_MS + 15 * 60_000).state).toBe("open");
    expect(noShowWindow(windowed, START_MS + 120 * 60_000 - 1).state).toBe("open");
    expect(noShowWindow(windowed, START_MS + 120 * 60_000).state).toBe("after");
  });
});

describe("Fix #5 — Booking detail Complete action", () => {
  const render = async (detail: BookingDetail, onComplete = vi.fn()) => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <ClientBookingHistoryCard booking={detail} businessId="aaaaaaaaaaaaaaaaaaaaaaaa" showFooterActions onCompleteBooking={onComplete} />
        </QueryClientProvider>,
      );
    });
    return onComplete;
  };

  it("is unavailable before start with an explanation, then becomes available exactly at start without any request", async () => {
    vi.setSystemTime(START_MS - 60_000);
    const onComplete = await render(booking());
    expect(completeButton()?.disabled).toBe(true);
    expect(host.textContent).toContain("hasn't started yet. It can be completed from");
    await act(async () => completeButton()?.click());
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(completeButton()?.disabled).toBe(false);
    expect(host.textContent).not.toContain("hasn't started yet");
    await act(async () => completeButton()?.click());
    expect(onComplete).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
  });

  it("uses the rescheduled start time from the authoritative detail", async () => {
    vi.setSystemTime(START_MS + 30 * 60_000);
    await render(booking());
    expect(completeButton()?.disabled).toBe(false);
    await render(booking({ schedule: { timezone: "UTC", startAt: "2030-08-20T09:00:00.000Z", endAt: "2030-08-20T10:00:00.000Z" } }));
    expect(completeButton()?.disabled).toBe(true);
  });
});

describe("Fix #5 — First-Class management controls", () => {
  const options = () =>
    Array.from(host.querySelectorAll<HTMLOptionElement>('select[aria-label="Package session action"] option')).map((o) => o.textContent);
  const render = async () => {
    useAuthStore.setState({ status: "authenticated", user: { id: "owner", role: "BUSINESS_OWNER" } as AuthUser, cacheEpoch: 1 });
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" bookingStatus="UPCOMING"
            bookingStartAt={START} bookingTimezone="UTC" enabled management />
        </QueryClientProvider>,
      );
    });
  };

  it("does not offer Complete or Mark no-show before start, and offers them from the start", async () => {
    vi.setSystemTime(START_MS - 1_000);
    await render();
    expect(options()).not.toContain("Complete");
    expect(options()).not.toContain("Mark no-show for review");
    expect(options()).toContain("Cancel appointment");
    expect(host.textContent).toContain("Complete and no-show become available from");
    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect(options()).toContain("Complete");
    expect(options()).toContain("Mark no-show for review");
    expect(host.textContent).not.toContain("become available from");
  });
});
