import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CheckoutSummaryAside from "@/app/venue/components/CheckoutSummaryAside";
import BookingPolicyDetails from "@/app/venue/components/BookingPolicyDetails";
import type { BookingCreationPreview } from "@/lib/api/bookings";
import type { CatalogBusiness } from "@/lib/api/catalog";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => <span aria-hidden="true" /> }));

type Policy = NonNullable<CatalogBusiness["cancellationPolicy"]>;
const policy = (rates: [number | undefined, number | undefined, number | undefined, number | undefined, number | undefined], noShow: number): Policy => ({
  tiers: (["MORE_THAN_72_HOURS", "BETWEEN_24_AND_72_HOURS", "BETWEEN_12_AND_24_HOURS", "BETWEEN_2_AND_12_HOURS", "UNDER_2_HOURS"] as const)
    .map((tier, index) => rates[index] === undefined ? { tier, mode: "FREE" as const } : { tier, mode: "PERCENTAGE" as const, percentage: rates[index] }),
  noShowPercentage: noShow,
});
const business = (name: string, cancellationPolicy?: Policy | null) => ({ id: name, name, timezone: "Asia/Nicosia", address: { city: "Larnaca", area: "Centre", streetName: "Main", streetNumber: "1" }, media: [], cancellationPolicy } as unknown as CatalogBusiness);
const preview = (cancellationPolicy?: Policy, due = 1600): BookingCreationPreview => ({
  finalizable: true, isFirstBooking: true, business: { id: "a", name: "Aurelia", timezone: "Asia/Nicosia" },
  schedule: { timezone: "Asia/Nicosia", startAt: new Date(Date.now() + 100 * 3_600_000).toISOString(), endAt: new Date(Date.now() + 101 * 3_600_000).toISOString() },
  serviceLines: [], financials: { servicesSubtotalCents: 7000, addonsSubtotalCents: 1000, travelFeeCents: 500, eligiblePlatformFeeBasisCents: 8000, totalCents: 8500 },
  preTaxChargeCents: due, dueNowCents: due, balanceDueCents: 8500 - due, ...(cancellationPolicy ? { cancellationPolicy } : {}),
} as unknown as BookingCreationPreview);

let root: Root, host: HTMLDivElement;
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = (element: React.ReactElement) => act(async () => root.render(element));
const rows = () => [...host.querySelectorAll('[aria-label="Business cancellation policy"] li')].map((row) => row.textContent ?? "");

describe("Payment & Cancellation Policy", () => {
  it("shows the Business's five windows and no-show rate before a quote, without inventing amounts", async () => {
    await render(<BookingPolicyDetails business={business("Aurelia", policy([undefined, 20, 40, 60, 80], 90))} />);
    expect([...host.querySelectorAll('[aria-label="Business cancellation policy"] li p.font-semibold')].map((title) => title.textContent)).toEqual(["24 hours or more before the appointment", "12 to less than 24 hours before the appointment", "2 to less than 12 hours before the appointment", "Less than 2 hours before the appointment", "No-show: 90%"]);
    expect(rows()[0]).toContain("Free cancellation, no cancellation fee. Any deposit you paid online is refunded in full.");
    expect(rows()[1]).toContain("40% cancellation fee of the booking price — services and add-ons after any discount, excluding travel.");
    expect(rows()[2]).toContain("60% late-cancellation fee");
    expect(rows()[3]).toContain("80% late-cancellation fee");
    expect(rows()[4]).toContain("90% no-show fee");
    // The 24-72 h rate (20%) belongs to First-Class terms only.
    expect(rows().join(" ")).not.toContain("20%");
    expect(host.textContent).toContain("Your exact upfront payment and the amount due at the appointment are calculated with your quote.");
    expect(host.textContent).not.toMatch(/€|\{|\[X%\]/);
  });

  it("uses the quote's own policy, deposit, remaining balance and fee basis once quoted", async () => {
    await render(<BookingPolicyDetails business={business("Aurelia", policy([undefined, 30, 45, 60, 80], 90))} preview={preview(policy([undefined, 20, 40, 60, 80], 100))} />);
    expect(host.textContent).toContain("The quoted upfront payment of €16.00 is due now to secure your appointment and is credited against your booking total.");
    expect(host.textContent).toContain("The remaining €69.00 is due at the appointment.");
    expect(host.textContent).toContain("Payment is processed securely via Stripe.");
    expect(rows()[0]).toContain("Your deposit of €16.00 is refunded in full.");
    expect(rows()[1]).toContain("40% cancellation fee of €80.00 — services and add-ons, excluding travel.");
    expect(rows()[1]).toMatch(/From .+ until .+ \(Asia\/Nicosia\)\./);
    expect(rows()[4]).toContain("100% no-show fee of €80.00");
    expect(host.textContent).toContain("If you cancel within 24 hours of the appointment, the upfront payment is not refunded");
    expect(host.textContent).toContain("Cancellation and no-show fees, if any, are set by Aurelia");
  });

  it("states truthfully when a Business has no policy, and when the policy has not loaded", async () => {
    await render(<BookingPolicyDetails business={business("Bodhi", null)} />);
    expect(host.textContent).toContain("Bodhi has not set a cancellation policy, so no cancellation or no-show fee applies to this booking.");
    expect(rows().some((row) => row.includes("%"))).toBe(false);
    await render(<BookingPolicyDetails business={business("Bodhi")} />);
    expect(host.textContent).toContain("rates are shown here once they have loaded or with your quote");
    expect(host.textContent).not.toContain("has not set");
  });

  it("never shows one Business's rates in another Business's booking", async () => {
    await render(<BookingPolicyDetails business={business("Bodhi", policy([undefined, undefined, 50, 70, 100], 100))} />);
    expect(host.textContent).toContain("Bodhi cancellation policy");
    expect(host.textContent).not.toContain("Aurelia");
    expect(rows()[1]).toContain("50% cancellation fee");
    expect(rows()[2]).toContain("70% late-cancellation fee");
  });

  it("legacy Package Deal: windows forfeit the session instead of charging a fee", async () => {
    await render(<BookingPolicyDetails business={business("Aurelia", policy([undefined, 20, 40, 60, 80], 90))} preview={preview(policy([undefined, 20, 40, 60, 80], 90))} isPackagePurchase />);
    expect(rows()[0]).toContain("Free cancellation — the session returns to your package balance.");
    expect(rows()[1]).toContain("Late cancellation — the session is forfeited. No fee is charged.");
    expect(rows()[4]).toContain("Missing the appointment forfeits the session. No fee is charged.");
    expect(host.textContent).not.toMatch(/Your deposit of|Any deposit you paid online/);
    expect(rows().join(" ")).not.toContain("cancellation fee of");
    expect(host.textContent).toContain("to secure your first session");
  });

  it("is rendered inside the existing accordion, and First-Class terms passed by its flow are not replaced", async () => {
    const base = { bookingStep: "addons" as const, showPolicy: true, setShowPolicy: () => {}, onContinue: () => {}, canContinue: false };
    await render(<CheckoutSummaryAside {...base} business={business("Aurelia", policy([undefined, 20, 40, 60, 80], 90))} />);
    const toggle = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Payment & Cancellation Policy"))!;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)?.textContent).toContain("12 to less than 24 hours before the appointment");
    await render(<CheckoutSummaryAside {...base} business={business("Aurelia", policy([undefined, 20, 40, 60, 80], 90))} policyContent={<p>Exact First-Class agreement</p>} />);
    expect(host.textContent).toContain("Exact First-Class agreement");
    expect(host.textContent).not.toContain("12 to less than 24 hours before the appointment");
  });
});
