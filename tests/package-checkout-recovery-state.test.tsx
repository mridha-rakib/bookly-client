import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PackageConsentReview from "@/components/packages/PackageConsentReview";
import { acceptConsentTerms, getConsentOffer, getConsentPresentation, getRetainedConsentQuote, retainConsentQuote, type ConsentAction, type ConsentPresentation } from "@/lib/api/package-consent";
import { availabilityFor, selectAndAdvanceToPayment } from "./first-class-wizard-driver";

vi.mock("@/lib/api/package-consent", async (original) => ({ ...await original<object>(), acceptConsentTerms: vi.fn(), getConsentOffer: vi.fn(), getConsentPresentation: vi.fn(), getRetainedConsentQuote: vi.fn(), retainConsentQuote: vi.fn() }));
vi.mock("@/lib/auth/store", () => ({ useAuthStore: (select: (value: unknown) => unknown) => select({ user: { id: "customer" }, cacheEpoch: 5 }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
vi.mock("@/components/packages/PackagePurchaseContinuation", () => ({ PackagePurchaseContinuation: ({ available }: { available: boolean }) => <p>Server purchase readiness: {String(available)}</p> }));
vi.mock("@/lib/catalog/hooks", () => ({ useBusinessCatalogQuery: () => ({ data: undefined }), useServiceAvailabilityQuery: (_business: string, _service: string, params?: { staffMembershipId?: string }) => availabilityFor(params?.staffMembershipId) }));
vi.mock("next/image", () => ({ default: () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const presentation: ConsentPresentation = { version: 1, templateVersion: 1, presentationId: "presentation", challenge: "challenge", quoteHash: "quote", disclosureHash: "disclosure", text: "Original server disclosure", certification: "UNRESOLVED", purchaseAvailable: false };
let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); });
async function settle() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); }); }
async function render(operation: string | null = "original") { await act(async () => root.render(<QueryClientProvider client={client}><PackageConsentReview businessId="business" packageId="package" initialOperationId={operation ?? undefined} /></QueryClientProvider>)); await settle(); }
async function click(text: string) { await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!.click()); await settle(); }
it("a lost original presentation read can recover consent even after fallback quote readback succeeds", async () => {
  vi.mocked(getConsentPresentation).mockRejectedValueOnce(Error("offline")).mockResolvedValueOnce(presentation);
  vi.mocked(getRetainedConsentQuote).mockResolvedValue({ operationId: "original", acceptanceRecorded: false, quote: { quoteId: "quote", termsHash: "terms", issuedAt: "2030-08-19T08:00:00Z", expiresAt: "2030-08-19T08:30:00Z", timezone: "UTC", lifetimeMs: 1800000, certification: "UNRESOLVED", purchaseAvailable: false, name: "Bundle",
    financials: { currency: "EUR", bundlePriceCents: 10000, addonsCents: 0, travelCents: 0, normalTotalCents: 10000, requiredUpfrontCents: 0, manualVenueDuesCents: 10000, classification: "RETURNING" } } });
  await render(); await settle();
  expect(host.textContent).toContain("Server purchase readiness: false");
  await click("Retry original terms review");
  expect(host.textContent).toContain("Original server disclosure");
  expect(host.querySelector('input[type="checkbox"]')).not.toBeNull();
  expect(vi.mocked(getConsentPresentation).mock.calls).toEqual([["business", "original"], ["business", "original"]]);
  expect(retainConsentQuote).not.toHaveBeenCalled();
});
it("certification readback is retained with the presentation across a remount", async () => {
  vi.mocked(getConsentPresentation).mockResolvedValue(presentation);
  vi.mocked(acceptConsentTerms).mockImplementation(async (_business, _operation, action: ConsentAction) => ({ state: "ACCEPTED_IMMUTABLE", acceptanceId: "accepted", acceptedAt: "2030-08-19T10:00:00Z", presentationId: action.presentationId, quoteHash: action.quoteHash, disclosureHash: action.disclosureHash, eventId: action.eventId, certification: "CERTIFIED", purchaseAvailable: true }));
  await render();
  await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await click("Accept these terms");
  expect(client.getQueryData(["packageConsentPresentation", "customer", 5, "business", "original"])).toMatchObject({ certification: "CERTIFIED", purchaseAvailable: true });
  await act(async () => root.unmount()); root = createRoot(host);
  await render();
  expect(host.textContent).toContain("durable commit certified");
  expect(host.textContent).toContain("Server purchase readiness: true");
  expect(getConsentPresentation).toHaveBeenCalledTimes(1);
});
it("an explicit offer denial prevents a new quote even when appointment fields are filled", async () => {
  vi.mocked(getConsentOffer).mockResolvedValue({ businessId: "business", packageId: "package", name: "Bundle", revision: 2, timezone: "UTC", checkoutAvailable: false, checkoutUnavailableReason: "BATCH_AUTHORITY_UNAVAILABLE", items: [{ definitionItemId: "item", serviceId: "service", name: "Massage", quantity: 2, providers: [{ id: "staff", name: "Alex" }] }] });
  await render(null);
  await selectAndAdvanceToPayment(host, "Massage", "Alex");
  const review = [...host.querySelectorAll("button")].find((b) => b.textContent === "Get quote & review terms")!;
  expect(review.disabled).toBe(true);
  expect(host.textContent).toContain("awaiting server readiness");
  await act(async () => review.click());
  expect(retainConsentQuote).not.toHaveBeenCalled();
});
