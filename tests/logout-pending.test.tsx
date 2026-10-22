import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  AxiosError,
  type AxiosAdapter,
  CanceledError,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { AuthResponse, UserRole } from "@/lib/api/auth";

// Phase 1B — pending (unconfirmed) logout. Real store, Axios client/interceptors, query client,
// cross-tab channel and logout-intent persistence (jsdom localStorage); HTTP is a test adapter.

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("status=success"),
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
  receive(type: string, correlation?: { id: string; familyId?: string }) {
    this.listeners.forEach((listener) => listener(new MessageEvent("message", {
      data: { type, sourceTabId: "another-tab", intentId: correlation?.id ?? "remote", familyId: correlation?.familyId ?? "11111111-1111-4111-8111-111111111111" },
    })));
  }
}

const KEY = "bookly:logout-pending";
const userA = { id: "user-a", email: "a@example.com", role: "CUSTOMER" as UserRole, status: "ACTIVE" as const };
const authA: AuthResponse = { accessToken: "fixture.eyJzaWQiOiAiMTExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTExIiwgImZpeHR1cmUiOiAidG9rZW4tYSJ9.signature", accessTokenExpiresAt: "2099-01-01T00:00:00.000Z", user: userA };
const authB: AuthResponse = {
  accessToken: "fixture.eyJzaWQiOiAiMjIyMjIyMjItMjIyMi00MjIyLTgyMjItMjIyMjIyMjIyMjIyIiwgImZpeHR1cmUiOiAidG9rZW4tYiJ9.signature",
  accessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
  user: { ...userA, id: "user-b", email: "b@example.com" },
};

const ok = (config: InternalAxiosRequestConfig, data: unknown = authA) => ({
  status: 200, statusText: "OK", config, headers: {}, data: { success: true, message: "OK", data: config.url === "/auth/logout" ? { ...JSON.parse(config.data as string), outcome: "revoked" } : data },
});
const failure = (config: InternalAxiosRequestConfig, status: number, headers: Record<string, string> = {}, code?: string) =>
  new AxiosError("Request failed", undefined, config, undefined, {
    status, statusText: "Failed", config, headers,
    data: { success: false, message: "Request failed", errors: code ? [{ code, message: code }] : [] },
  });
const networkError = (config: InternalAxiosRequestConfig) => new AxiosError("Network Error", "ERR_NETWORK", config);
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

let api: typeof import("@/lib/api/client");
let store: typeof import("@/lib/auth/store").useAuthStore;
let tokens: typeof import("@/lib/auth/token-memory");
let queries: typeof import("@/lib/query-client");
let adapter: Mock<AxiosAdapter>;
let intents: typeof import("@/lib/auth/logout-intent");
let root: Root | undefined;
let container: HTMLDivElement;

type Handler = (config: InternalAxiosRequestConfig) => Promise<unknown>;
const route = (handlers: { refresh?: Handler; logout?: Handler; login?: Handler }) => {
  adapter.mockImplementation((config: InternalAxiosRequestConfig) => {
    if (config.url === "/auth/refresh") return (handlers.refresh ?? ((c) => Promise.resolve(ok(c))))(config) as never;
    if (config.url === "/auth/logout") return (handlers.logout ?? ((c) => Promise.resolve(ok(c, undefined))))(config) as never;
    if (config.url?.includes("/login")) return (handlers.login ?? ((c) => Promise.resolve(ok(c, authB))))(config) as never;
    return Promise.resolve(ok(config, {})) as never;
  });
};
const urls = () => adapter.mock.calls.map(([config]) => config.url);
const count = (url: string) => urls().filter((value) => value === url).length;
const posted = () => TestBroadcastChannel.instance.postMessage.mock.calls.map(([event]) => event.type as string);
const marker = () => {
  return intents.readLogoutIntent();
};

/** A fresh module graph = a page reload or a newly opened tab (same localStorage). */
const loadTab = async () => {
  vi.resetModules();
  api = await import("@/lib/api/client");
  tokens = await import("@/lib/auth/token-memory");
  queries = await import("@/lib/query-client");
  store = (await import("@/lib/auth/store")).useAuthStore;
  intents = await import("@/lib/auth/logout-intent");
  adapter = vi.fn((config: InternalAxiosRequestConfig) => Promise.resolve(ok(config)));
  api.apiClient.defaults.adapter = adapter;
};

