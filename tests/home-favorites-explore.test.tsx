import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/store";
import CategoryServicesSection from "@/components/landing-page/CategoryServicesSection";
import ExplorePage from "@/app/explore/page";
import FavoritesPage from "@/app/customer/favorites/page";
import { useBusinessFavorites } from "@/lib/favorite/use-business-favorites";

type Request = { method?: string; url: string; params?: Record<string, string>; data?: unknown };
const fx = vi.hoisted(() => ({ requests: [] as Request[], push: vi.fn(), error: vi.fn(),
  respond: undefined as undefined | ((request: Request) => Promise<unknown>) }));
vi.mock("@/lib/api/client", async original => ({ ...await original<object>(), apiRequest: (request: Request) => {
  fx.requests.push(request); return fx.respond!(request);
} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: fx.push, replace: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/landing-page/Carousel", () => ({ default: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock("sonner", () => ({ toast: { error: fx.error } }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const a = "aaaaaaaaaaaaaaaaaaaaaaaa", b = "bbbbbbbbbbbbbbbbbbbbbbbb";
const card = (id: string) => ({ id, name: `Business ${id === a ? "a" : "b"}`, category: "Beauty", subcategories: [],
  city: "Larnaca", visitType: "AT_BUSINESS_LOCATION", averageRating: 4.9, reviewCount: 5,
  startingPriceCents: 2000, startingPricingMode: "FIXED", isAvailable: true });
let host: HTMLDivElement, root: Root, client: QueryClient;
let saved: Map<string, Set<string>>, failWrite: boolean, writeGate: Promise<void> | undefined;
const previousAuth = useAuthStore.getState();
function auth(id: string | null, role: AuthUser["role"] = "CUSTOMER", suspended = false) {
  useAuthStore.setState({ user: id ? { id, role, email: `${id}@example.test`, status: suspended ? "SUSPENDED" : "ACTIVE" } : null,
    status: id ? "authenticated" : "unauthenticated", isInitializing: false,
    cacheEpoch: useAuthStore.getState().cacheEpoch + 1 });
}
beforeEach(() => {
  fx.requests = []; fx.push.mockClear(); fx.error.mockClear();
  saved = new Map([["u1", new Set([a])], ["u2", new Set<string>()]]); failWrite = false; writeGate = undefined;
  auth("u1");
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  fx.respond = async request => {
    const id = useAuthStore.getState().user?.id ?? "anon";
    const ids = saved.get(id) ?? new Set<string>();
    if (request.url === "/me/favorites/ids") return { businessIds: [...ids] };
    if (request.url === "/me/favorites") return { favorites: [...ids].map(card), pagination: { page: 1, limit: 12, total: ids.size } };
    if (request.url.startsWith("/me/favorites/")) {
      await writeGate;
      if (failWrite) throw new Error("Offline");
      const business = request.url.split("/").at(-1)!;
      if (request.method === "POST") ids.add(business); else ids.delete(business);
      saved.set(id, ids); return undefined;
    }
    if (request.url === "/discovery/categories") return { categories: ["Beauty", "Fitness"] };
    if (request.url === "/discovery/home-sections") return { recommended: [card(a), card(b)], nearYou: [card(a)], popular: [card(b)] };
    if (request.url === "/discovery/businesses") return { businesses: [card(a), card(b)], pagination: { page: Number(request.params?.page ?? 1), limit: 12, total: 25 } };
    if (request.url === "/discovery/no-deposit-eligibility") return { scope: "NEW_ORDINARY_BOOKING",
      selections: JSON.parse(request.params!.selections).map((selection: { businessId: string }) => ({ ...selection, noDepositNeeded: selection.businessId === a })) };
    if (request.url === "/me/bookings/book-again") return { candidates: [{ originalBookingId: "history", businessId: a,
      businessName: "Business a", primaryServiceName: "Haircut", serviceId: "ordinary-service", originalStartAt: "2026-11-01T10:00:00Z", originalTotalCents: 2000, currency: "EUR" }], pagination: { page: 1, total: 1, limit: 6 } };
    throw new Error(`Unexpected request ${request.url}`);
  };
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); useAuthStore.setState(previousAuth); });
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); }); }
async function waitFor(check: () => void) { for (let i = 0; i < 100; i++) { try { check(); return; } catch (error) { if (i === 99) throw error; } await settle(); } }
async function render(node: React.ReactNode = <CategoryServicesSection />) { await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)); await settle(); }
async function click(node: Element) { await act(async () => node.dispatchEvent(new MouseEvent("click", { bubbles: true }))); }
const hearts = (business = "a") => [...host.querySelectorAll<HTMLButtonElement>(`button[aria-label*="Business ${business}"][aria-pressed]`)];
const writes = () => fx.requests.filter(request => request.method === "POST" || request.method === "DELETE");
const searches = () => fx.requests.filter(request => request.url === "/discovery/businesses");
async function changeValue(node: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); });
}

