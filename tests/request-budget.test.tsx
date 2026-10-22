import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { AuthResponse } from "@/lib/api/auth";

// Counts real API-client dispatches (one adapter call = one HTTP request that would reach the
// API and its global limiter) for the flows implicated in the live global-api 429.

const { replace, push, searchParams } = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  searchParams: { value: "" },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/business-dashboard",
  useSearchParams: () => new URLSearchParams(searchParams.value),
}));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", { alt: String(props.alt ?? "") }),
}));

class TestBroadcastChannel {
  static instance: TestBroadcastChannel;
  postMessage = vi.fn();
  listeners: ((event: MessageEvent) => void)[] = [];
  constructor() { TestBroadcastChannel.instance = this; }
  addEventListener(_type: string, listener: (event: MessageEvent) => void) { this.listeners.push(listener); }
  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners = this.listeners.filter((value) => value !== listener);
  }
  receive(type: string) {
    this.listeners.forEach((listener) => listener(new MessageEvent("message", { data: { type, sourceTabId: "another-tab" } })));
  }
}

const owner: AuthResponse = {
  accessToken: "fixture.eyJzaWQiOiAiMTExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTExIn0.signature",
  accessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
  user: { id: "owner-1", email: "owner@example.com", role: "BUSINESS_OWNER", status: "ACTIVE" },
};
const card = {
  id: "biz-1", name: "Biz", status: "APPROVED", visitType: "AT_BUSINESS_LOCATION", category: "Barber",
  subcategories: [], address: { city: "Larnaca" }, createdAt: "2026-01-01T00:00:00.000Z",
};
const analytics = {
  period: "MONTH", currency: "EUR", range: { from: "2026-10-01", to: "2026-10-31" },
  totalBookingsCount: 0, totalBookingsChangePercent: null, newCustomersCount: 0, returningCustomersCount: 0,
  completionRate: 0, noShowRate: 0, noShowCount: 0, noShowChargedCount: 0, avgBookingValueCents: 0,
  avgBookingValueChangeCents: null, revenueRecoveredCents: 0, topServices: [], bookingsByStatus: [], busiestDays: [],
};

// Which account the fake API currently represents (switchable to test identity boundaries).
const fx = { userId: "owner-1", businessId: "biz-1", businessName: "Biz", status: "APPROVED" };
const currentOwner = (): AuthResponse => ({ ...owner, user: { ...owner.user, id: fx.userId } });

type Plan = { refresh: "401" | "owner"; delays?: Record<string, number> };
const dataFor = (url: string): unknown => {
  if (url === "/auth/refresh") return currentOwner();
  if (url === "/auth/me") return { user: { ...currentOwner().user, hasPassword: true }, profile: { fullName: "Owner" }, business: { id: fx.businessId, name: fx.businessName }, linkedAccounts: [] };
  if (url === "/businesses/my-profile") return { primary: { ...card, id: fx.businessId, name: fx.businessName, status: fx.status }, secondary: [] };
  if (url.endsWith("/dashboard/analytics")) return analytics;
  if (url.endsWith("/staff")) return { members: [] };
  if (url === "/discovery/categories") return { categories: ["Barber"] };
  if (url === "/discovery/founding-partners") return { businesses: [] };
  if (url === "/discovery/home-sections") return { recommended: [], nearYou: [], popular: [] };
  if (url === "/content/faqs") return { faqs: [] };
  return {};
};

let api: typeof import("@/lib/api/client");
let store: typeof import("@/lib/auth/store").useAuthStore;
let adapter: Mock<AxiosAdapter>;
let root: Root | undefined;
let container: HTMLDivElement;

