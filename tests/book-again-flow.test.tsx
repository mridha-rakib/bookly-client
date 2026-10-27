/** F2B: real landing/history components and React Query hooks; only transport/routing/chrome mocked. */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookAgainCandidate } from "@/lib/api/bookings";
import type { AuthUser } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/store";
import CategoryServicesSection from "@/components/landing-page/CategoryServicesSection";
import BookAgainSection from "@/components/landing-page/BookAgainSection";
import BookAgainPage from "@/app/customer/book-again/page";

type Request = { method?: string; url: string; params?: Record<string, unknown>; data?: unknown };
const fx = vi.hoisted(() => ({ requests: [] as Request[], push: vi.fn(),
  respond: undefined as undefined | ((request: Request) => unknown) }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: async (request: Request) => { fx.requests.push(request); return fx.respond!(request); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: fx.push, replace: vi.fn() }) }));
vi.mock("next/image", () => ({ default: ({ alt }: { alt?: string }) => <span>{alt}</span> }));
vi.mock("@/components/Navbar", () => ({ default: () => <nav /> }));
vi.mock("@/components/Footer", () => ({ default: () => <footer /> }));
vi.mock("@/components/landing-page/Carousel", () => ({ default: ({ children }: React.PropsWithChildren) => <div data-carousel>{children}</div> }));

const BUSINESS = "aaaaaaaaaaaaaaaaaaaaaaaa", SERVICE = "bbbbbbbbbbbbbbbbbbbbbbbb";
const candidate: BookAgainCandidate = {
  originalBookingId: "cccccccccccccccccccccccc", originalReference: "BK-ORIGINAL",
  businessId: BUSINESS, businessName: "Actual history venue", primaryServiceName: "Previously booked service", serviceId: SERVICE,
  originalStartAt: "2026-10-01T10:00:00Z", originalTotalCents: 4900, currency: "EUR", staffMembershipId: "dddddddddddddddddddddddd",
};
function defaultRespond(request: Request): unknown {
  if (request.url === "/me/bookings/book-again") return { candidates: [candidate], pagination: { page: 1, limit: 6, total: 1 } };
  if (request.url === "/me/favorites/ids") return { businessIds: [] };
  if (request.url === "/discovery/categories") return { categories: [] };
  if (request.url === "/discovery/home-sections") return { recommended: [], nearYou: [], popular: [], meta: { personalized: false, nearYouCity: null } };
  return {};
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root, client: QueryClient;
function authenticate(id: string | null, role: AuthUser["role"] = "CUSTOMER",
  status: "authenticated" | "unauthenticated" | "unknown" | "unverified" = id ? "authenticated" : "unauthenticated") {
  useAuthStore.setState({ user: id ? { id, role, email: `${id}@example.com`, status: "ACTIVE" } : null,
    status, isInitializing: false,
    cacheEpoch: useAuthStore.getState().cacheEpoch + 1 });
}
const historyRequests = () => fx.requests.filter((request) => request.url === "/me/bookings/book-again");
const posts = () => fx.requests.filter((request) => request.method === "POST");
const button = (text: string) => {
  const found = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
};
async function waitFor(check: () => void) {
  const start = Date.now();
  for (;;) { try { check(); return; } catch (error) { if (Date.now() - start > 3000) throw error; }
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); }); }
}
async function render(node: React.ReactNode = <CategoryServicesSection />) {
  await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
}
beforeEach(() => {
  fx.requests.length = 0; fx.push.mockClear(); fx.respond = defaultRespond;
  authenticate("customer-a");
  client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); localStorage.removeItem("isLoggedIn"); });