describe("persistent Business favorites", () => {
  it("hydrates all Home rows, persists add/remove, and shares confirmed state with Explore and Favorites", async () => {
    await render(); await waitFor(() => expect(hearts()).toHaveLength(3));
    expect(hearts().every(heart => heart.getAttribute("aria-pressed") === "true")).toBe(true);
    expect(host.querySelectorAll("[data-no-deposit-badge]").length).toBeGreaterThan(0);
    await click(hearts("b")[0]);
    await waitFor(() => expect(hearts("b").every(heart => heart.getAttribute("aria-pressed") === "true")).toBe(true));
    expect(saved.get("u1")?.has(b)).toBe(true); expect(fx.push).not.toHaveBeenCalled();
    await render(<ExplorePage />); await waitFor(() => expect(hearts("b")[0]?.getAttribute("aria-pressed")).toBe("true"));
    await render(<FavoritesPage />); await waitFor(() => expect(hearts("b")[0]).toBeDefined());
    await click(hearts("b")[0]); await waitFor(() => expect(hearts("b")).toHaveLength(0));
    await render(); await waitFor(() => expect(hearts("b")[0]?.getAttribute("aria-pressed")).toBe("false"));
    client.clear(); await render(<React.Fragment key="reload"><CategoryServicesSection /></React.Fragment>);
    await waitFor(() => expect(hearts()[0]?.getAttribute("aria-pressed")).toBe("true"));
    expect(writes().map(request => [request.method, request.url])).toEqual([["POST", `/me/favorites/${b}`], ["DELETE", `/me/favorites/${b}`]]);
    expect(writes().every(request => request.data === undefined)).toBe(true);
  });
  it("serializes rapid clicks on the same Business across separate Home card variants", async () => {
    let release!: () => void; writeGate = new Promise(resolve => { release = resolve; });
    await render(); await waitFor(() => expect(hearts()[0]?.getAttribute("aria-pressed")).toBe("true"));
    await act(async () => { hearts()[0].click(); hearts()[1].click(); hearts()[2].click(); });
    expect(writes()).toHaveLength(1);
    await act(async () => release());
    await waitFor(() => expect(hearts().every(heart => heart.getAttribute("aria-pressed") === "false")).toBe(true));
  });
  it("failed mutations retain the persisted heart and report failure", async () => {
    await render(); await waitFor(() => expect(hearts()[0]?.getAttribute("aria-pressed")).toBe("true"));
    failWrite = true; await click(hearts()[0]);
    await waitFor(() => expect(fx.error).toHaveBeenCalledTimes(1));
    expect(hearts()[0].getAttribute("aria-pressed")).toBe("true"); expect(saved.get("u1")?.has(a)).toBe(true);
  });
  it.each([null, "BUSINESS_OWNER", "SUPERVISOR", "STAFF", "SUPER_ADMIN"] as const)("restricts %s without mutating or replacing that session", async role => {
    auth(role ? "professional" : null, role ?? "CUSTOMER"); await render(); await click(hearts()[0]);
    expect(writes()).toHaveLength(0); expect(fx.requests.some(request => request.url === "/me/favorites/ids")).toBe(false);
    expect(hearts().every(heart => heart.getAttribute("aria-pressed") === "false")).toBe(true);
    if (role) { expect(useAuthStore.getState().user?.role).toBe(role); expect(fx.error).toHaveBeenCalled(); }
    else expect(fx.push).toHaveBeenCalledWith("/customer");
  });
  it("masks favorites on account change/logout and ignores late writes from the previous Customer", async () => {
    let release!: () => void; writeGate = new Promise(resolve => { release = resolve; });
    await render(); await waitFor(() => expect(hearts()[0]?.getAttribute("aria-pressed")).toBe("true"));
    await click(hearts("b")[0]);
    await act(async () => auth("u2"));
    const newScope = `u2:${useAuthStore.getState().cacheEpoch}`;
    const newAccountSnapshots: string[][] = [];
    const unsubscribe = client.getQueryCache().subscribe(() => {
      const data = client.getQueryData<{ businessIds: string[] }>(["favorite", "ids", newScope]);
      if (data) newAccountSnapshots.push([...data.businessIds]);
    });
    await waitFor(() => expect([...hearts(), ...hearts("b")].every(heart => heart.getAttribute("aria-pressed") === "false")).toBe(true));
    await act(async () => release()); await settle(); expect(saved.get("u2")?.size).toBe(0);
    unsubscribe(); expect(newAccountSnapshots.every(ids => !ids.includes(b))).toBe(true);
    expect(hearts("b")[0]?.getAttribute("aria-pressed")).toBe("false");
    await act(async () => auth(null)); expect(hearts().every(heart => heart.getAttribute("aria-pressed") === "false")).toBe(true);
    await act(async () => auth("suspended", "CUSTOMER", true)); await click(hearts()[0]);
    expect(writes()).toHaveLength(1);
  });
  it("retains Venue's existing anonymous return-destination behavior through the shared controller", async () => {
    auth(null); const returnToVenue = vi.fn();
    function VenueAction() { const favorites = useBusinessFavorites({ onAnonymous: returnToVenue }); return <button onClick={() => favorites.toggle(a)}>Venue heart</button>; }
    await render(<VenueAction />); await click(host.querySelector("button")!);
    expect(returnToVenue).toHaveBeenCalledTimes(1); expect(writes()).toHaveLength(0);
  });
});

