import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PackageConsentReview from "@/components/packages/PackageConsentReview";
import { getConsentOffer, getConsentPresentation, retainConsentQuote, type ConsentOffer } from "@/lib/api/package-consent";
import { availabilityFor, continueButton, press, wizardStartAt } from "./first-class-wizard-driver";

vi.mock("@/lib/api/package-consent", async (original) => ({ ...await original<object>(), getConsentOffer: vi.fn(), getConsentPresentation: vi.fn(), retainConsentQuote: vi.fn() }));
vi.mock("@/lib/catalog/hooks", () => ({ useBusinessCatalogQuery: () => ({ data: undefined }), useServiceAvailabilityQuery: (_business: string, _service: string, params?: { staffMembershipId?: string }) => availabilityFor(params?.staffMembershipId) }));
vi.mock("@/lib/auth/store", () => ({ useAuthStore: (select: (value: unknown) => unknown) => select({ user: { id: "customer" }, cacheEpoch: 1 }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/packages/PackagePurchaseContinuation", () => ({ PackagePurchaseContinuation: () => <p>Original purchase continuation</p> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const offer = (travel = false): ConsentOffer => ({
  businessId: "business", packageId: "package", name: "Spa Bundle", revision: 3, timezone: "UTC", checkoutAvailable: true,
  fulfilmentMode: travel ? "TRAVEL_TO_CUSTOMER" : "AT_BUSINESS_LOCATION",
  items: [
    { definitionItemId: "massage-item", serviceId: "massage", name: "Massage", quantity: 2, travelCities: ["Larnaca"],
      providers: [{ id: "alex", name: "Alex" }, { id: "cara", name: "Cara" }], addons: [{ id: "oil", name: "Oil", priceCents: 500 }] },
    { definitionItemId: "facial-item", serviceId: "facial", name: "Facial", quantity: 1, travelCities: ["Larnaca"], providers: [{ id: "bea", name: "Bea" }], addons: [] },
  ],
});
let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); window.history.replaceState(null, "", "/customer/package-consent/business/package");
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); });
async function render() {
  await act(async () => root.render(<QueryClientProvider client={client}><PackageConsentReview businessId="business" packageId="package" /></QueryClientProvider>));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}
const current = () => host.querySelector('[aria-current="step"] [data-step-label]')?.textContent;
const progress = () => [...host.querySelectorAll('nav[aria-label="Booking progress"] [data-step-label]')].map((label) => label.textContent).join("");
const stepButton = (label: string) => (b: HTMLButtonElement) => b.querySelector("[data-step-label]")?.textContent === label;
const aside = () => host.querySelector("#wizard-aside")?.textContent ?? "";
const next = () => press(host, (b) => b === continueButton(host), "Continue");
const byLabel = (label: string) => press(host, (b) => b.getAttribute("aria-label") === label, label);
async function chooseProfessional(name: string) {
  const card = [...host.querySelectorAll("h4")].find((heading) => heading.textContent === name)!.closest("div.cursor-pointer") as HTMLElement;
  await act(async () => card.click());
}
async function chooseTime() {
  // The calendar month is shared between appointments, as in Normal Booking's single calendar.
  if (![...host.querySelectorAll("button")].some((b) => b.textContent?.trim() === "15" && !b.disabled)) await byLabel("Show next month");
  await press(host, (b) => b.textContent?.trim() === "15" && !b.disabled, "Date 15");
  await press(host, (b) => b.hasAttribute("aria-pressed") && /\d{1,2}:\d{2}/.test(b.textContent ?? ""), "Slot");
}
async function type(selector: string, value: string) {
  await act(async () => {
    const field = host.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector)!;
    const proto = field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true })); field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