const signIn = (auth: AuthResponse = authA) => {
  store.getState().setAuth(auth);
  TestBroadcastChannel.instance.postMessage.mockClear();
};

/** Minimal exclusive Web Locks (FIFO) with `signal` support, like navigator.locks. */
const installWebLocks = () => {
  let tail: Promise<unknown> = Promise.resolve();
  const request = (_name: string, optionsOrCallback: unknown, maybeCallback?: unknown) => {
    const callback = (typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback) as () => Promise<unknown>;
    const signal = typeof optionsOrCallback === "function" ? undefined : (optionsOrCallback as { signal?: AbortSignal }).signal;
    return new Promise((resolve, reject) => {
      let granted = false;
      const run = tail.then(() => {
        if (signal?.aborted) throw signal.reason;
        granted = true;
        return callback();
      });
      tail = run.then(() => undefined, () => undefined);
      signal?.addEventListener("abort", () => { if (!granted) reject(signal.reason); });
      run.then(resolve, reject);
    });
  };
  vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { locks: { request } }));
};

beforeEach(async () => {
  window.localStorage.clear();
  replace.mockClear();
  vi.stubGlobal("BroadcastChannel", TestBroadcastChannel);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await loadTab();
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("logout outcomes", () => {
  it("a delayed override login cannot clear a replacement intent or authenticate through it", async () => {
    signIn();
    const pending = deferred<unknown>();
    route({ logout: async (c) => { throw failure(c, 500); }, login: () => pending.promise });
    await store.getState().logout();
    store.getState().allowSignInDuringPendingLogout();
    const login = api.apiRequest<AuthResponse>({ method: "POST", url: "/auth/customer/login", data: {} });
    await vi.waitFor(() => expect(count("/auth/customer/login")).toBe(1));
    const newer = { id: "newer-during-override", familyId: "22222222-2222-4222-8222-222222222222", startedAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(newer));
    const config = adapter.mock.calls.find(([c]) => c.url === "/auth/customer/login")![0];
    pending.resolve(ok(config, authB));
    await expect(login).rejects.toThrow("Session restoration is blocked");
    expect(marker()).toEqual(newer);
    store.getState().setAuth(authB);
    expect(store.getState().status).toBe("unauthenticated");
    expect(tokens.getAccessToken()).toBeNull();
  });
  it("an interleaved marker at creation cannot retarget the user's logout to a newer family", async () => {
    signIn();
    const newer = { id: "newer-at-creation", familyId: "22222222-2222-4222-8222-222222222222", startedAt: Date.now() };
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      original.call(this, key, value);
      if (key === KEY) original.call(this, KEY, JSON.stringify(newer));
    });
    try {
      await expect(store.getState().logout()).resolves.toBe("superseded");
      expect(marker()).toEqual(newer);
      expect(adapter).not.toHaveBeenCalled();
      expect(store.getState().logoutState.phase).toBe("unconfirmed");
    } finally { spy.mockRestore(); }
  });
  it("an intent-scoped receipt survives an interleaved newer marker without deleting or confirming it", async () => {
    signIn();
    const newer = { id: "interleaved-new", familyId: "22222222-2222-4222-8222-222222222222", startedAt: Date.now() };
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith("bookly:logout-resolved:")) original.call(this, KEY, JSON.stringify(newer));
      original.call(this, key, value);
    });
    try {
      await expect(store.getState().logout()).resolves.toBe("superseded");
      expect(marker()).toEqual(newer);
      expect(posted()).not.toContain("AUTH_LOGOUT_CONFIRMED");
      expect(store.getState().logoutState.phase).toBe("unconfirmed");
    } finally { spy.mockRestore(); }
  });

  it("an interleaved old Retry-After write cannot overwrite a newer marker", async () => {
    signIn();
    const newer = { id: "interleaved-new", familyId: "22222222-2222-4222-8222-222222222222", startedAt: Date.now() };
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith("bookly:logout-retry:")) original.call(this, KEY, JSON.stringify(newer));
      original.call(this, key, value);
    });
    route({ logout: async (c) => { throw failure(c, 429, { "retry-after": "30" }); } });
    try {
      await store.getState().logout();
      expect(marker()).toEqual(newer);
    } finally { spy.mockRestore(); }
  });
  it("persists only the intended JWT family before dropping the in-memory token", async () => {
    signIn();
    route({ logout: async (c) => { throw failure(c, 500); } });
    await store.getState().logout();
    const raw = window.localStorage.getItem(KEY)!;
    expect(JSON.parse(raw).familyId).toBe("11111111-1111-4111-8111-111111111111");
    expect(raw).not.toContain(authA.accessToken);
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toMatchObject({ familyId: "11111111-1111-4111-8111-111111111111" });
  });

  it.each(["missing", "wrong-intent", "wrong-family", "wrong-outcome"])("rejects HTTP 200 with %s acknowledgement", async (kind) => {
    signIn();
    route({ logout: async (c) => {
      const ack = { ...JSON.parse(c.data as string), outcome: "revoked" };
      if (kind === "wrong-intent") ack.intentId = "another";
      if (kind === "wrong-family") ack.familyId = "22222222-2222-4222-8222-222222222222";
      if (kind === "wrong-outcome") ack.outcome = "noop";
      return { ...ok(c), data: { success: true, data: kind === "missing" ? undefined : ack } };
    } });
    await expect(store.getState().logout()).resolves.toBe("unconfirmed");
    expect(marker()).not.toBeNull();
    expect(posted()).not.toContain("AUTH_LOGOUT_CONFIRMED");
  });

  it("an old tab's scheduled retry targets A after external B cookie replacement and retains mismatch", async () => {
    vi.useFakeTimers();
    signIn();
    let currentCookieFamily = "A";
    route({ logout: async (c) => {
      if (currentCookieFamily === "A") throw failure(c, 500);
      expect(JSON.parse(c.data as string).familyId).toBe("11111111-1111-4111-8111-111111111111");
      throw failure(c, 409, {}, "LOGOUT_FAMILY_MISMATCH");
    } });
    await store.getState().logout();
    const original = marker();
    currentCookieFamily = "B";
    await vi.advanceTimersByTimeAsync(2_000);
    expect(count("/auth/logout")).toBe(2);
    expect(marker()).toEqual(original);
    expect(store.getState().logoutState).toMatchObject({ phase: "unconfirmed", reason: "FAMILY_MISMATCH" });
    expect(posted()).not.toContain("AUTH_LOGOUT_CONFIRMED");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(count("/auth/logout")).toBe(2);
  });

  it.each(["success", "429", "500"])("a delayed old %s response cannot mutate a newer intent", async (result) => {
    signIn();
    const pending = deferred<unknown>();
    route({ logout: () => pending.promise });
    const attempt = store.getState().logout();
    await vi.waitFor(() => expect(count("/auth/logout")).toBe(1));
    const c = adapter.mock.calls[0][0];
    const newer = { id: "new-intent", familyId: "22222222-2222-4222-8222-222222222222", startedAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(newer));
    if (result === "success") pending.resolve(ok(c));
    else pending.reject(failure(c, Number(result), { "retry-after": "60" }));
    await expect(attempt).resolves.toBe("superseded");
    expect(marker()).toEqual(newer);
    expect(posted()).not.toContain("AUTH_LOGOUT_CONFIRMED");
    TestBroadcastChannel.instance.receive("AUTH_LOGOUT_CONFIRMED", { id: "old-intent" });
    expect(marker()).toEqual(newer);
  });

  it("a legacy pending marker cannot infer its target from a replacement cookie", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ id: "legacy", startedAt: Date.now() }));
    await store.getState().restoreSession();
    await expect(store.getState().retryLogout()).resolves.toBe("unconfirmed");
    expect(adapter).not.toHaveBeenCalled();
    expect(store.getState().logoutState.reason).toBe("REJECTED");
  });

  it("an unreadable record stays fail closed even when an older unreadable receipt exists", async () => {
    window.localStorage.setItem(KEY, "corrupt-new-record");
    window.localStorage.setItem("bookly:logout-resolved:unreadable", "{}");
    await store.getState().restoreSession();
    expect(marker()).toMatchObject({ id: "unreadable" });
    expect(adapter).not.toHaveBeenCalled();
    expect(store.getState().status).toBe("unauthenticated");
  });
  it("success: intent is recorded BEFORE the request and cleared only by the server's acknowledgement", async () => {
    signIn();
    let markerAtRequest: unknown = "not-sent";
    route({ logout: async (c) => { markerAtRequest = marker(); return ok(c, undefined); } });

    await expect(store.getState().logout()).resolves.toBe("confirmed");

    expect(markerAtRequest).toMatchObject({ id: expect.any(String) });
    expect(marker()).toBeNull();
    expect(store.getState()).toMatchObject({ status: "unauthenticated", isLoggingOut: false });
    expect(store.getState().logoutState.phase).toBe("confirmed");
    expect(tokens.getAccessToken()).toBeNull();
    expect(posted()).toEqual(["AUTH_LOGOUT_PENDING", "AUTH_LOGOUT_CONFIRMED"]);
  });

  it("429: stays signed out, keeps the intent with Retry-After, and never claims confirmation", async () => {
    signIn();
    route({ logout: async (c) => { throw failure(c, 429, { "retry-after": "30" }); } });
    const before = Date.now();

    await expect(store.getState().logout()).resolves.toBe("unconfirmed");

    expect(store.getState().status).toBe("unauthenticated");
    expect(store.getState().logoutState).toMatchObject({ phase: "unconfirmed", reason: "RATE_LIMITED", persisted: true });
    expect(marker()?.retryAt).toBeGreaterThanOrEqual(before + 29_000);
    expect(posted()).toEqual(["AUTH_LOGOUT_PENDING"]);
    expect(count("/auth/refresh")).toBe(0);
  });

  it.each([500, 503])("%i: unconfirmed SERVER_ERROR, intent kept", async (status) => {
    signIn();
    route({ logout: async (c) => { throw failure(c, status); } });
    await expect(store.getState().logout()).resolves.toBe("unconfirmed");
    expect(store.getState().logoutState).toMatchObject({ phase: "unconfirmed", reason: "SERVER_ERROR" });
    expect(marker()).not.toBeNull();
    expect(posted()).not.toContain("AUTH_LOGOUT_CONFIRMED");
  });

  it("network failure: unconfirmed NETWORK, intent kept", async () => {
    signIn();
    route({ logout: async (c) => { throw networkError(c); } });
    await expect(store.getState().logout()).resolves.toBe("unconfirmed");
    expect(store.getState().logoutState.reason).toBe("NETWORK");
    expect(marker()).not.toBeNull();
  });

  it("timeout: a request that never answers is abandoned after the bound, intent kept", async () => {
    vi.useFakeTimers();
    signIn();
    route({
      logout: (c) => new Promise((_resolve, reject) => {
        c.signal?.addEventListener?.("abort", () => reject(new CanceledError()));
      }),
    });
    const outcome = store.getState().logout();
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(outcome).resolves.toBe("unconfirmed");
    expect(store.getState().logoutState.reason).toBe("TIMEOUT");
    expect(marker()).not.toBeNull();
  });

  it("response lost after the server revoked: the retry is an idempotent no-op that confirms", async () => {
    signIn();
    let attempt = 0;
    route({ logout: async (c) => { attempt += 1; if (attempt === 1) throw networkError(c); return ok(c, undefined); } });
    await expect(store.getState().logout()).resolves.toBe("unconfirmed");
    await expect(store.getState().retryLogout()).resolves.toBe("confirmed");
    expect(marker()).toBeNull();
  });

  it("a delayed success still confirms even if local auth generations moved on meanwhile", async () => {
    signIn();
    const pending = deferred<unknown>();
    route({ logout: () => pending.promise });
    const outcome = store.getState().logout();
    await vi.waitFor(() => expect(count("/auth/logout")).toBe(1));
    TestBroadcastChannel.instance.receive("AUTH_LOGGED_OUT");
    api.invalidateInFlightAuth();
    pending.resolve(ok(adapter.mock.calls[0]![0], undefined));
    await expect(outcome).resolves.toBe("confirmed");
    expect(marker()).toBeNull();
  });

  it("repeated logout retains the existing confirmation without inventing a new target", async () => {
    signIn();
    await expect(store.getState().logout()).resolves.toBe("confirmed");
    await expect(store.getState().logout()).resolves.toBe("confirmed");
    expect(count("/auth/logout")).toBe(1);
  });
});

