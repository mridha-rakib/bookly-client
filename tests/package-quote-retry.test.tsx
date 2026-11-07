import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import PackageConsentReview from "@/components/packages/PackageConsentReview";
import { getConsentOffer, getConsentPresentation, retainConsentQuote } from "@/lib/api/package-consent";
import { availabilityFor, selectAndAdvanceToPayment, wizardStartAt } from "./first-class-wizard-driver";
vi.mock("@/lib/api/package-consent", async (original) => ({ ...await original<object>(), getConsentOffer: vi.fn(), getConsentPresentation: vi.fn(), retainConsentQuote: vi.fn() }));
vi.mock("@/lib/catalog/hooks", () => ({ useBusinessCatalogQuery: () => ({ data: undefined }), useServiceAvailabilityQuery: (_business: string, _service: string, params?: { staffMembershipId?: string }) => availabilityFor(params?.staffMembershipId) }));
vi.mock("next/image", () => ({ default: () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it("a lost quote response freezes its intent and retries the same operation after the URL updates", async () => {
  vi.mocked(getConsentOffer).mockResolvedValue({ businessId: "business", packageId: "package", name: "Bundle", revision: 2, timezone: "UTC", items: [{ definitionItemId: "item", serviceId: "service", name: "Massage", quantity: 2, providers: [{ id: "staff", name: "Alex" }] }] });
  vi.mocked(retainConsentQuote).mockRejectedValue(new Error("response lost"));
  const host = document.createElement("div"), root = createRoot(host), client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  document.body.append(host);
  const render = async (operation?: string) => {
    await act(async () => root.render(<QueryClientProvider client={client}><PackageConsentReview businessId="business" packageId="package" initialOperationId={operation} /></QueryClientProvider>));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  };
  const click = async (text: string) => { await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent?.includes(text))!.click()); };
  try {
    window.history.replaceState({ retainedRouterState: true }, "", "/?section=Packages#appointments");
    await render(); await selectAndAdvanceToPayment(host, "Massage", "Alex"); await click("Get quote & review terms");
    const original = vi.mocked(retainConsentQuote).mock.calls[0]!;
    expect(original[2].selections).toEqual([expect.objectContaining({ serviceId: "service", staffMembershipId: "staff", startAt: wizardStartAt, addonIds: [] })]);
    expect(new URL(window.location.href).searchParams.get("section")).toBe("Packages");
    expect(new URL(window.location.href).searchParams.get("operation")).toBe(original[1]);
    expect(window.location.hash).toBe("#appointments");
    expect(window.history.state).toEqual({ retainedRouterState: true });
    // The quoted selections are frozen: the shared Services card can no longer change them.
    expect(host.querySelector('[aria-current="step"] [data-step-label]')?.textContent).toBe("Payment");
    await render(original[1]);
    expect(getConsentPresentation).not.toHaveBeenCalled();
    await click("Retry original terms request");
    expect(vi.mocked(retainConsentQuote).mock.calls[1]).toEqual(original);
  } finally { await act(async () => root.unmount()); host.remove(); client.clear(); window.history.replaceState(null, "", "/"); }
});