it("configures several initial appointments through the shared Normal Booking steps", async () => {
  vi.mocked(getConsentOffer).mockResolvedValue(offer());
  vi.mocked(retainConsentQuote).mockResolvedValue({ operationId: "x" });
  vi.mocked(getConsentPresentation).mockResolvedValue({ version: 1, templateVersion: 1, presentationId: "p", challenge: "c", quoteHash: "q", disclosureHash: "d", text: "Full First-Class agreement text" });
  await render();
  expect(progress()).toBe("ServicesAdd-onsProfessionalsTimePaymentConfirm");
  expect(continueButton(host)!.disabled).toBe(true);
  await byLabel("Book Massage"); await byLabel("Increase Initial appointments"); await byLabel("Book Facial");
  expect(aside()).toContain("3 initial appointments selected");
  await next();
  expect(current()).toBe("Add-ons");
  expect(host.querySelectorAll('[aria-label="Appointment being configured"] button')).toHaveLength(3);
  await byLabel("Add Oil");
  expect(aside()).toContain("Oil");
  expect(continueButton(host)!.textContent).toBe("Next: Appointment 2 →");
  expect(host.textContent).toContain("3 of 3 ready for this step");
  await next(); await next();
  expect(host.textContent).toContain("No add-ons are available for this service.");
  await next();
  expect(current()).toBe("Professionals");
  expect(host.textContent).not.toContain("No Preference");
  expect(host.textContent).toContain("0 of 3 ready for this step");
  expect(host.textContent).toContain("Needs a professional");
  expect(continueButton(host)!.disabled).toBe(true);
  await chooseProfessional("Alex"); await next();
  await chooseProfessional("Cara"); await next();
  const cards = () => [...host.querySelectorAll("h4")].map((heading) => heading.textContent);
  expect(cards()).toContain("Bea");
  expect(cards()).not.toContain("Alex");
  await chooseProfessional("Bea"); await next();
  expect(current()).toBe("Time");
  for (let index = 0; index < 3; index++) { await chooseTime(); await next(); }
  expect(current()).toBe("Payment");
  expect(aside()).toContain("Appointment 3: Facial");
  expect(aside()).toContain("Professional: Bea");
  expect(retainConsentQuote).not.toHaveBeenCalled();
  await press(host, (b) => b.textContent === "Get quote & review terms", "Get quote");
  const [, , intent] = vi.mocked(retainConsentQuote).mock.calls[0]!;
  expect(intent.selections.map(({ serviceId, staffMembershipId, startAt, addonIds }) => ({ serviceId, staffMembershipId, startAt, addonIds }))).toEqual([
    { serviceId: "massage", staffMembershipId: "alex", startAt: wizardStartAt, addonIds: ["oil"] },
    { serviceId: "massage", staffMembershipId: "cara", startAt: wizardStartAt, addonIds: [] },
    { serviceId: "facial", staffMembershipId: "bea", startAt: wizardStartAt, addonIds: [] },
  ]);
  expect(intent.selections.every((row) => !("travelAddress" in row))).toBe(true);
  expect(host.querySelector('[aria-label="Exact Package terms"]')!.textContent).toBe("Full First-Class agreement text");
  expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
  expect([...host.querySelectorAll("button")].find((b) => b.textContent === "Accept these terms")!.disabled).toBe(true);
  expect(host.textContent).toContain("Tick the box to confirm you have read and agree to the full agreement above.");
});

it("collects each appointment's travel destination in the shared Location step and invalidates stale times", async () => {
  vi.mocked(getConsentOffer).mockResolvedValue(offer(true));
  await render();
  expect(progress()).toContain("Location");
  await byLabel("Book Facial"); await next(); await next();
  expect(current()).toBe("Location");
  expect(continueButton(host)!.disabled).toBe(true);
  const selects = () => host.querySelectorAll("select");
  await act(async () => undefined);
  await type("select", "Larnaca");
  expect(selects()[0]!.value).toBe("Larnaca");
  await act(async () => {
    const property = selects()[1]!; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(property, "Apartment");
    property.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await type('input[placeholder="e.g. Mackenzie, Finikoudes"]', "Center");
  await type('input[placeholder="e.g. Emrou"]', "Main");
  expect(continueButton(host)!.disabled).toBe(true);
  await type('input[placeholder="e.g. 14"]', "4");
  expect(aside()).toContain("Professional visits your location");
  expect(aside()).toContain("Main, 4, Center, Larnaca");
  await next(); await chooseProfessional("Bea"); await next(); await chooseTime();
  expect(continueButton(host)!.disabled).toBe(false);
  // Going back and changing the professional-independent city clears the dependent time.
  await press(host, stepButton("Location"), "Location step");
  await type("select", "");
  await type("select", "Larnaca");
  await next(); await next();
  expect(current()).toBe("Time");
  expect(continueButton(host)!.disabled).toBe(true);
});

it("an unaccepted quote can be explicitly discarded to change appointments; nothing re-quotes on navigation", async () => {
  vi.mocked(getConsentOffer).mockResolvedValue(offer());
  vi.mocked(retainConsentQuote).mockResolvedValue({ operationId: "x" });
  vi.mocked(getConsentPresentation).mockResolvedValue({ version: 1, templateVersion: 1, presentationId: "p", challenge: "c", quoteHash: "q", disclosureHash: "d", text: "Agreement" });
  await render();
  await byLabel("Book Facial"); await next(); await next(); await chooseProfessional("Bea"); await next(); await chooseTime(); await next();
  await press(host, (b) => b.textContent === "Get quote & review terms", "Get quote");
  const operation = new URL(window.location.href).searchParams.get("operation");
  expect(operation).toBe(vi.mocked(retainConsentQuote).mock.calls[0]![1]);
  // Reviewing earlier steps keeps the quoted selections frozen and issues nothing new.
  await press(host, stepButton("Services"), "Services step");
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Selected Facial"]')!.disabled).toBe(true);
  await next(); await next(); await next(); await next();
  expect(retainConsentQuote).toHaveBeenCalledTimes(1);
  expect(current()).toBe("Payment");
  await press(host, (b) => b.textContent?.startsWith("Change appointments") === true, "Change appointments");
  expect(current()).toBe("Services");
  expect(new URL(window.location.href).searchParams.get("operation")).toBeNull();
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Selected Facial"]')!.disabled).toBe(false);
  expect(retainConsentQuote).toHaveBeenCalledTimes(1);
});
