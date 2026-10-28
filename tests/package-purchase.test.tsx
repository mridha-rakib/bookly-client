import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PackagePurchaseContinuation } from "@/components/packages/PackagePurchaseContinuation";
import { packagePurchaseApi } from "@/lib/api/package-purchase";
import { apiRequest } from "@/lib/api/client";
import { getStripe } from "@/lib/payments/stripe-client";
import type { RetainedPurchaseQuote } from "@/lib/api/package-consent";
vi.mock("@/lib/api/client", async (original) => ({ ...await original<object>(), apiRequest: vi.fn() }));
vi.mock("@/lib/payments/stripe-client", () => ({ getStripe: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const quote: RetainedPurchaseQuote = { quoteId: "quote", termsHash: "terms", issuedAt: "2030-08-19T08:00:00Z", expiresAt: "2030-08-19T08:30:00Z", timezone: "UTC", lifetimeMs: 1800000, certification: "CERTIFIED", purchaseAvailable: true, name: "Package",
  financials: { currency: "EUR", bundlePriceCents: 10000, addonsCents: 500, travelCents: 0, normalTotalCents: 10500, requiredUpfrontCents: 2500, manualVenueDuesCents: 8000, classification: "FIRST" } };
const base = { operationId: "original", quoteId: "quote", termsHash: "terms", disclosureHash: "disclosure", issuedAt: quote.issuedAt, expiresAt: quote.expiresAt, canStartNewQuote: false };
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); sessionStorage.clear(); vi.mocked(apiRequest).mockReset(); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function render(available = true, q = quote) { await act(async () => root.render(<QueryClientProvider client={new QueryClient()}><PackagePurchaseContinuation businessId="business" operationId="original" quote={q} accepted available={available} /></QueryClientProvider>)); }
async function click(text: string) { await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === text)!.click()); }
it("purchase and status always use the original Customer operation selector", async () => {
  vi.mocked(apiRequest).mockResolvedValue({ ...base, state: "UNRESOLVED" });
  await packagePurchaseApi.complete("business", "original"); await packagePurchaseApi.status("business", "original");
  expect(apiRequest).toHaveBeenNthCalledWith(1, { method: "POST", url: "/package-views/actions/purchase", data: { businessId: "business", operationId: "original" } });
  expect(apiRequest).toHaveBeenNthCalledWith(2, { method: "POST", url: "/package-views/actions/purchase-status", data: { businessId: "business", operationId: "original" } });
});
it("uncertified or activation-disabled checkout is unavailable, without payment dispatch", async () => {
  await render(false, { ...quote, certification: "UNRESOLVED", purchaseAvailable: false });
  expect([...host.querySelectorAll("button")].every((b) => b.disabled)).toBe(true);
  expect(host.textContent).toContain("Purchase unavailable"); expect(apiRequest).not.toHaveBeenCalled();
});
it("pending provider success does not imply a Package purchase or usable credits", async () => {
  vi.mocked(apiRequest).mockResolvedValue({ ...base, state: "PAYMENT_PENDING", providerStatus: "SUCCEEDED", persistenceStatus: "NOT_STARTED" });
  await render(); await click("Purchase this Package");
  expect(host.textContent).toContain("Purchase unconfirmed"); expect(host.textContent).not.toContain("Package purchase verified by the server");
  expect(host.querySelector("a")).toBeNull();
});
it("3DS continuation replays completion and persists no client secret", async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...base, state: "PAYMENT_PENDING", providerStatus: "REQUIRES_ACTION", clientSecret: "ephemeral-secret" })
    .mockResolvedValueOnce({ ...base, state: "COMPLETE", purchaseCompletion: "VERIFIED", packageProgressId: "progress", bookingIds: ["booking"] });
  const confirm = vi.fn(async () => ({})); vi.mocked(getStripe).mockResolvedValue({ confirmCardPayment: confirm } as never);
  await render(); await click("Purchase this Package"); await click("Continue secure payment authentication");
  expect(confirm).toHaveBeenCalledWith("ephemeral-secret");
  expect(vi.mocked(apiRequest).mock.calls[0]?.[0].data).toEqual(vi.mocked(apiRequest).mock.calls[1]?.[0].data);
  expect(host.textContent).toContain("Package purchase verified by the server");
  expect(host.querySelector("a")?.href).toContain("progress?kind=first-class");
  expect(JSON.stringify(sessionStorage)).not.toContain("ephemeral-secret");
});
it("refund pending is not completed reimbursement", async () => {
  vi.mocked(apiRequest).mockResolvedValue({ ...base, state: "COMPENSATION", compensationStatus: "REFUND_PENDING" });
  await render(); await click("Purchase this Package");
  expect(host.textContent).toContain("reimbursement is not confirmed"); expect(host.querySelector("a")).toBeNull();
});
it("expired quotes disable new purchase but still allow an explicit original status check", async () => {
  await render(true, { ...quote, issuedAt: "2000-01-01T00:00:00Z", expiresAt: "2000-01-01T00:30:00Z" });
  const buttons = [...host.querySelectorAll("button")]; expect(buttons.find((b) => b.textContent === "Purchase this Package")?.disabled).toBe(true);
  expect(buttons.find((b) => b.textContent === "Check original purchase status")?.disabled).toBe(false);
});
it("reload consults status with the same operation; it never restores a cached payment success", async () => {
  await render(); expect(host.textContent).not.toContain("Package purchase verified by the server");
  vi.mocked(apiRequest).mockResolvedValue({ ...base, state: "UNRESOLVED" }); await click("Check original purchase status");
  expect(apiRequest).toHaveBeenCalledWith(expect.objectContaining({ data: { businessId: "business", operationId: "original" } }));
});
const expired = { ...quote, issuedAt: "2000-01-01T00:00:00Z", expiresAt: "2000-01-01T00:30:00Z" };
it("P4K-1/5: after the deadline, a server-reported PERSISTING purchase resumes the same original operation", async () => {
  await render(true, expired);
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...base, ...expired, state: "PAYMENT_PENDING", providerStatus: "SUCCEEDED", persistenceStatus: "PERSISTING", compensationStatus: "NOT_REQUIRED" })
    .mockResolvedValueOnce({ ...base, ...expired, state: "COMPLETE", purchaseCompletion: "VERIFIED", packageProgressId: "progress", bookingIds: ["booking"] });
  await click("Check original purchase status");
  const retry = [...host.querySelectorAll("button")].find((b) => b.textContent === "Retry original purchase");
  expect(retry?.disabled).toBe(false);
  await click("Retry original purchase");
  expect(vi.mocked(apiRequest).mock.calls[1]?.[0]).toEqual({ method: "POST", url: "/package-views/actions/purchase", data: { businessId: "business", operationId: "original" } });
  expect(host.textContent).toContain("Package purchase verified by the server");
});
it("P4K-1: after the deadline, a never-started operation cannot start and compensation cannot be retried", async () => {
  await render(true, expired);
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...base, ...expired, state: "CONSENT_PENDING" });
  await click("Check original purchase status");
  expect([...host.querySelectorAll("button")].find((b) => b.textContent === "Purchase this Package")?.disabled).toBe(true);
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...base, ...expired, state: "COMPENSATION", compensationStatus: "REFUND_PENDING" });
  await click("Check original purchase status");
  expect([...host.querySelectorAll("button")].find((b) => b.textContent === "Purchase this Package")?.disabled).toBe(true);
  expect(apiRequest).toHaveBeenCalledTimes(2);
  expect(vi.mocked(apiRequest).mock.calls.every(([request]) => request.url === "/package-views/actions/purchase-status")).toBe(true);
});
it.each([
  ["3DS pending", { providerStatus: "REQUIRES_ACTION", persistenceStatus: "NOT_STARTED", clientSecret: "pi_secret" }],
  ["paid but persistence not started", { providerStatus: "SUCCEEDED", persistenceStatus: "NOT_STARTED" }],
] as const)("P4K-5: after the deadline, a PREPARED purchase (%s) offers neither retry nor authentication", async (_label, attempt) => {
  await render(true, expired);
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...base, ...expired, state: "PAYMENT_PENDING", compensationStatus: "NOT_REQUIRED", ...attempt });
  await click("Check original purchase status");
  expect([...host.querySelectorAll("button")].find((b) => b.textContent === "Retry original purchase")?.disabled).toBe(true);
  expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Continue secure payment authentication")).toBe(false);
  expect(host.textContent).toContain("Do not authenticate this payment");
  expect(apiRequest).toHaveBeenCalledTimes(1);
});
it("P4K-5: after the deadline, UNRESOLVED (batch control without payment) may still resume", async () => {
  await render(true, expired);
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...base, ...expired, state: "UNRESOLVED", certification: "UNRESOLVED" });
  await click("Check original purchase status");
  expect([...host.querySelectorAll("button")].find((b) => b.textContent === "Retry original purchase")?.disabled).toBe(false);
});