const install = (plan: Plan) => {
  adapter = vi.fn((config: InternalAxiosRequestConfig) => {
    const url = config.url ?? "";
    const delay = plan.delays?.[url] ?? 5;
    return new Promise((resolve, reject) => setTimeout(() => {
      if (url === "/auth/refresh" && plan.refresh === "401") {
        reject(new AxiosError("Unauthorized", undefined, config, undefined, {
          status: 401, statusText: "Unauthorized", config, headers: {},
          data: { success: false, message: "Session expired", errors: [{ code: "SESSION_EXPIRED", message: "x" }] },
        }));
        return;
      }
      resolve({ status: 200, statusText: "OK", config, headers: {}, data: { success: true, message: "OK", data: dataFor(url) } });
    }, delay));
  });
  api.apiClient.defaults.adapter = adapter;
};

/** "METHOD /path" for every dispatch, in order. */
const dispatches = () => adapter.mock.calls.map(([config]) => `${(config.method ?? "get").toUpperCase()} ${config.url}`);
const countBy = (list: string[]) => list.reduce<Record<string, number>>((acc, key) => ({ ...acc, [key]: (acc[key] ?? 0) + 1 }), {});

const settle = async (ms = 400) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 25) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
  }
};

const render = async (node: ReactNode) => {
  root = createRoot(container);
  await act(async () => root?.render(node));
};

beforeEach(async () => {
  Object.assign(fx, { userId: "owner-1", businessId: "biz-1", businessName: "Biz", status: "APPROVED" });
  window.localStorage.clear();
  vi.resetModules();
  replace.mockClear();
  push.mockClear();
  vi.stubGlobal("BroadcastChannel", TestBroadcastChannel);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api = await import("@/lib/api/client");
  store = (await import("@/lib/auth/store")).useAuthStore;
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  container.remove();
  vi.unstubAllGlobals();
});

const homeProbe = async () => {
  const { default: Providers } = await import("@/app/providers");
  const discovery = await import("@/lib/discovery/hooks");
  const content = await import("@/lib/content/hooks");
  // Exactly the Home hook calls: CategoryServicesSection (categories + home-sections gated on
  // auth readiness), FoundingPartnersSection, FaqSection audience="CUSTOMER".
  function HomeProbe() {
    const status = store((state) => state.status);
    const userId = store((state) => state.user?.id);
    discovery.useDiscoveryCategoriesQuery();
    discovery.useFoundingPartnersQuery();
    content.usePublicFaqsQuery("CUSTOMER");
    const sections = discovery.useHomeSectionsQuery({}, { enabled: status !== "unknown", authScope: userId ?? "anon" });
    const faqs = content.usePublicFaqsQuery("CUSTOMER");
    return createElement("div", { "data-faq": faqs.status, "data-sections": sections.status });
  }
  return { Providers, HomeProbe };
};

describe("request budget — anonymous Home", () => {
  // Before this change every row measured 8 (categories, founding-partners and FAQs twice each).
  it.each([
    ["refresh 401 after categories/partners finish, FAQ still in flight (R1 timing)", { "/auth/refresh": 20, "/content/faqs": 40 }, 6],
    ["refresh 401 after every public read finished", { "/auth/refresh": 60 }, 5],
    // Reads still in flight at the identity boundary are cancelled by the rotation and re-sent;
    // nothing completed exists to carry over yet, so this ordering is unchanged.
    ["refresh 401 before any public read finished", { "/auth/refresh": 2, "/discovery/categories": 30, "/discovery/founding-partners": 30, "/content/faqs": 30 }, 8],
  ])("%s", async (_label, delays, expectedTotal) => {
    const { Providers, HomeProbe } = await homeProbe();
    install({ refresh: "401", delays });
    searchParams.value = "";
    await render(createElement(Providers, null, createElement(HomeProbe)));
    await settle();
    const counts = countBy(dispatches());
    console.log("[budget] anonymous Home:", _label, JSON.stringify(counts), "total", dispatches().length);
    expect(store.getState().status).toBe("unauthenticated");
    expect(container.querySelector("[data-faq]")?.getAttribute("data-faq")).toBe("success");
    expect(container.querySelector("[data-sections]")?.getAttribute("data-sections")).toBe("success");
    expect(counts["POST /auth/refresh"]).toBe(1);
    expect(dispatches()).toHaveLength(expectedTotal);
  });
});

