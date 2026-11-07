import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PackagePurchaseContinuation } from "@/components/packages/PackagePurchaseContinuation";
import { packagePurchaseApi } from "@/lib/api/package-purchase";
import { apiRequest } from "@/lib/api/client";
import { getStripe } from "@/lib/payments/stripe-client";
import type { RetainedPurchaseQuote } from "@/lib/api/package-consent";
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<object>(), apiRequest: vi.fn() }));
vi.mock("@/lib/payments/stripe-client", () => ({ getStripe: vi.fn() }));
vi.mock("@/components/packages/FirstClassBookingConfirmation", () => ({ FirstClassBookingConfirmation: ({ progressId, bookingIds }: { progressId: string; bookingIds: string[] }) => <section><h1>Booking Confirmed!</h1><a href={`/customer/packages/${progressId}?kind=first-class`}>View Package</a>{bookingIds.map((id, index) => <a key={id} href={`/customer/bookings/view?id=${id}`}>View confirmed appointment {index + 1}</a>)}</section> }));
vi.mock("@/components/packages/PackageSavedCard", () => ({ PackageSavedCard: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const quote: RetainedPurchaseQuote = { quoteId: "quote", termsHash: "terms", issuedAt: "2030-08-19T08:00:00Z", expiresAt: "2030-08-19T08:30:00Z", timezone: "UTC", lifetimeMs: 1800000, certification: "CERTIFIED", purchaseAvailable: true, name: "Package",
  financials: { currency: "EUR", bundlePriceCents: 10000, addonsCents: 500, travelCents: 0, normalTotalCents: 10500, requiredUpfrontCents: 2500, manualVenueDuesCents: 8000, classification: "FIRST" } };
const base = { operationId: "original", quoteId: "quote", termsHash: "terms", disclosureHash: "disclosure", issuedAt: quote.issuedAt, expiresAt: quote.expiresAt, canStartNewQuote: false };
beforeEach(() => { navigation.push.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); sessionStorage.clear(); vi.mocked(apiRequest).mockReset(); });
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
  expect([...host.querySelectorAll("button")].find((b) => b.textContent === "Purchase this Package")?.disabled).toBe(true);
  expect(host.textContent).toContain("Purchase unavailable"); expect(apiRequest).not.toHaveBeenCalled();
  vi.mocked(apiRequest).mockResolvedValue({ ...base, state: "UNRESOLVED" });
  await click("Check original purchase status");
  expect(apiRequest).toHaveBeenCalledWith(expect.objectContaining({ url: "/package-views/actions/purchase-status", data: { businessId: "business", operationId: "original" } }));
});
it("pending provider success does not imply a Package purchase or usable credits", async () => {
  vi.mocked(apiRequest).mockResolvedValue({ ...base, state: "PAYMENT_PENDING", providerStatus: "SUCCEEDED", persistenceStatus: "NOT_STARTED" });
  await render(); await click("Purchase this Package");
  expect(host.textContent).toContain("Purchase unconfirmed"); expect(host.textContent).not.toContain("Booking Confirmed!");
  expect(navigation.push).not.toHaveBeenCalled();
  expect(host.querySelector("a")).toBeNull();
});
it.each([
  { expiresAt: "2030-08-19T09:00:00Z" },
  { issuedAt: "2030-08-19T08:01:00Z" },
  { canStartNewQuote: true },
  { bookingIds: [] },
  { purchaseCompletion: undefined },
])("a changed quote window or incomplete completion cannot display purchase success: %j", async (changed) => {
  vi.mocked(apiRequest).mockResolvedValue({ ...base, state: "COMPLETE", purchaseCompletion: "VERIFIED", packageProgressId: "progress", bookingIds: ["booking"], ...changed });
  await render(); await click("Purchase this Package");
  expect(host.textContent).not.toContain("Booking Confirmed!");
  expect(host.querySelector("a")).toBeNull();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(apiRequest).toHaveBeenCalledTimes(1);
  expect(navigation.push).not.toHaveBeenCalled();
});
it("3DS continuation replays completion and persists no client secret", async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...base, state: "PAYMENT_PENDING", providerStatus: "REQUIRES_ACTION", clientSecret: "ephemeral-secret" })
    .mockResolvedValueOnce({ ...base, state: "COMPLETE", purchaseCompletion: "VERIFIED", packageProgressId: "progress", bookingIds: ["booking"] });
  const confirm = vi.fn(async () => ({})); vi.mocked(getStripe).mockResolvedValue({ confirmCardPayment: confirm } as never);
  await render(); await click("Purchase this Package"); await click("Continue secure payment authentication");
  expect(confirm).toHaveBeenCalledWith("ephemeral-secret");
  expect(vi.mocked(apiRequest).mock.calls[0]?.[0].data).toEqual(vi.mocked(apiRequest).mock.calls[1]?.[0].data);
  expect(host.textContent).toContain("Booking Confirmed!");
  expect(host.querySelector("a")?.href).toContain("progress?kind=first-class");
  expect(host.querySelector('a[href="/customer/bookings/view?id=booking"]')?.textContent).toBe("View confirmed appointment 1");
  expect(navigation.push).not.toHaveBeenCalled();
  expect(JSON.stringify(sessionStorage)).not.toContain("ephemeral-secret");
});
it("multiple initial Bookings display every confirmed appointment and retain every real Booking link", async () => {
  vi.mocked(apiRequest).mockResolvedValue({ ...base, state: "COMPLETE", purchaseCompletion: "VERIFIED", packageProgressId: "progress", primaryBookingId: "origin", bookingIds: ["second", "origin", "third"] });
  await render(); await click("Purchase this Package");
  expect(navigation.push).not.toHaveBeenCalled();
  expect([...host.querySelectorAll('a[href^="/customer/bookings/view"]')].map((link) => link.getAttribute("href"))).toEqual(["/customer/bookings/view?id=second", "/customer/bookings/view?id=origin", "/customer/bookings/view?id=third"]);
});
it("a primary Booking outside the verified result never navigates", async () => {
  vi.mocked(apiRequest).mockResolvedValue({ ...base, state: "COMPLETE", purchaseCompletion: "VERIFIED", packageProgressId: "progress", primaryBookingId: "foreign", bookingIds: ["booking"] });
  await render(); await click("Purchase this Package");
  expect(navigation.push).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Booking Confirmed!");
});
it.each(["pending", "rejected"])("verified confirmation never waits for %s cache readback", async (outcome) => {
  const client = new QueryClient();
  vi.spyOn(client, "invalidateQueries").mockImplementation(() => outcome === "pending" ? new Promise<void>(() => {}) : Promise.reject(Error("readback offline")));
  vi.mocked(apiRequest).mockResolvedValue({ ...base, state: "COMPLETE", purchaseCompletion: "VERIFIED", packageProgressId: "progress", primaryBookingId: "booking", bookingIds: ["booking", "second"] });
  await act(async () => root.render(<QueryClientProvider client={client}><PackagePurchaseContinuation businessId="business" operationId="original" quote={quote} accepted available /></QueryClientProvider>));
  await click("Purchase this Package");
  expect(navigation.push).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Booking Confirmed!");
  expect(host.querySelector('[role="alert"]')).toBeNull();
});
it("refresh checks only original status and shows confirmation after verified recovery, without a purchase mutation", async () => {
  vi.mocked(apiRequest).mockResolvedValue({ ...base, state: "COMPLETE", purchaseCompletion: "VERIFIED", packageProgressId: "progress", primaryBookingId: "booking", bookingIds: ["booking", "second"] });
  const client = new QueryClient();
  const view = <QueryClientProvider client={client}><PackagePurchaseContinuation businessId="business" operationId="original" quote={quote} accepted available recoverOnMount /></QueryClientProvider>;
  await act(async () => root.render(view));
  expect(apiRequest).toHaveBeenCalledExactlyOnceWith({ method: "POST", url: "/package-views/actions/purchase-status", data: { businessId: "business", operationId: "original" } });
  expect(navigation.push).not.toHaveBeenCalled();
  await act(async () => root.unmount()); root = createRoot(host);
  await act(async () => root.render(view));
  expect(apiRequest).toHaveBeenCalledTimes(2);
  expect(navigation.push).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Booking Confirmed!");
  expect([...host.querySelectorAll('a[href^="/customer/bookings/view"]')]).toHaveLength(2);
});
it.each(["UNRESOLVED", "PAYMENT_PENDING", "COMPENSATION"])("automatic original-status recovery never redirects or retries a %s purchase", async (state) => {
  vi.mocked(apiRequest).mockResolvedValue({ ...base, state, providerStatus: "UNKNOWN" });
  const client = new QueryClient();
  await act(async () => root.render(<QueryClientProvider client={client}><PackagePurchaseContinuation businessId="business" operationId="original" quote={quote} accepted available recoverOnMount /></QueryClientProvider>));
  expect(apiRequest).toHaveBeenCalledTimes(1);
  expect(vi.mocked(apiRequest).mock.calls[0]?.[0].url).toBe("/package-views/actions/purchase-status");
  expect(navigation.push).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Booking Confirmed!");
});
it("an expired original quote still displays verified canonical success without renewing or purchasing", async () => {
  const oldQuote = { ...quote, issuedAt: "2000-01-01T00:00:00Z", expiresAt: "2000-01-01T00:30:00Z" };
  vi.mocked(apiRequest).mockResolvedValue({ ...base, issuedAt: oldQuote.issuedAt, expiresAt: oldQuote.expiresAt, state: "COMPLETE", purchaseCompletion: "VERIFIED", packageProgressId: "progress", primaryBookingId: "booking", bookingIds: ["booking"] });
  await act(async () => root.render(<QueryClientProvider client={new QueryClient()}><PackagePurchaseContinuation businessId="business" operationId="original" quote={oldQuote} accepted available recoverOnMount /></QueryClientProvider>));
  expect(navigation.push).not.toHaveBeenCalled();
  expect(apiRequest).toHaveBeenCalledExactlyOnceWith({ method: "POST", url: "/package-views/actions/purchase-status", data: { businessId: "business", operationId: "original" } });
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
  await render(); expect(host.textContent).not.toContain("Booking Confirmed!");
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
  expect(host.textContent).toContain("Booking Confirmed!");
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