describe("multiple clicks, retry and backoff", () => {
  it("a second click while the first is in flight shares the same attempt (no false success)", async () => {
    signIn();
    const pending = deferred<unknown>();
    route({ logout: () => pending.promise });
    const first = store.getState().logout();
    const second = store.getState().logout();
    expect(second).toBe(first);
    await vi.waitFor(() => expect(count("/auth/logout")).toBe(1));
    pending.reject(failure(adapter.mock.calls[0]![0], 429));
    await expect(first).resolves.toBe("unconfirmed");
    await expect(second).resolves.toBe("unconfirmed");
    expect(count("/auth/logout")).toBe(1);
  });

  it("Retry-After is honored for manual and automatic retries; the automatic one confirms after reset", async () => {
    vi.useFakeTimers();
    signIn();
    let attempt = 0;
    route({ logout: async (c) => { attempt += 1; if (attempt === 1) throw failure(c, 429, { "retry-after": "30" }); return ok(c, undefined); } });
    await expect(store.getState().logout()).resolves.toBe("unconfirmed");

    await expect(store.getState().retryLogout()).resolves.toBe("unconfirmed");
    await vi.advanceTimersByTimeAsync(29_000);
    expect(count("/auth/logout")).toBe(1);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(count("/auth/logout")).toBe(2);
    expect(store.getState().logoutState.phase).toBe("confirmed");
    expect(marker()).toBeNull();
  });

  it("explicit retry after the rate-limit window resets succeeds", async () => {
    vi.useFakeTimers();
    signIn();
    let attempt = 0;
    route({ logout: async (c) => { attempt += 1; if (attempt === 1) throw failure(c, 429, { "retry-after": "5" }); return ok(c, undefined); } });
    await store.getState().logout();
    vi.setSystemTime(Date.now() + 6_000);
    await expect(store.getState().retryLogout()).resolves.toBe("confirmed");
  });

  it("5xx retries are bounded (3 automatic), then only manual retry", async () => {
    vi.useFakeTimers();
    signIn();
    route({ logout: async (c) => { throw failure(c, 500); } });
    await store.getState().logout();
    await vi.advanceTimersByTimeAsync(2_000 + 10_000 + 30_000);
    expect(count("/auth/logout")).toBe(4);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(count("/auth/logout")).toBe(4);
    await store.getState().retryLogout();
    expect(count("/auth/logout")).toBe(5);
    expect(marker()).not.toBeNull();
  });
});