describe("F2B authentic landing Book Again", () => {
  it("uses actual Customer history and real business/service navigation without replay or charge", async () => {
    await render();
    await waitFor(() => expect(host.textContent).toContain(candidate.primaryServiceName));
    expect(host.textContent).toContain(candidate.businessName);
    expect(host.textContent).toContain("Last paid 49.00 EUR");
    expect(host.textContent).not.toContain("4.9"); // no invented review aggregate or badge
    expect(historyRequests()).toHaveLength(1);
    expect(historyRequests()[0]!.params).toMatchObject({ page: "1", limit: "6" });
    const section = [...host.querySelectorAll("section")].find((node) => node.textContent?.includes("Book Again"))!;
    expect(section.querySelector('a[href="/customer/book-again"]')).not.toBeNull();
    await act(async () => button("Rebook").click());
    expect(fx.push).toHaveBeenCalledTimes(1);
    expect(fx.push).toHaveBeenCalledWith(`/venue?id=${BUSINESS}&serviceId=${SERVICE}`);
    expect(posts()).toHaveLength(0);
    expect(fx.requests.some((request) => /preview|finalize|purchase|redeem|consent|payment/.test(request.url))).toBe(false);
  });
  it.each(["unauthenticated", "unknown", "unverified"] as const)("does not request or show Customer history while %s, despite legacy localStorage flag", async (status) => {
    authenticate(null, "CUSTOMER", status); localStorage.setItem("isLoggedIn", "true");
    await render();
    expect(host.textContent).not.toContain("Book Again");
    expect(historyRequests()).toHaveLength(0);
  });
  it("does not request history for an authenticated management role", async () => {
    authenticate("owner", "BUSINESS_OWNER"); await render();
    expect(historyRequests()).toHaveLength(0);
    expect(host.textContent).not.toContain("Book Again");
  });
  it("handles an empty result without sample/fallback cards", async () => {
    fx.respond = (request) => request.url === "/me/bookings/book-again" ? { candidates: [], pagination: { page: 1, limit: 6, total: 0 } } : defaultRespond(request);
    await render();
    await waitFor(() => expect(host.textContent).toContain("completed bookings to repeat yet"));
    expect([...host.querySelectorAll("button")].some((node) => node.textContent?.includes("Rebook"))).toBe(false);
  });
  it("keeps loading and failures honest without old or invented records", async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise((_, fail) => { reject = fail; });
    fx.respond = (request) => request.url === "/me/bookings/book-again" ? pending : defaultRespond(request);
    await render();
    expect(host.textContent).toContain("Loading your booking history");
    expect(host.textContent).not.toContain(candidate.businessName);
    await act(async () => reject(new Error("unavailable")));
    await waitFor(() => expect(host.textContent).toContain("booking history could not be loaded"));
    expect(host.textContent).not.toContain(candidate.businessName);
  });
  it("isolates account changes even when a late request for the retired account completes", async () => {
    let resolveOld!: (value: unknown) => void;
    const pending = new Promise((resolve) => { resolveOld = resolve; });
    fx.respond = (request) => request.url === "/me/bookings/book-again" ? pending : defaultRespond(request);
    await render(); await waitFor(() => expect(historyRequests()).toHaveLength(1));
    fx.respond = (request) => request.url === "/me/bookings/book-again" ? {
      candidates: [{ ...candidate, businessName: "Second account venue", originalBookingId: "eeeeeeeeeeeeeeeeeeeeeeee" }], pagination: { page: 1, limit: 6, total: 1 },
    } : defaultRespond(request);
    await act(async () => authenticate("customer-b"));
    await waitFor(() => expect(host.textContent).toContain("Second account venue"));
    await act(async () => resolveOld({ candidates: [candidate], pagination: { page: 1, limit: 6, total: 1 } }));
    expect(host.textContent).not.toContain(candidate.businessName);
    await act(async () => authenticate(null));
    expect(host.textContent).not.toContain("Second account venue");
    expect(host.textContent).not.toContain("Book Again");
  });
  it("deduplicates equal hook consumers and does not fetch again on an unchanged render", async () => {
    await render(<><BookAgainSection /><BookAgainSection /></>);
    await waitFor(() => expect(host.textContent).toContain(candidate.businessName));
    await render(<><BookAgainSection /><BookAgainSection /></>);
    expect(historyRequests()).toHaveLength(1);
    expect(fx.requests.filter((request) => request.url === "/me/favorites/ids")).toHaveLength(1);
  });
  it("does not display cached first-account history while another account is loading", async () => {
    await render();
    await waitFor(() => expect(host.textContent).toContain(candidate.businessName));
    fx.respond = (request) => request.url === "/me/bookings/book-again" ? new Promise(() => undefined) : defaultRespond(request);
    await act(async () => authenticate("customer-b"));
    expect(host.textContent).not.toContain(candidate.businessName);
    expect(host.textContent).toContain("Loading your booking history");
    await waitFor(() => expect(historyRequests()).toHaveLength(2));
  });
  it("carousel history cards use the same service-specific navigation as small rows", async () => {
    fx.respond = (request) => request.url === "/me/bookings/book-again" ? {
      candidates: Array.from({ length: 6 }, (_, index) => ({ ...candidate, originalBookingId: `booking-${index}` })), pagination: { page: 1, limit: 6, total: 6 },
    } : defaultRespond(request);
    await render(<BookAgainSection />);
    await waitFor(() => expect(host.querySelectorAll("[data-carousel] button").length).toBeGreaterThan(0));
    const rebook = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Rebook")!;
    await act(async () => rebook.click());
    expect(fx.push).toHaveBeenCalledWith(`/venue?id=${BUSINESS}&serviceId=${SERVICE}`);
    expect(posts()).toHaveLength(0);
  });
  it("does not reuse a retired session's cached history for the same Customer", async () => {
    await render();
    await waitFor(() => expect(host.textContent).toContain(candidate.businessName));
    fx.respond = (request) => request.url === "/me/bookings/book-again" ? new Promise(() => undefined) : defaultRespond(request);
    await act(async () => authenticate("customer-a")); // new session epoch, same account
    expect(host.textContent).not.toContain(candidate.businessName);
    expect(host.textContent).toContain("Loading your booking history");
    await waitFor(() => expect(historyRequests()).toHaveLength(2));
  });
  it("dedicated history page preserves its card and primary-service-only fresh navigation", async () => {
    await render(<BookAgainPage />);
    await waitFor(() => expect(host.textContent).toContain(candidate.primaryServiceName));
    expect(historyRequests()[0]!.params).toMatchObject({ page: "1", limit: "12" });
    await act(async () => button("Rebook").click());
    expect(fx.push).toHaveBeenCalledWith(`/venue?id=${BUSINESS}&serviceId=${SERVICE}`);
    expect(fx.push.mock.calls[0]![0]).not.toContain(candidate.originalBookingId);
    expect(fx.push.mock.calls[0]![0]).not.toContain(candidate.staffMembershipId);
    expect(posts()).toHaveLength(0);
  });
});
