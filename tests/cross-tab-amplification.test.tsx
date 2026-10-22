import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResponse } from "@/lib/api/auth";

// Multi-tab model of ONE browser profile: every simulated tab is its own fresh module graph
// (store, API client, QueryClient, Providers, real dashboard page), and the tabs share only what
// real tabs share: the refresh-cookie jar (the fake server), a BroadcastChannel bus, localStorage,
// and optionally Web Locks. Every API dispatch is counted per tab.
//
// The fake server mirrors the backend's session model (api token.service.ts): every sign-in
// (password, OTP, OAuth, redirect) issues a NEW refresh family; refresh rotation keeps the family;
// access tokens carry `sid` = family and are only honoured while that family is live.

// Multi-tab scenarios run several real app instances for a few simulated seconds each.
vi.setConfig({ testTimeout: 60_000 });

const { searchParams } = vi.hoisted(() => ({ searchParams: { value: "section=analytics" } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/business-dashboard",
  useSearchParams: () => new URLSearchParams(searchParams.value),
}));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", { alt: String(props.alt ?? "") }),
}));

// ---- shared browser-profile state -------------------------------------------------------------
type Identity = { id: string; role: "BUSINESS_OWNER"; businessId: string };
const OWNER_1: Identity = { id: "owner-1", role: "BUSINESS_OWNER", businessId: "biz-1" };
const OWNER_2: Identity = { id: "owner-2", role: "BUSINESS_OWNER", businessId: "biz-2" };

/** Server-side live refresh families → identity, and the browser's one refresh cookie. */
const families = new Map<string, Identity>();
const jar: { family: string | null } = { family: null };
let familySeq = 0;
/** A sign-in through ANY path (incl. an OAuth/redirect callback): new family in the cookie. */
const signInCookie = (who: Identity): string => {
  familySeq += 1;
  const family = `${String(familySeq).padStart(8, "0")}-0000-4000-8000-000000000000`;
  families.set(family, who);
  jar.family = family;
  return family;
};
const revokeCookieFamily = () => { if (jar.family) families.delete(jar.family); };

const messages: string[] = [];
const sessionChanged = () => messages.filter((type) => type === "AUTH_SESSION_CHANGED").length;

class BusChannel {
  static members = new Set<BusChannel>();
  listeners: ((event: MessageEvent) => void)[] = [];
  constructor(public name: string) { BusChannel.members.add(this); }
  postMessage(data: { type: string }) {
    messages.push(data.type);
    for (const member of BusChannel.members) {
      if (member !== this) setTimeout(() => member.listeners.forEach((listener) => listener(new MessageEvent("message", { data }))), 0);
    }
  }
  addEventListener(_type: string, listener: (event: MessageEvent) => void) { this.listeners.push(listener); }
  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners = this.listeners.filter((value) => value !== listener);
  }
  close() { BusChannel.members.delete(this); }
}
/** A notice from a tab outside the harness (e.g. one that just reloaded). */
const externalNotice = (type: string) => {
  messages.push(`external:${type}`);
  for (const member of BusChannel.members) {
    setTimeout(() => member.listeners.forEach((l) => l(new MessageEvent("message", { data: { type, sourceTabId: "external" } }))), 0);
  }
};

/** FIFO stand-in for navigator.locks (Chrome serializes the refresh under a named lock). */
const fifoLocks = () => {
  const queues = new Map<string, Promise<unknown>>();
  return {
    request(name: string, a: unknown, b?: unknown) {
      const run = (typeof a === "function" ? a : b) as () => Promise<unknown>;
      const previous = queues.get(name) ?? Promise.resolve();
      const next = previous.catch(() => undefined).then(() => run());
      queues.set(name, next.catch(() => undefined));
      return next;
    },
  };
};