describe("reload, new tab and route guards while logout is unconfirmed", () => {
  const failLogout = async () => {
    signIn();
    route({ logout: async (c) => { throw failure(c, 429, { "retry-after": "60" }); } });
    await store.getState().logout();
  };

  it("reload: no /auth/refresh is sent; the tab stays signed out and shows the pending state", async () => {
    await failLogout();
    await loadTab(); // reload
    route({ logout: async (c) => { throw failure(c, 429, { "retry-after": "60" }); } });
    await store.getState().restoreSession(); // Providers' boot effect

    expect(count("/auth/refresh")).toBe(0);
    expect(store.getState().status).toBe("unauthenticated");
    expect(store.getState().logoutState).toMatchObject({ phase: "unconfirmed", reason: "RATE_LIMITED" });
    // Retry-After persisted across the reload: not even the logout is re-sent yet.
    expect(count("/auth/logout")).toBe(0);
  });

  it("new tab after a 5xx: the boot path resolves the pending logout instead of restoring", async () => {
    signIn();
    route({ logout: async (c) => { throw failure(c, 500); } });
    await store.getState().logout();
    await loadTab(); // newly opened tab
    route({});
    await store.getState().restoreSession();
    await vi.waitFor(() => expect(store.getState().logoutState.phase).toBe("confirmed"));
    expect(urls()).toEqual(["/auth/logout"]);
    expect(store.getState().status).toBe("unauthenticated");
    expect(marker()).toBeNull();
  });

  it.each([
    ["RequireCustomer"], ["RequireBusinessOwner"], ["RequireStaff"], ["RequireSupervisor"], ["RequireSuperAdmin"],
  ] as const)("%s renders no protected content and does not refresh while logout is unconfirmed", async (name) => {
    await failLogout();
    await loadTab();
    route({ logout: async (c) => { throw failure(c, 429, { "retry-after": "60" }); } });
    const Guard = (await import(`../src/components/auth/${name}.tsx`)).default;
    const renderProtected = vi.fn(() => createElement("div", null, "protected-data"));
    root = createRoot(container);
    await act(async () => root!.render(createElement(Guard, null, createElement(renderProtected))));
    await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(renderProtected).not.toHaveBeenCalled();
    expect(count("/auth/refresh")).toBe(0);
  });

  it("the global notice distinguishes pending, unconfirmed and confirmed, and offers Retry sign-out", async () => {
    const Notice = (await import("@/components/auth/LogoutPendingNotice")).default;
    root = createRoot(container);
    await act(async () => root!.render(createElement(Notice)));
    expect(container.textContent).toBe("");
    signIn();
    route({ logout: async (c) => { throw failure(c, 500); } });
    await act(async () => { await store.getState().logout(); });
    expect(container.textContent).toContain("Sign-out not confirmed");
    expect(container.textContent).toContain("Retry sign-out");
    expect(container.textContent).not.toContain("You're signed out.");
    route({});
    const retry = [...container.querySelectorAll("button")].find((b) => b.textContent === "Retry sign-out")!;
    await act(async () => { retry.click(); });
    await vi.waitFor(() => expect(container.textContent).toContain("You're signed out."));
  });
});