describe("request budget — business dashboard (analytics)", () => {
  const renderDashboard = async () => {
    const { default: Providers } = await import("@/app/providers");
    const { default: BusinessDashboard } = await import("@/app/business-dashboard/page");
    install({ refresh: "owner" });
    searchParams.value = "section=analytics";
    await render(createElement(Providers, null, createElement(BusinessDashboard)));
    await settle(600);
  };

  it("initial load: each endpoint once", async () => {
    await renderDashboard();
    const counts = countBy(dispatches());
    console.log("[budget] dashboard analytics initial:", JSON.stringify(counts), "total", dispatches().length);
    expect(store.getState().status).toBe("authenticated");
    expect(container.textContent).not.toContain("Too many requests");
    // Before: 6, with GET /businesses/my-profile twice (gate fetch, then the dashboard's own
    // observers refetched it on mount at staleTime 0).
    expect(counts).toEqual({
      "POST /auth/refresh": 1,
      "GET /businesses/my-profile": 1,
      "GET /auth/me": 1,
      "GET /businesses/biz-1/staff": 1,
      "GET /businesses/biz-1/dashboard/analytics": 1,
    });
  });

  it("one AUTH_SESSION_CHANGED from another tab (e.g. that tab reloads): requests in THIS tab", async () => {
    await renderDashboard();
    const before = dispatches().length;
    await act(async () => TestBroadcastChannel.instance.receive("AUTH_SESSION_CHANGED"));
    await settle(600);
    const added = countBy(dispatches().slice(before));
    console.log("[budget] dashboard cross-tab broadcast:", JSON.stringify(added), "total", dispatches().length - before);
    expect(store.getState().status).toBe("authenticated");
    expect(dispatches().length - before).toBe(5); // before: 6
    expect(added["GET /businesses/my-profile"]).toBe(1);
  });
});