// ---- fake API (shared cookie jar) --------------------------------------------------------------
const authFor = (family: string): AuthResponse => {
  const who = families.get(family) as Identity;
  return {
    accessToken: `fixture.${btoa(JSON.stringify({ sid: family }))}.signature`,
    accessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
    user: { id: who.id, email: `${who.id}@example.com`, role: who.role, status: "ACTIVE" },
  };
};
const analytics = {
  period: "MONTH", currency: "EUR", range: { from: "2026-10-01", to: "2026-10-31" },
  totalBookingsCount: 0, totalBookingsChangePercent: null, newCustomersCount: 0, returningCustomersCount: 0,
  completionRate: 0, noShowRate: 0, noShowCount: 0, noShowChargedCount: 0, avgBookingValueCents: 0,
  avgBookingValueChangeCents: null, revenueRecoveredCents: 0, topServices: [], bookingsByStatus: [], busiestDays: [],
};
type Dispatch = { tab: number; key: string; asUser: string | null };
const dispatched: Dispatch[] = [];
const tokenFamily = (config: InternalAxiosRequestConfig): string | null => {
  const header = String(config.headers?.Authorization ?? "");
  return header.startsWith("Bearer ") ? JSON.parse(atob(header.slice(7).split(".")[1] ?? "")).sid ?? null : null;
};
const serve = (tab: number) => (config: InternalAxiosRequestConfig) => {
  const url = config.url ?? "";
  const key = `${(config.method ?? "get").toUpperCase()} ${url}`;
  const family = tokenFamily(config);
  const who = family ? families.get(family) : undefined; // only live families authorize
  dispatched.push({ tab, key, asUser: who?.id ?? null });
  const ok = (data: unknown) => ({ status: 200, statusText: "OK", config, headers: {}, data: { success: true, message: "OK", data } });
  const fail = (status: number, code: string) => new AxiosError("Request failed", undefined, config, undefined, {
    status, statusText: "Failed", config, headers: {}, data: { success: false, message: code, errors: [{ code, message: code }] },
  });
  return new Promise((resolve, reject) => setTimeout(() => {
    if (url === "/auth/refresh") {
      if (!jar.family || !families.has(jar.family)) { reject(fail(401, "SESSION_EXPIRED")); return; }
      resolve(ok(authFor(jar.family))); return;
    }
    if (url === "/auth/logout") {
      const body = JSON.parse(String(config.data ?? "{}"));
      revokeCookieFamily();
      jar.family = null;
      resolve(ok({ intentId: body.intentId, familyId: body.familyId, outcome: "revoked" })); return;
    }
    if (!who) { reject(fail(401, "ACCESS_TOKEN_INVALID")); return; }
    if (url === "/auth/me") { resolve(ok({ user: { ...authFor(family as string).user, hasPassword: true }, profile: { fullName: who.id }, business: { id: who.businessId, name: who.businessId }, linkedAccounts: [] })); return; }
    if (url === "/businesses/my-profile") {
      resolve(ok({ primary: { id: who.businessId, name: who.businessId, status: "APPROVED", visitType: "AT_BUSINESS_LOCATION", category: "Barber", subcategories: [], address: { city: "x" }, createdAt: "2026-01-01" }, secondary: [] }));
      return;
    }
    if (url.startsWith(`/businesses/${who.businessId}/`)) {
      resolve(ok(url.endsWith("/staff") ? { members: [] } : analytics)); return;
    }
    reject(fail(403, "FORBIDDEN"));
  }, url === "/auth/refresh" ? 15 : 8));
};

// ---- simulated tabs -----------------------------------------------------------------------------
type Tab = {
  index: number;
  store: typeof import("@/lib/auth/store").useAuthStore;
  queries: typeof import("@/lib/query-client");
  tokens: typeof import("@/lib/auth/token-memory");
  channels: BusChannel[];
  rotations: () => number;
  mount: () => Promise<void>;
  unmount: () => Promise<void>;
  container: HTMLDivElement;
};
const tabs: Tab[] = [];