describe("cross-tab behavior", () => {
  it("a tab learning of another tab's pending logout signs out and cannot restore afterwards", async () => {
    signIn();
    window.localStorage.setItem(KEY, JSON.stringify({ id: "other", startedAt: Date.now() }));
    TestBroadcastChannel.instance.receive("AUTH_LOGOUT_PENDING", { id: "other" });
    expect(store.getState().status).toBe("unauthenticated");
    expect(tokens.getAccessToken()).toBeNull();
    expect(store.getState().logoutState.phase).toBe("unconfirmed");
    route({ logout: async (c) => { throw failure(c, 500); } });
    await store.getState().restoreSession();
    expect(count("/auth/refresh")).toBe(0);
  });

  it("AUTH_SESSION_CHANGED from another tab is ignored while logout is unconfirmed", async () => {
    signIn();
    route({ logout: async (c) => { throw failure(c, 429, { "retry-after": "60" }); } });
    await store.getState().logout();
    TestBroadcastChannel.instance.receive("AUTH_SESSION_CHANGED");
    await Promise.resolve();
    expect(count("/auth/refresh")).toBe(0);
    expect(store.getState().status).toBe("unauthenticated");
  });

  it("storage events alone (no BroadcastChannel) sign another tab out and later resolve its notice", async () => {
    signIn();
    window.localStorage.setItem(KEY, JSON.stringify({ id: "other", startedAt: Date.now() }));
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: window.localStorage.getItem(KEY) }));
    expect(store.getState().status).toBe("unauthenticated");
    expect(store.getState().logoutState.phase).toBe("unconfirmed");
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: null }));
    expect(store.getState().logoutState.phase).toBe("idle");
  });

  it("a late AUTH_LOGOUT_CONFIRMED cannot end a session established afterwards", async () => {
    signIn(authB);
    TestBroadcastChannel.instance.receive("AUTH_LOGOUT_CONFIRMED");
    expect(store.getState()).toMatchObject({ status: "authenticated" });
    expect(tokens.getAccessToken()).toBe("fixture.eyJzaWQiOiAiMjIyMjIyMjItMjIyMi00MjIyLTgyMjItMjIyMjIyMjIyMjIyIiwgImZpeHR1cmUiOiAidG9rZW4tYiJ9.signature");
  });

  it("a refresh that returns after logout began is discarded and cannot overwrite the pending state", async () => {
    signIn();
    const refresh = deferred<unknown>();
    route({ refresh: () => refresh.promise, logout: async (c) => { throw failure(c, 429, { "retry-after": "60" }); } });
    const restoring = store.getState().restoreSession();
    await vi.waitFor(() => expect(count("/auth/refresh")).toBe(1));
    await store.getState().logout();
    refresh.resolve(ok(adapter.mock.calls[0]![0]));
    await restoring;
    expect(store.getState().status).toBe("unauthenticated");
    expect(tokens.getAccessToken()).toBeNull();
    expect(marker()).not.toBeNull();
  });
});

