import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CheckoutSummaryAside from "@/app/venue/components/CheckoutSummaryAside";
import type { BookingCreationPreview } from "@/lib/api/bookings";
import type { BookingSelection } from "@/app/venue/components/BookingSelectionSummary";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => <span aria-hidden="true" /> }));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

const selection: BookingSelection = {
  name: "Hair appointment", durationLabel: "60 min", quantityLabel: "2 participants", indicativePriceCents: 5000,
  appointments: [{ id: "service", name: "Hair appointment", professional: "Amina", startAt: "2026-11-06T08:30:00.000Z", timezone: "Asia/Dhaka",
    locationLabel: "Professional visits your location", address: "Flat 3, Dhaka", addons: [{ id: "addon", name: "Deep conditioning", priceCents: 1200 }, { id: "addon-unknown", name: "Unknown priced add-on" }] }],
};

async function render(props: Partial<React.ComponentProps<typeof CheckoutSummaryAside>> = {}) {
  const base: React.ComponentProps<typeof CheckoutSummaryAside> = {
    bookingStep: "addons", selection, showPolicy: false, setShowPolicy: () => {}, onContinue: () => {}, canContinue: false,
  };
  await act(async () => root.render(<CheckoutSummaryAside {...base} {...props} />));
}

describe("progressive booking summary", () => {
  it("shows known selections and catalogue amounts before a quote without displaying unknown amounts as zero", async () => {
    await render();
    expect(host.textContent).toContain("Hair appointment");
    expect(host.textContent).toContain("60 min");
    expect(host.textContent).toContain("2 participants");
    expect(host.textContent).toContain("Amina");
    expect(host.textContent).toContain("Professional visits your location");
    expect(host.textContent).toContain("Flat 3, Dhaka");
    expect(host.textContent).toContain("Deep conditioning");
    expect(host.textContent).toContain("Amount pending quote");
    expect(host.textContent).toContain("Pending quote");
    expect(host.textContent).not.toContain("€0.00");
  });

  it("keeps the established policy prose and adds the server-resolved cancellation windows from the quote", async () => {
    const preview = {
      finalizable: true, isFirstBooking: true,
      business: { id: "business", name: "Aurelia", timezone: "Asia/Dhaka" },
      fulfilment: { mode: "AT_BUSINESS_LOCATION", businessLocation: { city: "Dhaka", area: "Gulshan", streetName: "Road", streetNumber: "1" } },
      serviceLines: [], financials: { servicesSubtotalCents: 5000, addonsSubtotalCents: 0, travelFeeCents: 0, totalCents: 5000 },
      preTaxChargeCents: 1000, dueNowCents: 1000, balanceDueCents: 4000, taxMode: "PRE_ACTIVATION", taxCents: 160,
      schedule: { timezone: "Asia/Dhaka", startAt: "2026-11-06T08:30:00.000Z", endAt: "2026-11-06T09:30:00.000Z" },
      cancellationPolicy: { tiers: [
        { tier: "MORE_THAN_72_HOURS", mode: "FREE" },
        { tier: "BETWEEN_24_AND_72_HOURS", mode: "PERCENTAGE", percentage: 20 },
        { tier: "BETWEEN_12_AND_24_HOURS", mode: "PERCENTAGE", percentage: 40 },
        { tier: "BETWEEN_2_AND_12_HOURS", mode: "PERCENTAGE", percentage: 60 },
        { tier: "UNDER_2_HOURS", mode: "PERCENTAGE", percentage: 80 },
      ], noShowPercentage: 80 },
    } as unknown as BookingCreationPreview;
    await render({ bookingStep: "payment", preview, showPolicy: true });
    expect(host.textContent).toContain("The quoted upfront payment of €10.00 is due now to secure your appointment and is credited against your booking total.");
    expect(host.textContent).toContain("Cancellation and no-show fees, if any, are set by Aurelia");
    // Approved v2 Normal Booking windows; the First-Class-only 72 h / 24-72 h rows are not shown.
    expect(host.textContent).toContain("24 hours or more before the appointment");
    expect(host.textContent).toContain("12 to less than 24 hours before the appointment");
    expect(host.textContent).toContain("2 to less than 12 hours before the appointment");
    expect(host.textContent).toContain("Less than 2 hours before the appointment");
    expect(host.textContent).not.toContain("72 hours");
    expect(host.textContent).toContain("No-show: 80%");
  });
});