const openTab = async (): Promise<Tab> => {
  const index = tabs.length + 1;
  vi.resetModules();
  const before = new Set(BusChannel.members);
  const api = await import("@/lib/api/client");
  const { useAuthStore } = await import("@/lib/auth/store");
  const channels = [...BusChannel.members].filter((member) => !before.has(member));
  const queries = await import("@/lib/query-client");
  const tokens = await import("@/lib/auth/token-memory");
  const { default: Providers } = await import("@/app/providers");
  const { default: BusinessDashboard } = await import("@/app/business-dashboard/page");
  api.apiClient.defaults.adapter = serve(index) as AxiosAdapter;
  let epochChanges = 0;
  useAuthStore.subscribe((state, previous) => { if (state.cacheEpoch !== previous.cacheEpoch) epochChanges += 1; });
  const container = document.createElement("div");
  document.body.append(container);
  let root: Root | null = null;
  const tab: Tab = {
    index, store: useAuthStore, queries, tokens, container, channels,
    rotations: () => epochChanges,
    mount: async () => {
      root = createRoot(container);
      await act(async () => root?.render(createElement(Providers, null, createElement(BusinessDashboard))));
    },
    unmount: async () => { if (root) await act(async () => root?.unmount()); root = null; },
  };
  tabs.push(tab);
  return tab;
};
/** A page reload: the old document (and its module graph/channel) goes away; a fresh one boots. */
const reloadTab = async (tab: Tab): Promise<Tab> => {
  await tab.unmount();
  tab.container.remove();
  tabs.splice(tabs.indexOf(tab), 1);
  for (const channel of tab.channels) channel.close(); // the old document stops listening
  return openTab();
};

const settle = async (ms = 800) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 25) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
  }
};

type Totals = { api: number; refresh: number; profile: number; analytics: number; me: number; staff: number; sessionChanged: number; messages: number; rotations: number };
const snapshot = () => ({ dispatches: dispatched.length, messages: messages.length, sessionChanged: sessionChanged(), rotations: tabs.map((t) => t.rotations()) });
const since = (start: ReturnType<typeof snapshot>): Totals => {
  const list = dispatched.slice(start.dispatches).map((d) => d.key);
  const count = (predicate: (k: string) => boolean) => list.filter(predicate).length;
  return {
    api: list.length,
    refresh: count((k) => k === "POST /auth/refresh"),
    profile: count((k) => k === "GET /businesses/my-profile"),
    analytics: count((k) => k.endsWith("/dashboard/analytics")),
    me: count((k) => k === "GET /auth/me"),
    staff: count((k) => k.endsWith("/staff")),
    sessionChanged: sessionChanged() - start.sessionChanged,
    messages: messages.length - start.messages,
    rotations: tabs.reduce((sum, t, i) => sum + t.rotations() - (start.rotations[i] ?? 0), 0),
  };
};
const report = (label: string, totals: Totals) => console.log(`[xtab] ${label} ${JSON.stringify(totals)}`);

/** All tabs settled, authenticated as `who` on the cookie's CURRENT family, showing only `who`'s business. */
const expectConverged = (who: Identity) => {
  for (const tab of tabs) {
    expect(tab.store.getState()).toMatchObject({ status: "authenticated", user: { id: who.id } });
    expect(tab.tokens.getSessionFamilyId()).toBe(jar.family);
    const profile = tab.queries.queryClient.getQueryData(["businesses", "profile"]) as { primary: { id: string } } | undefined;
    if (profile) expect(profile.primary.id).toBe(who.businessId);
  }
};
const expectQuiet = async () => {
  const start = snapshot();
  await settle(1000);
  expect(since(start).api).toBe(0);
};
const openSettled = async (count: number) => {
  for (let i = 0; i < count; i++) { const tab = await openTab(); await tab.mount(); await settle(600); }
};

const variants = [
  ["Web Locks (FIFO, Chrome-like)", true],
  ["no Web Locks (fallback)", false],
] as const;