describe("Web Locks", () => {
  it("a hung refresh holding the cookie lock cannot block logout forever; retry succeeds once the lock frees", async () => {
    vi.useFakeTimers();
    installWebLocks();
    await loadTab();
    signIn();
    const refresh = deferred<unknown>();
    route({ refresh: () => refresh.promise });
    const restoring = store.getState().restoreSession();
    await vi.waitFor(() => expect(count("/auth/refresh")).toBe(1));

    const outcome = store.getState().logout();
    expect(store.getState().status).toBe("unauthenticated");
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(outcome).resolves.toBe("unconfirmed");
    expect(store.getState().logoutState.reason).toBe("TIMEOUT");
    expect(count("/auth/logout")).toBe(0);

    refresh.resolve(ok(adapter.mock.calls[0]![0]));
    await restoring;
    expect(store.getState().status).toBe("unauthenticated");
    await expect(store.getState().retryLogout()).resolves.toBe("confirmed");
    expect(count("/auth/logout")).toBe(1);
  });
});

describe("sign-in while logout is unconfirmed", () => {
  const login = () => api.apiRequest({ method: "POST", url: "/auth/customer/login", data: { email: "b@example.com", password: "pw" } });

  it("blocked: the pending logout is tried first; if still unconfirmed no login request is sent", async () => {
    signIn();
    route({ logout: async (c) => { throw failure(c, 429, { "retry-after": "60" }); } });
    await store.getState().logout();
    await expect(login()).rejects.toMatchObject({ code: "LOGOUT_PENDING" });
    expect(count("/auth/customer/login")).toBe(0);
    expect(marker()).not.toBeNull();
  });

  it("resolved first: a confirmed logout lets the login proceed (logout strictly before login)", async () => {
    signIn();
    route({ logout: async (c) => { throw failure(c, 500); } });
    await store.getState().logout();
    route({});
    await expect(login()).resolves.toMatchObject({ user: { id: "user-b" } });
    expect(urls().slice(-2)).toEqual(["/auth/logout", "/auth/customer/login"]);
    expect(marker()).toBeNull();
  });

  it("explicit override: login replaces the cookie; intent cleared only after login succeeds; no account/cache inheritance", async () => {
    signIn();
    queries.queryClient.setQueryData(["businesses", "profile"], { owner: "A" });
    route({ logout: async (c) => { throw failure(c, 429, { "retry-after": "60" }); }, login: async (c) => { throw failure(c, 401, {}, "INVALID_CREDENTIALS"); } });
    await store.getState().logout();
    store.getState().allowSignInDuringPendingLogout();
    expect(store.getState().logoutState.signInOverride).toBe(true);

    await expect(login()).rejects.toMatchObject({ status: 401 });
    expect(marker()).not.toBeNull(); // a failed sign-in did not replace the cookie

    route({ logout: async (c) => { throw failure(c, 429); } });
    const result = await login();
    expect(marker()).toBeNull();
    expect(store.getState().logoutState.phase).toBe("idle");
    store.getState().setAuth(result as AuthResponse);
    expect(store.getState().user?.id).toBe("user-b");
    expect(queries.queryClient.getQueryData(["businesses", "profile"])).toBeUndefined();
    expect(count("/auth/logout")).toBe(1);
  });
});

