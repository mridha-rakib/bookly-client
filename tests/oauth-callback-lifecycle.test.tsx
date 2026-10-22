import { act, createElement, Profiler, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { AuthResponse } from "@/lib/api/auth";

const navigation = vi.hoisted(() => ({ pathname: "/", search: "status=success", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));

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
    this.listeners.forEach((listener) => listener(new MessageEvent("message", {
      data: { type, sourceTabId: "other-tab", intentId: "same-intent", familyId: "11111111-1111-4111-8111-111111111111" },
    })));
  }
}

const KEY = "bookly:logout-pending";
const auth: AuthResponse = {
  accessToken: "fixture.eyJzaWQiOiAiMTExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTExIiwgImZpeHR1cmUiOiAiYWNjb3VudC1hLXRva2VuIn0.signature", accessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
  user: { id: "a", email: "a@example.com", role: "CUSTOMER", status: "ACTIVE" },
};
const other: AuthResponse = { ...auth, accessToken: "fixture.eyJzaWQiOiAiMjIyMjIyMjItMjIyMi00MjIyLTgyMjItMjIyMjIyMjIyMjIyIiwgImZpeHR1cmUiOiAiYWNjb3VudC1iLXRva2VuIn0.signature", user: { ...auth.user, id: "b", email: "b@example.com" } };
const ok = (config: InternalAxiosRequestConfig, data: unknown = auth) => ({
  config, status: 200, statusText: "OK", headers: {}, data: { success: true, data: config.url === "/auth/logout" ? { ...JSON.parse(config.data as string), outcome: "revoked" } : data },
});
const failure = (config: InternalAxiosRequestConfig, status: number) => new AxiosError("Controlled failure", undefined, config, undefined, {
  config, status, statusText: "Failed", headers: { "retry-after": "60" }, data: { success: false },
});

let api: typeof import("@/lib/api/client");
let store: typeof import("@/lib/auth/store").useAuthStore;
let queries: typeof import("@/lib/query-client");
let tokens: typeof import("@/lib/auth/token-memory");
let adapter: Mock<AxiosAdapter>;
let root: Root | undefined;
let container: HTMLDivElement;
let commits: number;
const networkCount = (url: string) => adapter.mock.calls.filter(([config]) => config.url === url).length;
const markPending = (retryAt?: number) => localStorage.setItem(KEY, JSON.stringify({ id: "same-intent", familyId: "11111111-1111-4111-8111-111111111111", startedAt: Date.now(), retryAt }));

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("BroadcastChannel", TestBroadcastChannel);
  localStorage.clear();
  navigation.pathname = "/"; navigation.search = "status=success"; navigation.replace.mockClear();
  api = await import("@/lib/api/client");
  queries = await import("@/lib/query-client");
  tokens = await import("@/lib/auth/token-memory");
  store = (await import("@/lib/auth/store")).useAuthStore;
  adapter = vi.fn((config: InternalAxiosRequestConfig) => Promise.resolve(ok(config)));
  api.apiClient.defaults.adapter = adapter;
  container = document.createElement("div"); document.body.append(container); commits = 0;
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined; container.remove(); queries.queryClient.clear();
  vi.useRealTimers(); vi.unstubAllGlobals();
});

const mountCallback = async (provider: string) => {
  navigation.pathname = `/auth/${provider}/callback`;
  const Providers = (await import("@/app/providers")).default;
  const Page = (await import(`../src/app/auth/${provider}/callback/page.tsx`)).default;
  root = createRoot(container);
  await act(async () => root!.render(createElement(StrictMode, null,
    createElement(Profiler, { id: "callback", onRender: () => {
      commits += 1;
      // Fail the old lifecycle promptly; this assertion does not limit production restoration.
      if (commits > 12) throw new Error("OAuth callback remount loop");
    } }, createElement(Providers, null, createElement(Page))))));
};

