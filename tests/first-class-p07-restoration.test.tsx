import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PackageConsentReview from "@/components/packages/PackageConsentReview";
import {
  acceptConsentTerms, getConsentOffer, getConsentPresentation, getRetainedConsentQuote, retainConsentQuote,
  type ConsentPresentation, type RetainedPurchaseQuote,
} from "@/lib/api/package-consent";
import { availabilityFor, continueButton, press, wizardDate, wizardStartAt } from "./first-class-wizard-driver";

vi.mock("@/lib/api/package-consent", async (original) => ({ ...await original<object>(), acceptConsentTerms: vi.fn(), getConsentOffer: vi.fn(), getConsentPresentation: vi.fn(), getRetainedConsentQuote: vi.fn(), retainConsentQuote: vi.fn() }));
vi.mock("@/lib/auth/store", () => ({ useAuthStore: (select: (value: unknown) => unknown) => select({ user: { id: "customer" }, cacheEpoch: 5 }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
vi.mock("@/components/packages/PackagePurchaseContinuation", () => ({ PackagePurchaseContinuation: ({ available }: { available: boolean }) => <p>Server purchase readiness: {String(available)}</p> }));
vi.mock("@/lib/catalog/hooks", () => ({
  useBusinessCatalogQuery: () => ({ data: { business: { name: "Venue", visitType: "AT_BUSINESS_LOCATION", timezone: "UTC", address: { streetName: "Main St", streetNumber: "4", area: "Centre", city: "Nicosia" } }, services: [], staff: [
    { id: "s1", firstName: "Alex", lastName: "One", role: "STAFF" }, { id: "s2", firstName: "Sam", lastName: "Two", role: "STAFF" }] } }),
  useServiceAvailabilityQuery: (_business: string, _service: string, params?: { staffMembershipId?: string }) => availabilityFor(params?.staffMembershipId),
}));
vi.mock("next/image", () => ({ default: () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const AGREEMENT = "Original server First-Class agreement text";
// Two different services, each with its own professional, add-on, location and amounts.
const quote: RetainedPurchaseQuote = {
  quoteId: "quote", termsHash: "terms", issuedAt: "2030-08-19T08:00:00Z", expiresAt: "2030-08-19T08:30:00Z", timezone: "Asia/Nicosia",
  lifetimeMs: 1800000, certification: "UNRESOLVED", purchaseAvailable: false, name: "Glow Bundle",
  financials: { currency: "EUR", bundlePriceCents: 20000, addonsCents: 1500, travelCents: 0, normalTotalCents: 21500, requiredUpfrontCents: 0, manualVenueDuesCents: 21500, classification: "RETURNING" },
  items: [{ serviceId: "svcA", name: "Massage", quantity: 3 }, { serviceId: "svcB", name: "Facial", quantity: 2 }],
  appointments: [
    { selectionId: "a1", definitionItemId: "itemA", serviceId: "svcA", serviceName: "Massage", staffMembershipId: "s1", startAt: "2030-08-20T07:00:00.000Z", endAt: "2030-08-20T08:00:00.000Z", durationMin: 60,
      addons: [{ id: "oil", name: "Hot oil", priceCents: 1500 }], location: { mode: "AT_BUSINESS_LOCATION", address: { streetName: "Main St", streetNumber: "4", city: "Nicosia" } },
      financials: { includedBaseCents: 12000, addonsCents: 1500, travelCents: 0, upfrontCents: 0, manualVenueDuesCents: 13500 } },
    { selectionId: "a2", definitionItemId: "itemB", serviceId: "svcB", serviceName: "Facial", staffMembershipId: "s2", startAt: "2030-08-21T09:30:00.000Z", endAt: "2030-08-21T10:15:00.000Z", durationMin: 45,
      addons: [], location: { mode: "AT_BUSINESS_LOCATION", address: { streetName: "Main St", streetNumber: "4", city: "Nicosia" } },
      financials: { includedBaseCents: 8000, addonsCents: 0, travelCents: 0, upfrontCents: 0, manualVenueDuesCents: 8000 } },
  ],
};
const presentation: ConsentPresentation = { version: 1, templateVersion: 1, presentationId: "presentation", challenge: "challenge", quoteHash: "quote", disclosureHash: "disclosure", text: AGREEMENT, certification: "UNRESOLVED", purchaseAvailable: false, quote };

let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); });
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
async function render(operation?: string) {
  await act(async () => root.render(<QueryClientProvider client={client}><PackageConsentReview businessId="business" packageId="package" initialOperationId={operation} /></QueryClientProvider>));
  await settle();
}
const appointment = (index: number) => host.querySelector(`#wizard-aside article[aria-label="Appointment ${index}"]`)?.textContent ?? "";
const occurrences = (text: string) => host.innerHTML.split(text).length - 1;
const openPolicy = async () => {
  const toggle = [...host.querySelectorAll<HTMLButtonElement>("#wizard-aside button")].find((b) => b.textContent?.includes("Payment & Cancellation Policy"));
  if (!toggle) throw Error("Missing policy accordion");
  await act(async () => toggle.click()); await settle();
};

it("P0.7 refresh restores every appointment from the server quote, not browser storage, without reissuing anything", async () => {
  vi.mocked(getConsentPresentation).mockResolvedValue(presentation);
  await render("original");
  expect(sessionStorage.length).toBe(0);
  expect(appointment(1)).toContain("Appointment 1: Massage");
  expect(appointment(1)).toContain("Alex One");
  expect(appointment(1)).toContain("Hot oil");
  expect(appointment(1)).toContain("(quoted)");
  expect(appointment(1)).toContain("Main St, 4, Nicosia");
  expect(appointment(1)).toContain("1 hr per session");
  expect(appointment(1)).toContain("€135.00");
  expect(appointment(1)).toContain("10:00");
  expect(appointment(2)).toContain("Appointment 2: Facial");
  expect(appointment(2)).toContain("Sam Two");
  expect(appointment(2)).toContain("45 min per session");
  expect(appointment(2)).toContain("12:30");
  // Add-ons stay with their own appointment.
  expect(appointment(2)).not.toContain("Hot oil");
  expect(host.textContent).toContain("2 initial appointments selected · 5 included sessions · 3 kept as credits");
  expect(host.textContent).toContain("Quoted · not booked until the purchase is verified");
  expect(getConsentPresentation).toHaveBeenCalledTimes(1);
  expect(getConsentOffer).not.toHaveBeenCalled();
  expect(retainConsentQuote).not.toHaveBeenCalled();
  expect(acceptConsentTerms).not.toHaveBeenCalled();
});

it("P0.7 the full agreement appears once; the summary accordion points to it", async () => {
  vi.mocked(getConsentPresentation).mockResolvedValue(presentation);
  await render("original");
  await openPolicy();
  expect(occurrences(AGREEMENT)).toBe(1);
  expect(host.querySelector("#package-agreement-text")?.textContent).toBe(AGREEMENT);
  expect(host.textContent).toContain("It is shown once, in full, in the Payment step");
  expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Read the full agreement in the Payment step")).toBe(true);
  expect(host.querySelector('input[type="checkbox"]')).not.toBeNull();
});

it("P0.7 another sign-in session reads the original quote with its appointments, cannot accept, and starts nothing new", async () => {
  vi.mocked(getConsentPresentation).mockRejectedValue(Error("These terms or your session have changed. Start a fresh terms review."));
  vi.mocked(getRetainedConsentQuote).mockResolvedValue({ operationId: "original", acceptanceRecorded: false, quote });
  await render("original");
  // Two chained reads (presentation, then original quote); wait for both under a loaded runner.
  for (let i = 0; i < 40 && !host.textContent?.includes("could not be shown here"); i++) await settle();
  expect(host.textContent).toContain("The agreement for this quote could not be shown here.");
  expect(host.textContent).toContain("the deadline is not renewed");
  expect(appointment(1)).toContain("Massage");
  expect(appointment(2)).toContain("Facial");
  expect(host.querySelector('input[type="checkbox"]')).toBeNull();
  expect(host.querySelector("a")?.getAttribute("href")).toBe("/customer/package-consent/business/package");
  expect(retainConsentQuote).not.toHaveBeenCalled();
  expect(acceptConsentTerms).not.toHaveBeenCalled();
  expect(getRetainedConsentQuote).toHaveBeenCalledTimes(1);
});

it("P0.7 browsing calendar months keeps an appointment's chosen time", async () => {
  vi.mocked(getConsentOffer).mockResolvedValue({ businessId: "business", packageId: "package", name: "Glow Bundle", revision: 1, timezone: "UTC", checkoutAvailable: true,
    items: [{ definitionItemId: "itemA", serviceId: "service", name: "Massage", quantity: 1, providers: [{ id: "s1", name: "Alex One" }] }] });
  await render();
  await press(host, (b) => b.getAttribute("aria-label") === "Book Massage", "Book Massage");
  await press(host, (b) => b === continueButton(host), "Continue (services)");
  await press(host, (b) => b === continueButton(host), "Continue (add-ons)");
  const card = [...host.querySelectorAll("h4")].find((h) => h.textContent === "Alex One")?.closest("div.cursor-pointer") as HTMLElement;
  await act(async () => card.click());
  await press(host, (b) => b === continueButton(host), "Continue (professionals)");
  await press(host, (b) => b.getAttribute("aria-label") === "Show next month", "Show next month");
  await press(host, (b) => b.textContent?.trim() === String(Number(wizardDate.slice(-2))) && !b.disabled, "Date");
  await press(host, (b) => b.hasAttribute("aria-pressed") && /\d{1,2}:\d{2}/.test(b.textContent ?? ""), "Slot");
  expect(continueButton(host)?.disabled).toBe(false);
  await press(host, (b) => b.getAttribute("aria-label") === "Show next month", "Show next month again");
  await press(host, (b) => b.getAttribute("aria-label") === "Show previous month", "Back a month");
  expect(continueButton(host)?.disabled).toBe(false);
  expect(appointment(1) || host.querySelector("#wizard-aside")?.textContent).toContain(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(wizardStartAt)));
});