describe("storage failures", () => {
  it("unwritable storage: this tab stays protected, the UI reports it is not persisted", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    signIn();
    route({ logout: async (c) => { throw failure(c, 500); } });
    await store.getState().logout();
    expect(store.getState().logoutState.persisted).toBe(false);
    await store.getState().restoreSession();
    expect(count("/auth/refresh")).toBe(0);
  });

  it("unreadable storage: the in-memory intent still blocks restoration in this tab", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("SecurityError"); });
    signIn();
    route({ logout: async (c) => { throw failure(c, 429, { "retry-after": "60" }); } });
    await store.getState().logout();
    await store.getState().restoreSession();
    expect(count("/auth/refresh")).toBe(0);
    expect(store.getState().status).toBe("unauthenticated");
  });

  it("documented limitation: without storage, a RELOAD cannot know about the pending logout", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    signIn();
    route({ logout: async (c) => { throw failure(c, 500); } });
    await store.getState().logout();
    await loadTab();
    await store.getState().restoreSession();
    expect(count("/auth/refresh")).toBe(1);
  });
});

describe("account cache protection", () => {
  it("logout retires account caches immediately, even when the server never confirms", async () => {
    signIn();
    queries.queryClient.setQueryData(["auth", "me"], { user: "A" });
    route({ logout: async (c) => { throw networkError(c); } });
    const before = queries.queryClient;
    await store.getState().logout();
    expect(queries.queryClient).not.toBe(before);
    expect(queries.queryClient.getQueryData(["auth", "me"])).toBeUndefined();
  });
});