describe("OAuth callbacks under the real Providers cache boundary", () => {
  it.each(["google", "facebook", "apple"])("%s remains bounded and signed out with pending logout in Strict Mode", async (provider) => {
    markPending();
    queries.queryClient.setQueryData(["private", "old-account"], "protected-data");
    const oldClient = queries.queryClient;
    await mountCallback(provider);
    const epoch = store.getState().cacheEpoch;
    const generation = api.getAuthGeneration();
    const commitCount = commits;
    await act(async () => {
      for (let i = 0; i < 20; i++) await store.getState().restoreSession({ resolveLogout: false });
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(store.getState()).toMatchObject({ status: "unauthenticated", user: null, cacheEpoch: epoch });
    expect(api.getAuthGeneration()).toBe(generation);
    expect(epoch).toBe(1); expect(commits).toBeLessThanOrEqual(commitCount + 3);
    expect(adapter).not.toHaveBeenCalled(); expect(tokens.getAccessToken()).toBeNull();
    expect(queries.queryClient).not.toBe(oldClient);
    expect(queries.queryClient.getQueryData(["private", "old-account"])).toBeUndefined();
    expect(container.textContent).toContain("Start sign-in again");
    expect(container.textContent).not.toContain("protected-data");
    expect(localStorage.getItem(KEY)).not.toBeNull(); expect(navigation.replace).not.toHaveBeenCalled();
    await act(async () => [...container.querySelectorAll("button")].find((b) => b.textContent === "Back to sign in")!.click());
    expect(navigation.replace).toHaveBeenCalledWith("/customer");
  });

  it.each(["google", "facebook", "apple"])("%s does not retry logout after 429 navigation, even when its deadline passes", async (provider) => {
    store.getState().setAuth(auth);
    adapter.mockImplementation(async (config) => { throw failure(config, 429); });
    await store.getState().logout();
    expect(networkCount("/auth/logout")).toBe(1);
    adapter.mockClear();
    await mountCallback(provider);
    const epoch = store.getState().cacheEpoch;
    await act(async () => vi.advanceTimersByTimeAsync(61_000));
    expect(adapter).not.toHaveBeenCalled(); expect(store.getState().cacheEpoch).toBe(epoch);
    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(container.textContent).toContain("Start sign-in again");
  });

  it.each(["google", "facebook", "apple"])("%s stays interrupted when logout resolves while mounted", async (provider) => {
    markPending(); await mountCallback(provider);
    await act(async () => { await store.getState().retryLogout(); });
    expect(networkCount("/auth/logout")).toBe(1); expect(networkCount("/auth/refresh")).toBe(0);
    expect((await import("@/lib/auth/logout-intent")).readLogoutIntent()).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(11_000));
    expect(container.textContent).toContain("Start sign-in again"); expect(navigation.replace).not.toHaveBeenCalled();
    expect(commits).toBeLessThan(12);
  });

  it.each(["google", "facebook", "apple"])("%s normally refreshes once and routes an authenticated cookie session", async (provider) => {
    await mountCallback(provider);
    expect(store.getState().status).toBe("authenticated");
    expect(networkCount("/auth/refresh")).toBe(1); expect(networkCount("/auth/logout")).toBe(0);
    expect(navigation.replace).toHaveBeenCalledWith("/"); expect(commits).toBeLessThan(12);
  });

  it.each(["google", "facebook", "apple"])("%s never trusts a success URL without a valid cookie session", async (provider) => {
    adapter.mockImplementation(async (config) => { throw failure(config, 401); });
    await mountCallback(provider);
    expect(store.getState().status).toBe("unauthenticated"); expect(tokens.getAccessToken()).toBeNull();
    expect(networkCount("/auth/refresh")).toBe(1); expect(navigation.replace).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Sign-in didn't complete"); expect(commits).toBeLessThan(12);
  });

  it.each(["google", "facebook", "apple"])("%s discards a stale refresh after account switching", async (provider) => {
    let resolve!: (value: ReturnType<typeof ok>) => void;
    let config!: InternalAxiosRequestConfig;
    adapter.mockImplementation((input) => { config = input; return new Promise((yes) => { resolve = yes; }); });
    await mountCallback(provider);
    await act(async () => store.getState().setAuth(other));
    const epoch = store.getState().cacheEpoch;
    await act(async () => { resolve(ok(config, auth)); });
    expect(store.getState()).toMatchObject({ user: other.user, cacheEpoch: epoch });
    expect(tokens.getAccessToken()).toBe(other.accessToken); expect(networkCount("/auth/refresh")).toBe(1);
    expect(networkCount("/auth/logout")).toBe(0); expect(commits).toBeLessThan(12);
  });

  it.each(["google", "facebook", "apple"])("%s blocks professional onboarding redirect while pending", async (provider) => {
    navigation.search = "status=onboarding&flow=professional&sessionId=untrusted-url";
    markPending(); await mountCallback(provider);
    expect(adapter).not.toHaveBeenCalled(); expect(navigation.replace).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Start sign-in again");
  });
});

describe("idempotent teardown and cross-tab retry metadata", () => {
  it("repeated ordinary restoration of one pending intent does not rotate again", async () => {
    markPending(Date.now() + 60_000);
    for (let i = 0; i < 20; i++) await store.getState().restoreSession();
    expect(store.getState().cacheEpoch).toBe(1); expect(adapter).not.toHaveBeenCalled();
    expect(store.getState().status).toBe("unauthenticated");
  });

  it("genuine account and role changes retire caches and advance generations", () => {
    store.getState().setAuth(auth);
    const epochA = store.getState().cacheEpoch, generationA = api.getAuthGeneration(), clientA = queries.queryClient;
    queries.queryClient.setQueryData(["private"], "old-account"); store.getState().setAuth(other);
    expect(store.getState().cacheEpoch).toBe(epochA + 1); expect(api.getAuthGeneration()).toBeGreaterThan(generationA);
    expect(queries.queryClient).not.toBe(clientA); expect(queries.queryClient.getQueryData(["private"])).toBeUndefined();
    store.getState().setAuth({ ...other, user: { ...other.user, role: "BUSINESS_OWNER" } });
    expect(store.getState().cacheEpoch).toBe(epochA + 2);
    store.getState().clearAuth(); const signedOutEpoch = store.getState().cacheEpoch;
    store.getState().clearAuth(); expect(store.getState().cacheEpoch).toBe(signedOutEpoch);
  });

  it("duplicate broadcasts and storage updates preserve epochs while synchronizing a visible countdown", async () => {
    store.getState().setAuth(auth); markPending();
    TestBroadcastChannel.instance.receive("AUTH_LOGOUT_PENDING");
    const epoch = store.getState().cacheEpoch, generation = api.getAuthGeneration();
    const Notice = (await import("@/components/auth/LogoutPendingNotice")).default;
    root = createRoot(container); await act(async () => root!.render(createElement(Notice)));
    const retryAt = Date.now() + 45_000; markPending(retryAt);
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: localStorage.getItem(KEY) }));
        TestBroadcastChannel.instance.receive("AUTH_LOGOUT_PENDING");
      }
    });
    expect(store.getState().cacheEpoch).toBe(epoch); expect(api.getAuthGeneration()).toBe(generation);
    expect(store.getState().logoutState.retryAt).toBe(retryAt);
    expect(container.textContent).toContain("Retry sign-out in 45s");
    expect(container.querySelector("button")!.disabled).toBe(true);
    await store.getState().retryLogout(); expect(adapter).not.toHaveBeenCalled();
    await act(async () => {
      localStorage.removeItem(KEY); TestBroadcastChannel.instance.receive("AUTH_LOGOUT_CONFIRMED");
    });
    expect(store.getState().logoutState.phase).toBe("confirmed"); expect(store.getState().cacheEpoch).toBe(epoch);
    expect(container.textContent).toContain("You're signed out.");
  });
});
