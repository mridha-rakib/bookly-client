/**
 * Customer My Bookings & Booking Details UI Redesign Acceptance Tests
 * Validates Part A, Part B, and Part C requirements from sprint specification.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingDetail, BookingListItem } from "@/lib/api/bookings";
import { useAuthStore } from "@/lib/auth/store";
import { queryClient, rotateQueryClient } from "@/lib/query-client";
import Providers from "@/app/providers";
import BookingsPage from "@/app/customer/bookings/page";
import BookingView from "@/app/customer/bookings/view/page";
import BookingPaymentRecovery from "@/components/bookings/BookingPaymentRecovery";
import { bookingsApi } from "@/lib/api/bookings";

type Request = { url: string; method?: string; data?: unknown };
const fx = vi.hoisted(() => ({
  requests: [] as Request[],
  respond: undefined as undefined | ((req: Request) => unknown),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: async (req: Request) => {
    fx.requests.push(req);
    return fx.respond!(req);
  },
  refreshSession: async () => ({
    user: { id: "1".repeat(24), email: "jane@example.com", role: "CUSTOMER", status: "ACTIVE" },
    accessToken: "mock-token",
    expiresIn: 3600,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: fx.push, replace: fx.replace }),
  usePathname: () => "/customer/bookings",
  useSearchParams: () => new URLSearchParams(`id=${BOOKING_ID}`),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <span data-src={src}>{alt}</span>,
}));

vi.mock("@/components/Navbar", () => ({ default: () => <nav data-testid="navbar" /> }));
vi.mock("@/components/Footer", () => ({ default: () => <footer data-testid="footer" /> }));
vi.mock("@/components/landing-page/SearchBar", () => ({ default: () => <div data-testid="searchbar" /> }));
vi.mock("@/app/customer/packages/CustomerPackagesList", () => ({ default: () => <div data-testid="packages-list" /> }));
vi.mock("@/components/auth/RequireCustomer", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/auth/LogoutPendingNotice", () => ({ default: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/app/customer/bookings/BookingReviewCard", () => ({ default: () => null }));
vi.mock("@/app/customer/bookings/BookingLocationMap", () => ({ default: () => <div data-testid="location-map" /> }));
vi.mock("@/app/customer/bookings/RescheduleModal", () => ({ default: () => null }));
vi.mock("@/components/packages/FirstClassPackageIntegration", () => ({ FirstClassBookingContext: () => null }));

const BOOKING_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const BUSINESS_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

function makeDetail(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: BOOKING_ID,
    businessId: BUSINESS_ID,
    reference: "BK-ACCEPTANCE-01",
    source: "BOOKLY_MANAGED",
    status: "UPCOMING",
    customer: {
      businessClientId: "client-01",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: { countryCode: "+357", nationalNumber: "99123456", e164: "+35799123456" },
    },
    createdBy: { actorRole: "CUSTOMER" },
    fulfilment: {
      mode: "AT_BUSINESS_LOCATION",
      businessLocation: {
        city: "Larnaca",
        area: "Finikoudes",
        streetName: "Athenon Avenue",
        streetNumber: "42",
        floorUnit: "Floor 2",
        aptRoom: "Suite 4",
        location: { lat: 34.915, lng: 33.635 },
      },
    },
    serviceLines: [
      {
        serviceId: "service-01",
        name: "Deluxe Hair Styling",
        pricingMode: "FIXED",
        durationMin: 60,
        staffMembershipId: "staff-01",
        staffName: "Elena Stylist",
        addons: [{ addonId: "addon-01", name: "Deep Conditioning", priceCents: 1500 }],
        amountCents: 5000,
      },
    ],
    financials: {
      currency: "EUR",
      servicesSubtotalCents: 5000,
      addonsSubtotalCents: 1500,
      serviceDiscountCents: 500,
      travelFeeCents: 0,
      eligiblePlatformFeeBasisCents: 6000,
      platformFeeCents: 1000,
      depositCents: 1200,
      balanceDueCents: 4800,
      totalCents: 6000,
    },
    paymentSummary: {
      actualOnlinePaidCents: 1200,
      originalVenueBalanceCents: 4800,
      venuePaidCents: 0,
      outstandingVenueBalanceCents: 4800,
      venueSettlementStatus: "NOT_RECORDED",
    },
    packageSessions: [],
    schedule: {
      timezone: "Europe/Nicosia",
      startAt: "2030-09-15T10:00:00.000Z",
      endAt: "2030-09-15T11:00:00.000Z",
    },
    customerRescheduleCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeListItem(overrides: Partial<BookingListItem> = {}): BookingListItem {
  return {
    id: BOOKING_ID,
    businessId: BUSINESS_ID,
    reference: "BK-ACCEPTANCE-01",
    source: "BOOKLY_MANAGED",
    status: "UPCOMING",
    primaryServiceName: "Deluxe Hair Styling",
    serviceCount: 1,
    staffNames: ["Elena Stylist"],
    schedule: {
      timezone: "Europe/Nicosia",
      startAt: "2030-09-15T10:00:00.000Z",
      endAt: "2030-09-15T11:00:00.000Z",
    },
    customerName: "Jane Doe",
    businessClientId: "client-01",
    totalCents: 6000,
    depositCents: 1200,
    currency: "EUR",
    platformFeeCents: 1000,
    firstClassPackage: false,
    packageSessions: [],
    fulfilmentLocation: {
      mode: "AT_BUSINESS_LOCATION",
      address: {
        city: "Larnaca",
        area: "Finikoudes",
        streetName: "Athenon Avenue",
        streetNumber: "42",
      },
      location: { lat: 34.915, lng: 33.635 },
    },
    ...overrides,
  };
}

let host: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderNode(node: React.ReactNode) {
  await act(async () => {
    root.render(<Providers>{node}</Providers>);
  });
}

async function waitForCondition(check: () => void) {
  const start = Date.now();
  for (;;) {
    try {
      check();
      return;
    } catch (err) {
      if (Date.now() - start > 3000) throw err;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

beforeEach(() => {
  rotateQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  useAuthStore.setState({
    user: { id: "111111111111111111111111", email: "jane@example.com", role: "CUSTOMER", status: "ACTIVE" },
    status: "authenticated",
    isInitializing: false,
    cacheEpoch: 1,
  });

  fx.requests.length = 0;
  fx.push.mockClear();
  fx.replace.mockClear();

  vi.spyOn(bookingsApi, "getCustomerRecoveryInbox").mockResolvedValue({
    requests: [],
    resolved: [],
    hasMore: false,
    scanned: 0,
  });
  fx.respond = (req: Request) => {
    if (req.url.includes("/auth/refresh")) {
      return {
        user: { id: "1".repeat(24), email: "jane@example.com", role: "CUSTOMER", status: "ACTIVE" },
        accessToken: "mock-token",
        expiresIn: 3600,
      };
    }
    if (req.url.includes("/recovery-inbox")) {
      return { requests: [], resolved: [], hasMore: false, scanned: 0 };
    }
    if (req.url === `/me/bookings/${BOOKING_ID}`) {
      return makeDetail();
    }
    if (req.url.startsWith("/me/bookings")) {
      return { bookings: [makeListItem()], total: 1 };
    }
    if (req.url.startsWith("/catalog/")) {
      return {
        business: {
          id: BUSINESS_ID,
          name: "Luxe Beauty Haven",
          category: "Hair Salon",
          briefDescription: "Premium hair and beauty lounge in central Larnaca.",
          visitType: "AT_BUSINESS_LOCATION",
          openStatus: { configured: true, isOpen: true, label: "Open Now" },
          address: {
            city: "Larnaca",
            area: "Finikoudes",
            streetName: "Athenon Avenue",
            streetNumber: "42",
            floorUnit: "Floor 2",
            aptRoom: "Suite 4",
          },
          location: { lat: 34.915, lng: 33.635 },
          media: [
            { id: "m1", url: "/image/sample-profile.png", role: "PROFILE" },
          ],
        },
        services: [],
        staff: [],
      };
    }
    if (req.url.includes("/recovery-inbox")) {
      return { requests: [], resolved: [], hasMore: false, scanned: 0 };
    }
    return {};
  };

  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  queryClient.clear();
  host.remove();
});

describe("Part A — Customer My Bookings Page Redesign", () => {
  it("renders prominent My Bookings heading and page description at the top before tabs", async () => {
    await renderNode(<BookingsPage />);
    await waitForCondition(() => {
      const heading = host.querySelector("h1");
      expect(heading?.textContent).toBe("My Bookings");
      expect(host.textContent).toContain("Manage your upcoming appointments, review past visits");
    });

    const h1 = host.querySelector("h1");
    const tablist = host.querySelector('[role="tablist"][aria-label="Booking area"]');
    expect(h1).not.toBeNull();
    expect(tablist).not.toBeNull();

    // Verify heading is before tablist in document order
    expect(h1!.compareDocumentPosition(tablist!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders compact Booking Requests updates section with clear status and action button", async () => {
    await renderNode(<BookingPaymentRecovery serverInbox />);
    await waitForCondition(() => {
      const recoverySection = host.querySelector('[aria-label="Booking requests needing attention"]');
      expect(recoverySection).not.toBeNull();
      expect(recoverySection?.textContent).toContain("Booking Requests Needing Attention");
      expect(recoverySection?.textContent).toContain("Refresh requests");
    });
  });

  it("renders Appointments and Packages switcher with proper accessible tab attributes", async () => {
    await renderNode(<BookingsPage />);
    await waitForCondition(() => {
      const tabs = host.querySelectorAll('[role="tablist"][aria-label="Booking area"] [role="tab"]');
      expect(tabs).toHaveLength(2);
      expect(tabs[0]?.textContent).toContain("Appointments");
      expect(tabs[1]?.textContent).toContain("Packages");
      expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    });
  });

  it("renders status navigation filters (Upcoming, Completed, No-show, Canceled)", async () => {
    await renderNode(<BookingsPage />);
    await waitForCondition(() => {
      expect(host.textContent).toContain("Upcoming");
      expect(host.textContent).toContain("Completed");
      expect(host.textContent).toContain("No-show");
      expect(host.textContent).toContain("Canceled");
    });
  });

  it("renders BookingCard with high contrast styling, salon name, reference, and View Details primary action", async () => {
    await renderNode(<BookingsPage />);
    await waitForCondition(() => {
      expect(host.textContent).toContain("Deluxe Hair Styling");
      expect(host.textContent).toContain("Luxe Beauty Haven");
      expect(host.textContent).toContain("Ref: BK-ACCEPTANCE-01");
      expect(host.textContent).toContain("with Elena Stylist");
    });

    const viewButton = Array.from(host.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("View Details")
    );
    expect(viewButton).toBeDefined();
    await act(async () => {
      viewButton!.click();
    });
    expect(fx.push).toHaveBeenCalledWith(`/customer/bookings/view?id=${BOOKING_ID}`);
  });
});

describe("Part B — Booking Details with Business Information on the LEFT", () => {
  it("renders desktop two-column layout with Business Information Card on the LEFT", async () => {
    await renderNode(<BookingView />);
    await waitForCondition(() => {
      const aside = host.querySelector('aside[aria-label="Business information"]');
      expect(aside).not.toBeNull();
      expect(aside?.textContent).toContain("Luxe Beauty Haven");
      expect(aside?.textContent).toContain("Hair Salon");
      expect(aside?.textContent).toContain("Service Provider");
      expect(aside?.textContent).toContain("Open Now");
      expect(aside?.textContent).toContain("Athenon Avenue 42");
      expect(aside?.textContent).toContain("Finikoudes, Larnaca");
    });

    const aside = host.querySelector('aside[aria-label="Business information"]');
    const rightCol = aside?.nextElementSibling;
    expect(rightCol).not.toBeNull();

    // Verify two-column responsive classes
    expect(aside?.className).toContain("lg:w-");
    expect(rightCol?.className).toContain("flex-1");

    // Aside must appear first in DOM order (so it stacks on top on mobile)
    expect(aside!.compareDocumentPosition(rightCol!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("authoritatively associates the Business Card with the booking's owning business and links to venue profile", async () => {
    await renderNode(<BookingView />);
    await waitForCondition(() => {
      const venueLink = host.querySelector(`a[href="/venue?id=${BUSINESS_ID}"]`);
      expect(venueLink).not.toBeNull();
      expect(venueLink?.textContent).toContain("View Venue Profile");
    });
  });

  it("Business card provides Get Directions and does not leak private user or provider credentials", async () => {
    await renderNode(<BookingView />);
    await waitForCondition(() => {
      const directionsLink = Array.from(host.querySelectorAll("a")).find(
        (a) => a.textContent?.includes("Get Directions")
      );
      expect(directionsLink).toBeDefined();
      expect(directionsLink?.getAttribute("href")).toContain("google.com/maps");
      expect(directionsLink?.getAttribute("target")).toBe("_blank");

      // Verify privacy protection
      expect(host.textContent).not.toContain("sk_test_");
      expect(host.textContent).not.toContain("owner-private-secret");
    });
  });

  it("Booking details right column renders complete appointment schedule, summary, client, and actions", async () => {
    await renderNode(<BookingView />);
    await waitForCondition(() => {
      expect(host.textContent).toContain("Booking BK-ACCEPTANCE-01");
      expect(host.textContent).toContain("Appointment Schedule");
      expect(host.textContent).toContain("Europe/Nicosia");
      expect(host.textContent).toContain("Deluxe Hair Styling");
      expect(host.textContent).toContain("Elena Stylist");
      expect(host.textContent).toContain("Deep Conditioning");
      expect(host.textContent).toContain("Jane Doe");
      expect(host.textContent).toContain("jane@example.com");
      expect(host.textContent).toContain("+35799123456");
      expect(host.textContent).toContain("Visit the business");
    });

    const cancelButton = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent === "Cancel"
    );
    const rescheduleButton = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent === "Reschedule"
    );
    expect(cancelButton).toBeDefined();
    expect(rescheduleButton).toBeDefined();
  });

  it("handles travel-to-customer visit mode and displays mobile provider info cleanly", async () => {
    fx.respond = (req: Request) => {
      if (req.url === `/me/bookings/${BOOKING_ID}`) {
        return makeDetail({
          fulfilment: {
            mode: "TRAVEL_TO_CUSTOMER",
            travelAddress: {
              city: "Limassol",
              area: "Agios Tychonas",
              streetName: "Seafront Road",
              streetNumber: "100",
              propertyType: "Villa",
              additionalDirections: "Gate code 1234",
            },
          },
        });
      }
      if (req.url.startsWith("/catalog/")) {
        return {
          business: {
            id: BUSINESS_ID,
            name: "Mobile Glam Spa",
            category: "Wellness",
            visitType: "TRAVEL_TO_CUSTOMER",
            address: { city: "Limassol", area: "Agios Tychonas", streetName: "Seafront Road", streetNumber: "100" },
          },
          services: [],
          staff: [],
        };
      }
      return {};
    };

    await renderNode(<BookingView />);
    await waitForCondition(() => {
      expect(host.textContent).toContain("Mobile Glam Spa");
      expect(host.textContent).toContain("Professional visits your location");
      expect(host.textContent).toContain("Gate code 1234");
      expect(host.textContent).toContain("Property type: Villa");
    });
  });
});
