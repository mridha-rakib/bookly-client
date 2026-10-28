import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CancellationReview, InitialAppointmentReview, OfferCard, OwnedPackageCard, PackageReadError, PaymentStatus, SessionReview, SettlementCard } from "@/components/packages/FirstClassPackageViews";
import { BooklyApiError } from "@/lib/api/client";
import { offer, owned, settlement, terms } from "./visual/package-view-fixtures";
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(element: React.ReactNode) { await act(async () => root.render(element)); return host.textContent ?? ""; }
describe("S6 truthful package presentation", () => {
  it("C01–04: exact mixed service quantities, Group seat rule and finite validity", async () => {
    const text = await render(<OfferCard offer={offer} detail />);
    for (const value of ["Restorative massage", "6 sessions", "4 sessions", "10 total sessions", "One credit = one participant / seat", "FINITE6", "€240.00"]) expect(text).toContain(value);
  });
  it("C02: FOREVER does not invent an expiry", async () => { expect(await render(<OfferCard offer={{ ...offer, validity: { mode: "FOREVER" } }} detail />)).toContain("No expiry"); });
  it("C05/C06: initial appointment required and checkout disabled", async () => {
    expect(await render(<OfferCard offer={offer} detail />)).toContain("at least one real initial appointment");
    expect([...host.querySelectorAll("button")].every((b) => b.disabled)).toBe(true);
  });
  it.each([0, 1, 3])("initial selection count %i never finalizes consent or fabricates remaining bookings", async (count) => {
    const appointments = Array.from({ length: count }, (_, index) => ({ id: String(index), service: `Service ${index}`, professional: "Alex", time: "2 Nov, 12:00 Asia/Nicosia", group: index === 1 }));
    const text = await render(<InitialAppointmentReview appointments={appointments} remainingCredits={10 - count} quoteState={count ? "STALE" : "UNAVAILABLE"} />);
    expect(host.querySelectorAll("li")).toHaveLength(count); expect(text).toContain(`Unscheduled credits: ${10 - count}`);
    expect(host.querySelector("button")).toBeNull();
    expect([...host.querySelectorAll('[role="status"]')].some((status) => status.textContent?.includes("Consent and purchase unavailable"))).toBe(true);
  });
  it("C07/C08/C13/C14/C16: exact disclosure, unchecked review, permitted provider/time and separate dues", async () => {
    const text = await render(<SessionReview remainingItems={[{ id: "group", name: "Movement" }]} terms={terms} />);
    expect(host.querySelector("pre")?.textContent).toBe(terms.disclosure);
    expect(host.querySelector<HTMLInputElement>("input")?.checked).toBe(false);
    for (const value of ["Alex", "Asia/Nicosia", "Travel €12.00", "Add-ons €5.00", "Purchased session base: €0.00"]) expect(text).toContain(value);
    await act(async () => host.querySelector<HTMLInputElement>("input")!.click());
    expect(host.querySelector("button")?.disabled).toBe(true);
  });
  it("C10–12: V2 counters remain separate and result remains unconfirmed", async () => {
    const text = await render(<OwnedPackageCard pkg={owned} detail />);
    for (const label of ["Remaining", "Scheduled", "Completed", "Forfeited", "Expired", "locked until", "Original initial appointment", "Later redeemed appointment", "Result unconfirmed / recovery pending"]) expect(text).toContain(label);
  });
  it("P2A: an unverified purchase shows no bookable credits and says the purchase is not completed", async () => {
    for (const purchaseCompletion of ["NOT_ESTABLISHED", undefined] as const) {
      const text = await render(<OwnedPackageCard pkg={{ ...owned, purchaseCompletion }} detail />);
      expect(text).toContain("Purchase not completed");
      expect(text).not.toContain("Book a remaining session");
    }
    const verified = await render(<OwnedPackageCard pkg={owned} detail />);
    expect(verified).not.toContain("Purchase not completed");
    expect(verified).toContain("Book a remaining session");
  });
  it("C15: pending payment never reads paid", async () => { const text = await render(<PaymentStatus state="PROCESSING" />); expect(text).toContain("processing"); expect(text).not.toContain("succeeded"); });
  it("C18: cancellation displays exact credit and monetary effects, mutation disabled", async () => {
    const text = await render(<CancellationReview terms={{ classification: "LATE", creditEffect: "FORFEITED", penaltyCents: 200, paymentState: "PROCESSING" }} />);
    for (const value of ["LATE", "FORFEITED", "€2.00"]) expect(text).toContain(value); expect(host.querySelector("button")?.disabled).toBe(true);
  });
  it.each(["PENDING", "NO_SHOW_CHARGED", "NO_SHOW_WAIVED", "REFUNDED", "REFUND_PENDING", "REQUIRES_ACTION", "SUCCEEDED", "FAILED", "NONE", "VENUE_DUE", "UNKNOWN", "new-provider-state"])("C19: payment/no-show state %s is explicit", async (state) => {
    const text = await render(<PaymentStatus state={state} />); expect(text.length).toBeGreaterThanOrEqual(8);
    if (["UNKNOWN", "new-provider-state"].includes(state)) { expect(text).toContain("unconfirmed"); expect(text).not.toContain("succeeded"); }
  });
  it("C20: settlement distinguishes origin and later dues; all actions disabled", async () => {
    const text = await render(<SettlementCard view={settlement} />);
    for (const value of [owned.originBookingId, "Venue-attested", "not independent bank"]) expect(text).toContain(value);
    expect([...host.querySelectorAll("button")].every((b) => b.disabled)).toBe(true);
  });
  it.each([401, 403, 404, 409, 429, 503])("C21: HTTP %i visible accessible error", async (status) => {
    await render(<PackageReadError error={new BooklyApiError({ message: "private internal failure", status })} />);
    expect(host.querySelector('[role="alert"]')).not.toBeNull(); expect(host.textContent).not.toContain("private internal failure");
  });
  it("stale quote disables review; unavailable form has no fake providers or times", async () => {
    expect(await render(<SessionReview remainingItems={[]} terms={{ ...terms, quoteState: "STALE" }} />)).toContain("Quote stale");
    expect(host.querySelector<HTMLInputElement>("input")?.disabled).toBe(true);
    await render(<SessionReview remainingItems={[]} />); expect([...host.querySelectorAll("select")].every((s) => s.disabled)).toBe(true);
  });
  it("S6-V2: one teal primary checkout control, readable disabled treatment and unchanged text links", async () => {
    await render(<OfferCard offer={offer} detail />);
    const buttons = host.querySelectorAll("button"); expect(buttons).toHaveLength(1);
    const checkout = buttons[0]; expect(checkout.disabled).toBe(true);
    expect(checkout.className).toContain("bg-[#2E9DA7]");
    expect(checkout.className).toContain("rounded-[12px]");
    expect(checkout.className).toContain("disabled:text-[#0D0D0D]");
    expect(checkout.className).not.toContain("240183");
    await act(async () => checkout.click()); expect(host.textContent).toContain("No purchase, charge or booking will be made");
    await render(<OfferCard offer={offer} />);
    expect(host.querySelector("a")?.className).toContain("text-[#240183]");
  });
  it("S6-V2: session primary is teal; cancellation and settlement alternatives stay secondary", async () => {
    await render(<SessionReview remainingItems={[]} />);
    expect(host.querySelector("button")?.className).toContain("bg-[#2E9DA7]");
    await render(<CancellationReview />);
    expect(host.querySelector("button")?.className).not.toContain("bg-[#2E9DA7]");
    await render(<SettlementCard view={settlement} />);
    for (const action of host.querySelectorAll("button")) { expect(action.disabled).toBe(true); expect(action.className).not.toContain("bg-[#240183]"); }
  });
});