beforeEach(() => {
  window.localStorage.clear();
  families.clear();
  familySeq = 0;
  signInCookie(OWNER_1);
  messages.length = 0;
  dispatched.length = 0;
  tabs.length = 0;
  BusChannel.members.clear();
  searchParams.value = "section=analytics";
  vi.stubGlobal("BroadcastChannel", BusChannel);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(async () => {
  for (const tab of tabs) { await tab.unmount(); tab.container.remove(); }
  Reflect.deleteProperty(window.navigator, "locks");
  vi.unstubAllGlobals();
});

const useLocks = (enabled: boolean) => {
  if (enabled) Object.defineProperty(window.navigator, "locks", { value: fifoLocks(), configurable: true });
  else Reflect.deleteProperty(window.navigator, "locks");
};

describe.each(variants)("cross-tab request amplification — %s", (_label, locks) => {
  it.each([1, 2, 3, 4])("%i dashboard tab(s) booting together (e.g. one dev full reload)", async (count) => {
    useLocks(locks);
    // A previously used browser profile: the session was established and announced earlier.
    await openSettled(1);
    await tabs[0]!.unmount(); tabs[0]!.container.remove(); tabs[0]!.channels.forEach((c) => c.close()); tabs.length = 0;
    for (let i = 0; i < count; i++) await openTab();
    const start = snapshot();
    await act(async () => { await Promise.all(tabs.map((tab) => tab.mount())); });
    await settle(1500);
    const totals = since(start);
    report(`${_label} | simultaneous boot N=${count}`, totals);
    // Before the routine-restore change: 5/11/16/21 (Web Locks) and 5/14/24/36 (no Web Locks).
    expect(totals.sessionChanged).toBe(0);
    expect(totals.api).toBe(5 * count);
    expectConverged(OWNER_1);
    await expectQuiet();
  });

  it.each([2, 3, 4])("one more tab opened while %i-1 tabs are already settled", async (count) => {
    useLocks(locks);
    await openSettled(count - 1);
    const newTab = await openTab();
    const start = snapshot();
    await newTab.mount();
    await settle(1500);
    const totals = since(start);
    report(`${_label} | one tab opens, ${count - 1} settled (N=${count})`, totals);
    // Before: 5 x N (every settled tab retired, refreshed and refetched for an unchanged session).
    expect(totals.sessionChanged).toBe(0);
    expect(totals.api).toBe(5);
    expectConverged(OWNER_1);
    await expectQuiet();
  });

  it("routine reload of one of 4 settled tabs", async () => {
    useLocks(locks);
    await openSettled(4);
    const start = snapshot();
    const reloaded = await reloadTab(tabs[3]!);
    await reloaded.mount();
    await settle(1500);
    const totals = since(start);
    report(`${_label} | routine reload, 4 tabs`, totals);
    expect(totals.sessionChanged).toBe(0); // before: 1 notice, 20 requests
    expect(totals.api).toBe(5);
    expectConverged(OWNER_1);
    await expectQuiet();
  });

  it("OAuth/redirect sign-in as another owner completes in a new tab: every open tab converges", async () => {
    useLocks(locks);
    await openSettled(3);
    signInCookie(OWNER_2); // the provider callback set a NEW refresh cookie server-side (no setAuth)
    const callbackTab = await openTab();
    const start = snapshot();
    await callbackTab.mount(); // the callback page's boot restore is the only announcement
    await settle(1500);
    const totals = since(start);
    report(`${_label} | OAuth redirect sign-in (owner-2), 3 open tabs`, totals);
    expect(totals.sessionChanged).toBeGreaterThanOrEqual(1);
    expectConverged(OWNER_2);
    for (const tab of tabs) expect(tab.container.textContent ?? "").not.toContain("biz-1");
  });

  it("same-user session replacement (new family, same owner) via redirect: every tab adopts the new family", async () => {
    useLocks(locks);
    await openSettled(3);
    const previousFamily = jar.family;
    revokeCookieFamily();
    signInCookie(OWNER_1);
    const callbackTab = await openTab();
    const start = snapshot();
    await callbackTab.mount();
    await settle(1500);
    const totals = since(start);
    report(`${_label} | same-user session replacement, 3 open tabs`, totals);
    expect(totals.sessionChanged).toBeGreaterThanOrEqual(1);
    expect(jar.family).not.toBe(previousFamily);
    expectConverged(OWNER_1);
  });

  it("password/OTP login as another owner in tab 1 (setAuth): every tab converges", async () => {
    useLocks(locks);
    await openSettled(3);
    const start = snapshot();
    const family = signInCookie(OWNER_2);
    await act(async () => tabs[0]!.store.getState().setAuth(authFor(family)));
    await settle(1500);
    report(`${_label} | login as owner-2 in tab 1, 3 tabs`, since(start));
    expectConverged(OWNER_2);
  });

  it("same-session notice (no identity change) reaching 3 settled tabs", async () => {
    useLocks(locks);
    await openSettled(3);
    const start = snapshot();
    externalNotice("AUTH_SESSION_CHANGED");
    await settle(1500);
    report(`${_label} | same-session notice -> 3 settled tabs`, since(start));
    expectConverged(OWNER_1);
  });

  it("two back-to-back notices reaching 3 settled tabs", async () => {
    useLocks(locks);
    await openSettled(3);
    const start = snapshot();
    externalNotice("AUTH_SESSION_CHANGED");
    externalNotice("AUTH_SESSION_CHANGED");
    await settle(1500);
    report(`${_label} | two notices -> 3 settled tabs`, since(start));
    expectConverged(OWNER_1);
  });

  it("identity switch announced by another tab: all tabs converge to the new owner, no old-owner data", async () => {
    useLocks(locks);
    await openSettled(3);
    const start = snapshot();
    signInCookie(OWNER_2);
    externalNotice("AUTH_SESSION_CHANGED");
    await settle(1500);
    report(`${_label} | identity switch notice -> 3 settled tabs`, since(start));
    expectConverged(OWNER_2);
    const afterSwitch = dispatched.slice(start.dispatches).filter((d) => d.key !== "POST /auth/refresh");
    expect(afterSwitch.every((d) => d.asUser === "owner-2" && !d.key.includes("biz-1"))).toBe(true);
    for (const tab of tabs) expect(tab.container.textContent ?? "").not.toContain("biz-1");
  });

  it("logout in one tab signs every tab out and retires private caches", async () => {
    useLocks(locks);
    await openSettled(3);
    const start = snapshot();
    await act(async () => { await tabs[0]!.store.getState().logout(); });
    await settle(1500);
    report(`${_label} | logout in tab 1 -> 3 tabs`, since(start));
    for (const tab of tabs) {
      expect(tab.store.getState()).toMatchObject({ status: "unauthenticated", user: null });
      expect(tab.queries.queryClient.getQueryData(["businesses", "profile"])).toBeUndefined();
    }
  });

  it("revoked/expired session discovered through a notice: every tab ends unauthenticated", async () => {
    useLocks(locks);
    await openSettled(3);
    const start = snapshot();
    revokeCookieFamily();
    externalNotice("AUTH_SESSION_CHANGED");
    await settle(1500);
    report(`${_label} | revoked session notice -> 3 tabs`, since(start));
    for (const tab of tabs) {
      expect(tab.store.getState()).toMatchObject({ status: "unauthenticated", user: null });
      expect(tab.queries.queryClient.getQueryData(["businesses", "profile"])).toBeUndefined();
    }
  });

  it("revoked session while a tab reloads: the reloaded tab signs out, nothing private is reused", async () => {
    useLocks(locks);
    await openSettled(2);
    revokeCookieFamily();
    const start = snapshot();
    const reloaded = await reloadTab(tabs[1]!);
    await reloaded.mount();
    await settle(1500);
    report(`${_label} | revoked session + reload, 2 tabs`, since(start));
    expect(reloaded.store.getState()).toMatchObject({ status: "unauthenticated", user: null });
    expect(reloaded.queries.queryClient.getQueryData(["businesses", "profile"])).toBeUndefined();
  });

  it("component remount without a page reload (Fast-Refresh-like) in one settled tab", async () => {
    useLocks(locks);
    await openSettled(1);
    const tab = tabs[0]!;
    const start = snapshot();
    await tab.unmount(); await tab.mount();
    await settle(800);
    report(`${_label} | remount one settled tab`, since(start));
    expectConverged(OWNER_1);
  });

  it("shared storage unavailable: one tab opens with 3 settled tabs and every tab still converges", async () => {
    useLocks(locks);
    await openSettled(3);
    const storage = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => { throw new Error("storage denied"); } });
    try {
      const newTab = await openTab();
      const start = snapshot();
      await newTab.mount();
      await settle(1500);
      const totals = since(start);
      report(`${_label} | storage unavailable, one tab opens (N=4)`, totals);
      // No shared record: the restore keeps announcing, exactly as before (fail toward sync).
      expect(totals.sessionChanged).toBe(1);
      expectConverged(OWNER_1);
    } finally {
      if (storage) Object.defineProperty(window, "localStorage", storage);
      else Reflect.deleteProperty(window, "localStorage");
    }
  });
});