describe("cache-boundary and identity invariants for the changed behavior", () => {
  const seed = (client: import("@tanstack/react-query").QueryClient) => {
    client.setQueryData(["private", "owner-1"], "secret");
    client.setQueryData(["businesses", "profile"], { primary: { ...card, id: "biz-1" }, secondary: [] });
    client.setQueryData(["discovery", "homeSections", {}, "owner-1"], { recommended: ["personalized"] });
    client.setQueryData(["discovery", "search", { q: "x" }], { businesses: [] });
    client.setQueryData(["discovery", "categories"], { categories: ["Barber"] });
    client.setQueryData(["discovery", "foundingPartners"], { businesses: [] });
  };

  it("identity switch retires private, profile and personalized data; carries only identity-independent discovery reads", async () => {
    const queries = await import("@/lib/query-client");
    install({ refresh: "owner" });
    store.getState().setAuth(owner);
    const before = queries.queryClient;
    seed(before);
    const epoch = store.getState().cacheEpoch;
    store.getState().setAuth({ ...owner, user: { ...owner.user, id: "owner-2" } });
    const after = queries.queryClient;
    expect(after).not.toBe(before);
    expect(store.getState().cacheEpoch).toBe(epoch + 1);
    expect(after.getQueryData(["private", "owner-1"])).toBeUndefined();
    expect(after.getQueryData(["businesses", "profile"])).toBeUndefined();
    expect(after.getQueryData(["discovery", "homeSections", {}, "owner-1"])).toBeUndefined();
    expect(after.getQueryData(["discovery", "search", { q: "x" }])).toBeUndefined();
    expect(after.getQueryData(["discovery", "categories"])).toEqual({ categories: ["Barber"] });
    expect(after.getQueryData(["discovery", "foundingPartners"])).toEqual({ businesses: [] });
  });

  it("logout and session expiry still retire private and profile data", async () => {
    const queries = await import("@/lib/query-client");
    install({ refresh: "owner" });
    store.getState().setAuth(owner);
    seed(queries.queryClient);
    store.getState().clearAuth();
    expect(store.getState().status).toBe("unauthenticated");
    expect(queries.queryClient.getQueryData(["private", "owner-1"])).toBeUndefined();
    expect(queries.queryClient.getQueryData(["businesses", "profile"])).toBeUndefined();
    expect(queries.queryClient.getQueryData(["discovery", "homeSections", {}, "owner-1"])).toBeUndefined();
  });

  it("invalidated or failed discovery reads are never carried across a boundary", async () => {
    const queries = await import("@/lib/query-client");
    store.getState().setAuth(owner);
    queries.queryClient.setQueryData(["discovery", "categories"], { categories: ["Old"] });
    await queries.queryClient.invalidateQueries({ queryKey: ["discovery", "categories"], refetchType: "none" });
    store.getState().setAuth({ ...owner, user: { ...owner.user, id: "owner-2" } });
    expect(queries.queryClient.getQueryData(["discovery", "categories"])).toBeUndefined();
  });

  it("switching to another owner on the dashboard loads only that owner's business data", async () => {
    const { default: Providers } = await import("@/app/providers");
    const { default: BusinessDashboard } = await import("@/app/business-dashboard/page");
    const queries = await import("@/lib/query-client");
    install({ refresh: "owner" });
    searchParams.value = "section=analytics";
    await render(createElement(Providers, null, createElement(BusinessDashboard)));
    await settle(600);
    expect(dispatches()).toContain("GET /businesses/biz-1/dashboard/analytics");
    const before = dispatches().length;
    Object.assign(fx, { userId: "owner-2", businessId: "biz-2", businessName: "Second Biz" });
    await act(async () => store.getState().setAuth(currentOwner()));
    await settle(600);
    const added = dispatches().slice(before);
    expect(added).toContain("GET /businesses/my-profile");
    expect(added).toContain("GET /businesses/biz-2/dashboard/analytics");
    expect(added.some((entry) => entry.includes("biz-1"))).toBe(false);
    expect((queries.queryClient.getQueryData(["businesses", "profile"]) as { primary: { id: string } }).primary.id).toBe("biz-2");
  });

  describe("business profile freshness", () => {
    const probe = async () => {
      const { default: Providers } = await import("@/app/providers");
      const business = await import("@/lib/business/hooks");
      const queries = await import("@/lib/query-client");
      function Profile() {
        const query = business.useMyBusinessProfileQuery();
        return createElement("span", { "data-status": query.data?.primary?.status ?? "none" });
      }
      const show = async (visible: boolean) => {
        await act(async () => root?.render(createElement(Providers, null, visible ? createElement(Profile) : null)));
        await settle(100);
      };
      install({ refresh: "401" });
      root = createRoot(container);
      // Let the boot restore settle first: its identity-boundary rotation (correctly) retires the
      // private profile query, which would otherwise be counted as a remount refetch.
      await show(false);
      return { show, queries, business, profileCalls: () => dispatches().filter((d) => d === "GET /businesses/my-profile").length };
    };

    it("APPROVED: a remount within 30 s reuses the result; invalidation after a mutation and refetch() still fetch", async () => {
      const { show, queries, business, profileCalls } = await probe();
      await show(true);
      expect(profileCalls()).toBe(1);
      await show(false);
      await show(true);
      expect(profileCalls()).toBe(1);
      await act(async () => { await queries.queryClient.invalidateQueries({ queryKey: business.businessKeys.profile() }); });
      await settle(100);
      expect(profileCalls()).toBe(2);
      await act(async () => { await queries.queryClient.refetchQueries({ queryKey: business.businessKeys.profile() }); });
      expect(profileCalls()).toBe(3);
    });

    it("PENDING keeps staleTime 0: every remount refetches, so approval still becomes visible", async () => {
      fx.status = "PENDING";
      const { show, profileCalls } = await probe();
      await show(true);
      await show(false);
      await show(true);
      expect(profileCalls()).toBe(2);
      expect(container.querySelector("[data-status]")?.getAttribute("data-status")).toBe("PENDING");
    });
  });
});
