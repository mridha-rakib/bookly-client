import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PackageConsentReview from "@/components/packages/PackageConsentReview";
import { apiRequest } from "@/lib/api/client";
vi.mock("@/lib/api/client", async (original) => ({ ...await original<object>(), apiRequest: vi.fn() }));
vi.mock("@/lib/payments/stripe-client", () => ({ getStripe: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
const quote = (purchaseAvailable: boolean) => ({ quoteId: "quote", termsHash: "terms", issuedAt: "2030-08-19T08:00:00Z",
  expiresAt: "2030-08-19T08:30:00Z", timezone: "UTC", lifetimeMs: 1800000, certification: "CERTIFIED", purchaseAvailable, name: "Package",
  financials: { currency: "EUR", bundlePriceCents: 10000, addonsCents: 0, travelCents: 0, normalTotalCents: 10000, requiredUpfrontCents: 2500, manualVenueDuesCents: 7500, classification: "FIRST" } });
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); vi.mocked(apiRequest).mockReset(); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

async function renderRecovery(purchaseAvailable: boolean) {
  vi.mocked(apiRequest).mockImplementation((async (request: { url?: string }) => {
    // Expired presentation cannot be re-presented; the original retained quote remains readable.
    if (request.url?.endsWith("/presentation")) throw Error("Package terms expired");
    if (request.url?.endsWith("/quote")) return { operationId: "original", quote: quote(purchaseAvailable), acceptanceRecorded: true };
    throw Error(`unexpected ${request.url}`);
  }) as never);
  await act(async () => root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <PackageConsentReview businessId="business" packageId="package" initialOperationId="original" /></QueryClientProvider>));
  for (let i = 0; i < 20 && !host.textContent?.includes("Original purchase quote"); i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  return [...host.querySelectorAll("button")].find((b) => b.textContent === "Check original purchase status");
}

it("P4K: expired-terms recovery follows server purchase availability for status checks", async () => {
  const status = await renderRecovery(true);
  expect(status).toBeTruthy();
  expect(status?.disabled).toBe(false);
});

it("P4K: closed server gate keeps expired-terms recovery read-only", async () => {
  const status = await renderRecovery(false);
  expect(status?.disabled).toBe(true);
  expect(host.textContent).toContain("Purchase unavailable");
});