describe("truthful Explore filters", () => {
  it("disables unsupported controls on desktop/mobile while supported filters change transport parameters and reset paging", async () => {
    await render(<ExplorePage />); await waitFor(() => expect(searches()).toHaveLength(1));
    const unsupported = [...host.querySelectorAll<HTMLInputElement>('input[aria-label$="(unavailable)"]')];
    expect(unsupported).toHaveLength(18); expect(unsupported.every(input => input.disabled)).toBe(true);
    expect(host.textContent).toContain("Distance filtering is unavailable");
    expect(host.textContent).toContain("appointment time on a Business page");
    await click(host.querySelector('[aria-label="Next page"]')!); await waitFor(() => expect(searches().at(-1)?.params?.page).toBe("2"));
    const checkbox = (label: string) => [...host.querySelectorAll("label")].find(node => node.textContent?.trim() === label)!.querySelector("input")!;
    await click(checkbox("Beauty")); await waitFor(() => expect(searches().at(-1)?.params).toMatchObject({ category: "Beauty", page: "1" }));
    await click(checkbox("Larnaca")); await click(checkbox("4.8 & up")); await click(host.querySelector('[role="switch"]')!);
    await changeValue(host.querySelector<HTMLSelectElement>('[aria-label="Sort businesses"]')!, "Price (Low to High)");
    await changeValue(host.querySelector<HTMLInputElement>('[aria-label="Search businesses"]')!, "  Hair  ");
    await click(host.querySelector('[aria-label="Submit search"]')!);
    await waitFor(() => expect(searches().at(-1)?.params).toMatchObject({ q: "Hair", city: "Larnaca", category: "Beauty", minRating: "4.8", visitType: "TRAVEL_TO_CUSTOMER", sort: "priceLowToHigh", page: "1" }));
    await click([...host.querySelectorAll("button")].find(node => node.textContent?.trim() === "Clear all")!);
    await waitFor(() => expect(searches().at(-1)?.params?.q).toBeUndefined());
    expect(searches().at(-1)?.params?.category).toBeUndefined();
    expect(searches().at(-1)?.params?.sort).toBe("mostRelevant");
    expect(searches().at(-1)?.params?.page).toBe("1");
    await click([...host.querySelectorAll("button")].filter(node => node.textContent?.trim() === "Filter")[1]);
    await changeValue(host.querySelectorAll<HTMLInputElement>('[aria-label="Search businesses"]')[1], "Mobile search");
    await click([...host.querySelectorAll("button")].find(node => node.textContent?.trim() === "Apply Filters")!);
    expect(searches().at(-1)?.params?.q).toBe("Mobile search");
  });
  it("does not display a late response from an earlier filter as the current results", async () => {
    const original = fx.respond!;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    fx.respond = async request => {
      if (request.url === "/discovery/businesses" && request.params?.city && !request.params.category) {
        await gate;
        return { businesses: [{ ...card(a), name: "Stale filter business" }], pagination: { page: 1, limit: 12, total: 999 } };
      }
      return original(request);
    };
    await render(<ExplorePage />);
    const checkbox = (label: string) => [...host.querySelectorAll("label")].find(node => node.textContent?.trim() === label)!.querySelector("input")!;
    await click(checkbox("Larnaca"));
    expect(hearts()).toHaveLength(0); expect(host.textContent).toContain("Loading businesses");
    await click(checkbox("Beauty")); await waitFor(() => expect(hearts()).toHaveLength(1));
    await act(async () => release()); await settle();
    expect(host.textContent).not.toContain("Stale filter business"); expect(host.textContent).not.toContain("999 businesses");
    expect(searches().at(-1)?.params).toMatchObject({ city: "Larnaca", category: "Beauty", page: "1" });
  });
});
