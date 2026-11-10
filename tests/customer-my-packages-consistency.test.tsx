import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FirstClassPackageCard from "@/components/packages/FirstClassPackageCard";
import PackageCard from "@/app/customer/packages/PackageCard";
import BusinessInfoSidebar from "@/components/packages/BusinessInfoSidebar";
import CustomerPackagesList from "@/app/customer/packages/CustomerPackagesList";
import type { OwnedPackageView } from "@/lib/api/package-views";
import type { PackageProgress } from "@/lib/api/packages";
import * as packagesHooks from "@/lib/packages/hooks";
import * as packageViewHooks from "@/lib/packages/view-hooks";
import * as catalogHooks from "@/lib/catalog/hooks";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fill: _fill, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...rest} />;
  },
}));

vi.mock("@/components/packages/LegacyPackageRecovery", () => ({
  default: () => <div data-testid="legacy-package-recovery" />,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockCatalogBusiness = {
  id: "biz-123456789012345678901234",
  name: "Aurelia Hair & Beauty Studio",
  category: "Beauty & Wellness",
  subcategories: ["Hair Salons"],
  briefDescription: "Premium hair and beauty salon in Larnaca.",
  visitType: "AT_BUSINESS_LOCATION" as const,
  timezone: "Asia/Nicosia",
  address: {
    streetName: "Test Street",
    streetNumber: "14",
    area: "Downtown",
    city: "Larnaca",
    floorUnit: "1",
    aptRoom: "2",
  },
  location: { lat: 34.917, lng: 33.633 },
  openStatus: { configured: true, isOpen: false, label: "Closed - opens at 10:00 AM Monday" },
  hours: [],
  media: [{ id: "m1", url: "/image/salon.png", role: "PROFILE" as const }],
};

const mockFirstClassPackage: OwnedPackageView = {
  id: "fc-111111111111111111111111",
  businessId: "biz-123456789012345678901234",
  schemaVersion: 2,
  name: "Platinum Priority Travel Suite",
  currency: "EUR",
  bundlePriceCents: 24000,
  status: "RECORDED",
  originBookingId: "orig-11111111111111111111",
  actionsAvailable: false,
  purchaseCompletion: "NOT_ESTABLISHED",
  validity: { mode: "FINITE", expiresAt: "2027-11-08T10:00:00Z", timezone: "Asia/Nicosia" },
  penalty: null,
  purchaseFinancials: {
    totalCents: 24000,
    depositCents: 0,
    balanceSettled: false,
    outstandingBalanceCents: 36500,
    venueAttestedCents: 0,
  },
  items: [
    {
      id: "item-1",
      serviceId: "srv-1",
      name: "QA MATRIX — Fixed Travel Discount",
      pricingMode: "FIXED",
      group: null,
      total: 5,
      remaining: 4,
      scheduled: 1,
      completed: 0,
      forfeited: 0,
      expired: 0,
      travelCities: [],
    },
  ],
  sessions: [],
};

const mockLegacyPackage: PackageProgress = {
  id: "leg-222222222222222222222222",
  businessId: "biz-123456789012345678901234",
  serviceId: "srv-2",
  totalSessions: 3,
  remainingSessions: 2,
  availableSessions: 2,
  completedSessions: 0,
  status: "AWAITING_BALANCE",
  balanceSettled: false,
  outstandingBalanceCents: 25000,
  sessions: [
    {
      sessionIndex: 1,
      bookingId: "bkg-1",
      status: "SCHEDULED",
      booking: null,
    },
  ],
  originBookingId: "bkg-1",
  purchaseSnapshot: {
    name: "Aurelia Signature Hair Care Package",
    packageServicesName: "Cut, Wash & Styling - 3 Session Package",
    bundlePriceCents: 15000,
    durationMin: 60,
    sessionsInPackage: 3,
  },
  fulfilmentEntitlement: {
    mode: "AT_BUSINESS_LOCATION",
  },
  createdAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-01T10:00:00Z",
};

describe("Customer My Packages UI Consistency & UX Enhancement", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    vi.spyOn(catalogHooks, "useBusinessCatalogQuery").mockReturnValue({
      data: { business: mockCatalogBusiness },
      isLoading: false,
      isError: false,
      isSuccess: true,
    } as unknown as ReturnType<typeof catalogHooks.useBusinessCatalogQuery>);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  async function render(element: React.ReactNode) {
    await act(async () => root.render(element));
    return host.textContent ?? "";
  }

  // 1. First-Class Card Rendering
  it("renders First-Class package card with name, service item, and provider", async () => {
    const text = await render(<FirstClassPackageCard pkg={mockFirstClassPackage} />);
    expect(text).toContain("Platinum Priority Travel Suite");
    expect(text).toContain("QA MATRIX — Fixed Travel Discount");
    expect(text).toContain("Aurelia Hair & Beauty Studio");
    expect(text).toContain("First-Class Package");
    expect(host.querySelector("a")?.getAttribute("href")).toBe(
      `/customer/packages/${mockFirstClassPackage.id}?kind=first-class`
    );
  });

  // 2. Legacy Package Card Rendering
  it("renders Legacy package card with name, subtitle, and provider", async () => {
    const text = await render(
      <PackageCard
        pkg={mockLegacyPackage}
        isRefundPending={false}
        onRequestRefund={vi.fn()}
      />
    );
    expect(text).toContain("Aurelia Signature Hair Care Package");
    expect(text).toContain("Cut, Wash & Styling - 3 Session Package");
    expect(text).toContain("Aurelia Hair & Beauty Studio");
    expect(text).toContain("Standard Package");
    expect(host.querySelector("a")?.getAttribute("href")).toBe(
      `/customer/packages/${mockLegacyPackage.id}`
    );
  });

  // 3. Shared Design System & Card Structure Consistency
  it("uses the identical outer container styling across both card types", async () => {
    await render(
      <div>
        <FirstClassPackageCard pkg={mockFirstClassPackage} />
        <PackageCard pkg={mockLegacyPackage} isRefundPending={false} onRequestRefund={vi.fn()} />
      </div>
    );
    const articles = host.querySelectorAll("article");
    expect(articles).toHaveLength(2);

    const fcClasses = articles[0].className;
    const legacyClasses = articles[1].className;

    // Both must use rounded-2xl, border-[#E2E1E6], shadow, font-manrope, p-6
    expect(fcClasses).toContain("rounded-2xl");
    expect(fcClasses).toContain("border-[#E2E1E6]");
    expect(fcClasses).toContain("font-manrope");
    expect(fcClasses).toContain("p-6");

    expect(legacyClasses).toContain("rounded-2xl");
    expect(legacyClasses).toContain("border-[#E2E1E6]");
    expect(legacyClasses).toContain("font-manrope");
    expect(legacyClasses).toContain("p-6");
  });

  // 4. Valid Package Status Labels
  it("maps status labels accurately across package types", async () => {
    // Unverified First-Class -> "Purchase incomplete"
    let text = await render(<FirstClassPackageCard pkg={mockFirstClassPackage} />);
    expect(text).toContain("Purchase incomplete");

    // Verified with balance due -> "Balance due"
    const verifiedBalanceDue: OwnedPackageView = {
      ...mockFirstClassPackage,
      purchaseCompletion: "VERIFIED",
      purchaseFinancials: { ...mockFirstClassPackage.purchaseFinancials!, balanceSettled: false },
    };
    text = await render(<FirstClassPackageCard pkg={verifiedBalanceDue} />);
    expect(text).toContain("Balance due");

    // Verified and settled -> "Active"
    const verifiedActive: OwnedPackageView = {
      ...mockFirstClassPackage,
      purchaseCompletion: "VERIFIED",
      purchaseFinancials: { ...mockFirstClassPackage.purchaseFinancials!, balanceSettled: true },
    };
    text = await render(<FirstClassPackageCard pkg={verifiedActive} />);
    expect(text).toContain("Active");

    // Cancelled / Voided -> "Cancelled"
    const voidedPkg: PackageProgress = {
      ...mockLegacyPackage,
      status: "VOIDED",
    };
    text = await render(
      <PackageCard pkg={voidedPkg} isRefundPending={false} onRequestRefund={vi.fn()} />
    );
    expect(text).toContain("Cancelled");
  });

  // 5. Recorded / Unconfirmed Purchase State Warning
  it("displays explicit unconfirmed warning banner when purchaseCompletion is NOT_ESTABLISHED", async () => {
    const text = await render(<FirstClassPackageCard pkg={mockFirstClassPackage} />);
    expect(text).toContain("Purchase not completed");
    expect(text).toContain("These sessions cannot be booked or used, and no payment is confirmed.");
    expect(host.querySelector('[role="status"]')).not.toBeNull();
  });

  // 6. Outstanding Venue Dues State (Locked Notice)
  it("displays scheduling locked warning when balance is due", async () => {
    // Legacy locked warning
    let text = await render(
      <PackageCard pkg={mockLegacyPackage} isRefundPending={false} onRequestRefund={vi.fn()} />
    );
    expect(text).toContain("Scheduling locked");
    expect(text).toContain("Scheduling is locked until the business records the outstanding purchase balance as paid.");

    // First-Class locked warning (when purchase is verified but balance is unsettled)
    const fcLocked: OwnedPackageView = {
      ...mockFirstClassPackage,
      purchaseCompletion: "VERIFIED",
      purchaseFinancials: { ...mockFirstClassPackage.purchaseFinancials!, balanceSettled: false },
    };
    text = await render(<FirstClassPackageCard pkg={fcLocked} />);
    expect(text).toContain("Scheduling locked");
    expect(text).toContain("Remaining sessions are locked until the original balance is settled.");
  });

  // 7. Sessions Remaining, Scheduled, and Completed Presentation
  it("presents session metrics with explicit numerator and denominator", async () => {
    const text = await render(<FirstClassPackageCard pkg={mockFirstClassPackage} />);
    expect(text).toContain("4 of 5 remaining");
    expect(text).toContain("Remaining");
    expect(text).toContain("Scheduled");
    expect(text).toContain("Completed");

    const legacyText = await render(
      <PackageCard pkg={mockLegacyPackage} isRefundPending={false} onRequestRefund={vi.fn()} />
    );
    expect(legacyText).toContain("2 of 3 remaining");
  });

  // 8. Financial Summary Integrity
  it("displays bundle price and outstanding balance separately without conflating", async () => {
    const text = await render(<FirstClassPackageCard pkg={mockFirstClassPackage} />);
    expect(text).toContain("Bundle price");
    expect(text).toContain("€240.00");
    expect(text).toContain("Outstanding purchase balance");
    expect(text).toContain("€365.00 due at venue");

    const legacyText = await render(
      <PackageCard pkg={mockLegacyPackage} isRefundPending={false} onRequestRefund={vi.fn()} />
    );
    expect(legacyText).toContain("Base package price");
    expect(legacyText).toContain("€150.00");
    expect(legacyText).toContain("Outstanding purchase balance");
    expect(legacyText).toContain("€250.00 due at venue");
  });

  // 9. Refund Eligibility Controls & Callbacks
  it("renders refund button only for void-eligible packages and fires callback", async () => {
    const onRefund = vi.fn();
    window.confirm = vi.fn(() => true);

    await render(
      <PackageCard pkg={mockLegacyPackage} isRefundPending={false} onRequestRefund={onRefund} />
    );
    const refundBtn = host.querySelector<HTMLButtonElement>("button");
    expect(refundBtn).not.toBeNull();
    expect(refundBtn?.textContent).toContain("Request refund (unused package)");

    await act(async () => refundBtn?.click());
    expect(onRefund).toHaveBeenCalledWith(mockLegacyPackage);

    // If already voided, refund button must not be shown
    const voidedPkg: PackageProgress = { ...mockLegacyPackage, status: "VOIDED" };
    await render(
      <PackageCard pkg={voidedPkg} isRefundPending={false} onRequestRefund={onRefund} />
    );
    const voidedBtn = host.querySelector("button");
    expect(voidedBtn).toBeNull();
  });

  // 10. Authoritative Business Sidebar Association & Privacy
  it("renders BusinessInfoSidebar on package details with public details and zero private email leakage", async () => {
    const text = await render(
      <BusinessInfoSidebar businessId={mockCatalogBusiness.id} />
    );
    expect(text).toContain("Aurelia Hair & Beauty Studio");
    expect(text).toContain("Beauty & Wellness");
    expect(text).toContain("Closed - opens at 10:00 AM Monday");
    expect(text).toContain("Test Street 14");
    expect(text).toContain("Larnaca");
    expect(text).toContain("Get Directions");
    expect(text).toContain("View Venue Profile");

    // Security & Privacy verification: Zero leakage of private owner email
    expect(text).not.toContain("owner@");
    expect(text).not.toContain("password");
    expect(text).not.toContain("credential");
  });

  // 11. Unified 2-Column Responsive Grid & Filter Navigation
  it("renders CustomerPackagesList with filter tabs and unified 2-column grid", async () => {
    vi.spyOn(packagesHooks, "useMyPackagesQuery").mockReturnValue({
      data: { packages: [mockLegacyPackage] },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof packagesHooks.useMyPackagesQuery>);

    vi.spyOn(packageViewHooks, "usePackageView").mockReturnValue({
      data: { packages: [mockFirstClassPackage] },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof packageViewHooks.usePackageView>);

    vi.spyOn(packagesHooks, "useVoidPackageMutation").mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof packagesHooks.useVoidPackageMutation>);

    const text = await render(<CustomerPackagesList />);

    // Verify filter tabs are rendered
    expect(text).toContain("All");
    expect(text).toContain("Active");
    expect(text).toContain("Action required");
    expect(text).toContain("History");

    // Both packages should be rendered in the unified grid
    const grid = host.querySelector(".grid");
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("md:grid-cols-2");
    expect(grid?.className).toContain("gap-6");

    expect(text).toContain("Platinum Priority Travel Suite");
    expect(text).toContain("Aurelia Signature Hair Care Package");
  });

  // 12. Filter Tab Switching Behavior
  it("filters packages accurately when clicking status tabs", async () => {
    vi.spyOn(packagesHooks, "useMyPackagesQuery").mockReturnValue({
      data: { packages: [mockLegacyPackage] },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof packagesHooks.useMyPackagesQuery>);

    vi.spyOn(packageViewHooks, "usePackageView").mockReturnValue({
      data: { packages: [mockFirstClassPackage] },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof packageViewHooks.usePackageView>);

    vi.spyOn(packagesHooks, "useVoidPackageMutation").mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof packagesHooks.useVoidPackageMutation>);

    await render(<CustomerPackagesList />);

    // Both mockFirstClassPackage (purchase incomplete) and mockLegacyPackage (AWAITING_BALANCE) are "Action required"
    const tabs = host.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    const actionRequiredTab = Array.from(tabs).find((t) => t.textContent?.includes("Action required"));
    expect(actionRequiredTab).toBeDefined();

    await act(async () => actionRequiredTab?.click());

    expect(host.textContent).toContain("Platinum Priority Travel Suite");
    expect(host.textContent).toContain("Aurelia Signature Hair Care Package");

    // Clicking "History" should show empty state
    const historyTab = Array.from(tabs).find((t) => t.textContent?.includes("History"));
    await act(async () => historyTab?.click());

    expect(host.textContent).toContain("No history packages found");
  });
});
