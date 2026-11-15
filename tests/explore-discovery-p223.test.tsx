import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/store";
import ExplorePage from "@/app/explore/page";
import { platformToday } from "@/lib/superAdminDashboard/period";

type Request = { method?: string; url: string; params?: Record<string, string> };
const fx = vi.hoisted(() => ({
  requests: [] as Request[],
  respond: undefined as undefined | ((request: Request) => Promise<unknown>),
  failNext: false,
}));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<object>()),
  apiRequest: (request: Request) => {
    fx.requests.push(request);
    return fx.respond!(request);
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root, client: QueryClient;
let geolocation: { getCurrentPosition: ReturnType<typeof vi.fn> };
const previousAuth = useAuthStore.getState();

const card = (extra: Record<string, unknown> = {}) => ({
  id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Studio A", category: "Beauty", subcategories: [], city: "Larnaca",
  visitType: "AT_BUSINESS_LOCATION", averageRating: 4.9, reviewCount: 5, startingPriceCents: 2000,
  startingPricingMode: "FIXED", isAvailable: true, ...extra,
});

function auth(id: string | null, role: AuthUser["role"] = "CUSTOMER") {
  useAuthStore.setState({
    user: id ? { id, role, email: `${id}@example.test`, status: "ACTIVE" } : null,
    status: id ? "authenticated" : "unauthenticated",
    isInitializing: false,
    cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
  });
}

beforeEach(() => {
  fx.requests = [];
  fx.failNext = false;
  auth(null);
  geolocation = { getCurrentPosition: vi.fn() };
  Object.defineProperty(navigator, "geolocation", { value: geolocation, configurable: true });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  fx.respond = async (request) => {
    if (request.url === "/discovery/categories") return { categories: ["Beauty"] };
    if (request.url === "/me/favorites/ids") return { businessIds: [] };
    if (request.url === "/discovery/businesses") {
      if (fx.failNext) {
        fx.failNext = false;
        throw new Error("Network unavailable");
      }
      const p = request.params ?? {};
      const meta: Record<string, unknown> = { sort: p.sort };
      if (p.sort === "recommended") meta.personalized = Boolean(useAuthStore.getState().user);
      if (p.sort === "trending") meta.trending = { from: "", to: "", timezone: "Europe/Nicosia", statuses: ["UPCOMING", "COMPLETED"] };
      if (p.nearLat) meta.distance = { unit: "km", measure: "STRAIGHT_LINE_TO_BUSINESS_LOCATION", radiusKm: p.radiusKm ? Number(p.radiusKm) : null };
      if (p.availDate) {
        meta.availability = { date: p.availDate, window: p.availWindow, serviceQuery: p.availService ?? null,
          candidatesChecked: 60, candidateLimitReached: true, travelBusinessesNeedCity: 2 };
      }
      const extra = {
        ...(p.nearLat ? { distanceKm: 3.24 } : {}),
        ...(p.availDate ? { availability: { serviceId: "s1", serviceName: "Haircut", firstSlotStartAt: "2026-11-20T15:30:00.000Z" } } : {}),
      };
      return { businesses: [card(extra)], pagination: { page: Number(p.page ?? 1), limit: 12, total: 30 }, meta };
    }
    throw new Error(`Unexpected request ${request.url}`);
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  useAuthStore.setState(previousAuth);
});

async function settle() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); }); }
async function waitFor(check: () => void) {
  for (let i = 0; i < 100; i++) {
    try { check(); return; } catch (error) { if (i === 99) throw error; }
    await settle();
  }
}
async function render() {
  await act(async () => root.render(<QueryClientProvider client={client}><ExplorePage /></QueryClientProvider>));
  await settle();
}
async function click(node: Element | null | undefined) {
  expect(node).toBeTruthy();
  await act(async () => node!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
async function changeValue(node: HTMLInputElement | HTMLSelectElement, value: string, event = node instanceof HTMLSelectElement ? "change" : "input") {
  await act(async () => {
    const proto = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event(event, { bubbles: true }));
  });
}
const searches = () => fx.requests.filter((r) => r.url === "/discovery/businesses").map((r) => r.params ?? {});
const last = () => searches().at(-1) ?? {};
const note = () => host.querySelector('[data-testid="explore-result-note"]')?.textContent ?? "";
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
const sidebar = () => host.querySelector("aside")!;

describe("Explore quick actions", () => {
  it("Recommended and Trending change the server ranking and are labelled truthfully", async () => {
    auth("customer-1");
    await render();
    await waitFor(() => expect(searches()).toHaveLength(1));
    await click(sidebar().querySelector('[aria-label="Recommended"]'));
    await waitFor(() => expect(last()).toMatchObject({ sort: "recommended", page: "1" }));
    await waitFor(() => expect(note()).toContain("Recommended for you, based on the categories and cities you have booked."));
    expect(host.querySelector<HTMLSelectElement>('[aria-label="Sort businesses"]')?.value).toBe("Recommended");

    await click(sidebar().querySelector('[aria-label="Trending services"]'));
    await waitFor(() => expect(last()).toMatchObject({ sort: "trending" }));
    await waitFor(() => expect(note()).toContain("last 30 days (Cyprus time)"));
    expect(sidebar().querySelector<HTMLInputElement>('[aria-label="Recommended"]')?.checked).toBe(false);

    await click(sidebar().querySelector('[aria-label="Trending services"]'));
    await waitFor(() => expect(last()).toMatchObject({ sort: "mostRelevant" }));
  });

  it("Near you never invents a location: denied stays relevant; granted sends a coarse origin, radius and nearest-first", async () => {
    geolocation.getCurrentPosition.mockImplementationOnce((_ok: unknown, fail: (e: { code: number }) => void) => fail({ code: 1 }));
    await render();
    await waitFor(() => expect(searches()).toHaveLength(1));
    await click(sidebar().querySelector('[aria-label="Services near you"]'));
    await waitFor(() => expect(sidebar().textContent).toContain("Location permission was denied"));
    expect(last().sort).toBe("mostRelevant");
    expect(last().nearLat).toBeUndefined();
    expect(note()).toContain("Share your location");

    geolocation.getCurrentPosition.mockImplementationOnce((ok: (p: unknown) => void) =>
      ok({ coords: { latitude: 34.707123456, longitude: 33.022654321 } }));
    await click(button("Use my location"));
    await waitFor(() => expect(last()).toMatchObject({ sort: "distance", nearLat: "34.707", nearLng: "33.023", page: "1" }));
    await changeValue(sidebar().querySelector<HTMLSelectElement>('[aria-label="Distance radius"]')!, "10");
    await waitFor(() => expect(last()).toMatchObject({ radiusKm: "10", sort: "distance" }));
    await waitFor(() => expect(host.textContent).toContain("3.2 km away"));
    expect(note()).toContain("Straight-line distance from your location to each business, within 10 km.");

    await click(button("Stop using"));
    await waitFor(() => expect(last().nearLat).toBeUndefined());
    expect(last().radiusKm).toBeUndefined();
    expect(last().sort).toBe("mostRelevant");
    expect(host.textContent).not.toContain("km away");
  });
});

describe("Explore availability", () => {
  it("sends date/window/service context, shows the real earliest slot and explains limits; Clear removes it", async () => {
    await render();
    await waitFor(() => expect(searches()).toHaveLength(1));
    await click(host.querySelector('[aria-label="Next page"]'));
    await waitFor(() => expect(last().page).toBe("2"));
    const today = platformToday();
    const todayStr = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
    await click([...sidebar().querySelectorAll("button")].find((b) => b.textContent?.trim() === "Today"));
    await waitFor(() => expect(last()).toMatchObject({ availDate: todayStr, availWindow: "ANY", page: "1" }));
    await changeValue(sidebar().querySelector<HTMLSelectElement>('[aria-label="Availability time window"]')!, "EVENING");
    const service = sidebar().querySelector<HTMLInputElement>('[aria-label="Availability service"]')!;
    await changeValue(service, "Haircut");
    await act(async () => service.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await waitFor(() => expect(last()).toMatchObject({ availWindow: "EVENING", availService: "Haircut" }));
    await waitFor(() => expect(host.querySelector('[data-testid="card-availability"]')?.textContent).toBe("Available: Haircut · from 17:30"));
    expect(note()).toContain("among the top 60 matches");
    expect(note()).toContain("narrow the filters");
    expect(note()).toContain("select exactly one city");

    await click(button("Clear availability"));
    await waitFor(() => expect(last().availDate).toBeUndefined());
    expect(host.querySelector('[data-testid="card-availability"]')).toBeNull();
  });

  it("a failed search offers Retry with the same filters", async () => {
    await render();
    await waitFor(() => expect(searches()).toHaveLength(1));
    fx.failNext = true;
    await click(sidebar().querySelector('[aria-label="Trending services"]'));
    await waitFor(() => expect(button("Retry")).toBeTruthy());
    await click(button("Retry"));
    await waitFor(() => expect(host.textContent).toContain("Studio A"));
    expect(searches().slice(-2).every((p) => p.sort === "trending")).toBe(true);
  });

  it("Clear all resets quick action, location, radius and availability", async () => {
    geolocation.getCurrentPosition.mockImplementation((ok: (p: unknown) => void) => ok({ coords: { latitude: 35, longitude: 33 } }));
    await render();
    await click(sidebar().querySelector('[aria-label="Services near you"]'));
    await waitFor(() => expect(last().sort).toBe("distance"));
    await click([...sidebar().querySelectorAll("button")].find((b) => b.textContent?.trim() === "Tomorrow"));
    await waitFor(() => expect(last().availDate).toBeTruthy());
    await click([...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Clear all"));
    await waitFor(() => expect(last()).toMatchObject({ sort: "mostRelevant", page: "1" }));
    expect(last().nearLat).toBeUndefined();
    expect(last().availDate).toBeUndefined();
  });

  it("results are cached per signed-in identity", async () => {
    auth("customer-1");
    await render();
    await waitFor(() => expect(searches()).toHaveLength(1));
    await act(async () => auth("customer-2"));
    await waitFor(() => expect(searches()).toHaveLength(2));
  });
});
