import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { AuthResponse, UserRole } from "@/lib/api/auth";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams("status=success"),
}));

class TestBroadcastChannel {
  static instance: TestBroadcastChannel;
  postMessage = vi.fn();
  listeners: ((event: MessageEvent) => void)[] = [];
  constructor() { TestBroadcastChannel.instance = this; }
  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.push(listener);
  }
  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners = this.listeners.filter((value) => value !== listener);
  }
  receive(type: string) {
    this.listeners.forEach((listener) => listener(new MessageEvent("message", {
      data: { type, sourceTabId: "another-tab", intentId: "remote", familyId: "11111111-1111-4111-8111-111111111111" },
    })));
  }
}

const auth: AuthResponse = {
  accessToken: "fixture.eyJzaWQiOiAiMTExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTExIiwgImZpeHR1cmUiOiAidmFsaWQtYWNjZXNzLXRva2VuIn0.signature",
  accessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
  user: { id: "user-1", email: "user@example.com", role: "CUSTOMER", status: "ACTIVE" },
};

const response = (config: InternalAxiosRequestConfig, data: unknown = auth) => ({
  status: 200, statusText: "OK", config, headers: {},
  data: { success: true, message: "OK", data: config.url === "/auth/logout" ? { ...JSON.parse(config.data as string), outcome: "revoked" } : data },
});
const failure = (config: InternalAxiosRequestConfig, status: number, code?: string) =>
  new AxiosError("Request failed", undefined, config, undefined, {
    status, statusText: "Failed", config, headers: {},
    data: { success: false, message: "Request failed", errors: code ? [{ code, message: code }] : [] },
  });
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
let root: Root | undefined;
let container: HTMLDivElement;

beforeEach(async () => {
  // Pending-logout intent is persisted in localStorage (shared across tests in jsdom).
  window.localStorage.clear();
  vi.resetModules();
  replace.mockClear();
  vi.stubGlobal("BroadcastChannel", TestBroadcastChannel);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api = await import("@/lib/api/client");
  tokens = await import("@/lib/auth/token-memory");
  queries = await import("@/lib/query-client");
  store = (await import("@/lib/auth/store")).useAuthStore;
  adapter = vi.fn((config: InternalAxiosRequestConfig) => Promise.resolve(response(config)));
  api.apiClient.defaults.adapter = adapter;
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  queries.queryClient.clear();
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const signIn = () => {
  store.getState().setAuth(auth);
  TestBroadcastChannel.instance.postMessage.mockClear();
};
const rejectRefresh = (status: number, code?: string) => {
  adapter.mockImplementation((config: InternalAxiosRequestConfig) =>
    Promise.reject(failure(config, config.url === "/auth/refresh" ? status : 401, code)));
};

describe("refresh and session recovery", () => {
  it("retains usable auth on restore 429 without logout or broadcasts", async () => {
    signIn();
    rejectRefresh(429);
    await store.getState().restoreSession();
    expect(store.getState()).toMatchObject({
      status: "unverified", user: auth.user, accessTokenExpiresAt: auth.accessTokenExpiresAt,
      isInitializing: false,
    });
    expect(tokens.getAccessToken()).toBe(auth.accessToken);
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("cold start 429 never authenticates an unverified user", async () => {
    rejectRefresh(429);
    await store.getState().restoreSession();
    expect(store.getState()).toMatchObject({ status: "unverified", user: null, isInitializing: false });
    expect(tokens.getAccessToken()).toBeNull();
  });

  it("restores a valid session on an explicit attempt after 429", async () => {
    signIn();
    rejectRefresh(429);
    await store.getState().restoreSession();
    adapter.mockImplementation((config: InternalAxiosRequestConfig) => Promise.resolve(response(config)));
    await store.getState().restoreSession();
    expect(store.getState()).toMatchObject({ status: "authenticated", user: auth.user, isInitializing: false });
    expect(tokens.getAccessToken()).toBe(auth.accessToken);
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it.each([400, 404, 408, 422, 429, 500, 503])("restore %i is not evidence of session revocation", async (status) => {
    signIn();
    rejectRefresh(status);
    await store.getState().restoreSession();
    expect(store.getState().status).toBe("unverified");
    expect(tokens.getAccessToken()).toBe(auth.accessToken);
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalled();
  });

  it("network failure during restore retains auth without staying initializing", async () => {
    signIn();
    adapter.mockRejectedValue(new AxiosError("Network Error"));
    await store.getState().restoreSession();
    expect(store.getState()).toMatchObject({ status: "unverified", isInitializing: false });
    expect(tokens.getAccessToken()).toBe(auth.accessToken);
  });

  it.each([[401, "SESSION_EXPIRED"], [401, "ACCOUNT_DELETED"], [403, "USER_SUSPENDED"], [401, "REFRESH_TOKEN_REUSED"]])(
    "restore %i/%s still clears invalid credentials", async (status, code) => {
      signIn();
      rejectRefresh(status as number, code as string);
      await store.getState().restoreSession();
      expect(store.getState()).toMatchObject({ status: "unauthenticated", user: null, isInitializing: false });
      expect(tokens.getAccessToken()).toBeNull();
    },
  );

  it("interceptor propagates refresh 429 and never replays the protected request", async () => {
    signIn();
    rejectRefresh(429);
    await expect(api.apiClient.get("/protected")).rejects.toMatchObject({ status: 429 });
    expect(store.getState().status).toBe("unverified");
    expect(tokens.getAccessToken()).toBe(auth.accessToken);
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual(["/protected", "/auth/refresh"]);
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalled();
  });

  it("Phase 1A: protected 503 AUTHENTICATION_UNAVAILABLE neither refreshes nor ends the session", async () => {
    signIn();
    adapter.mockImplementation((config: InternalAxiosRequestConfig) =>
      Promise.reject(failure(config, 503, "AUTHENTICATION_UNAVAILABLE")));
    await expect(api.apiClient.get("/protected")).rejects.toMatchObject({ status: 503 });
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual(["/protected"]);
    expect(store.getState().status).toBe("authenticated");
    expect(tokens.getAccessToken()).toBe(auth.accessToken);
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalled();
  });

  it("Phase 1A: a revoked-family 401 whose refresh is also rejected ends the session in every tab", async () => {
    signIn();
    rejectRefresh(401, "SESSION_EXPIRED");
    await expect(api.apiClient.get("/protected")).rejects.toMatchObject({ status: 401 });
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual(["/protected", "/auth/refresh"]);
    expect(store.getState().status).toBe("unauthenticated");
    expect(tokens.getAccessToken()).toBeNull();
    expect(TestBroadcastChannel.instance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "AUTH_LOGGED_OUT" }),
    );
  });

  it("interceptor recovery verifies auth before replaying the failed request", async () => {
    signIn();
    rejectRefresh(429);
    await expect(api.apiClient.get("/protected")).rejects.toMatchObject({ status: 429 });
    const recovered = { ...auth, accessToken: "fixture.eyJzaWQiOiAiMTExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTExIiwgImZpeHR1cmUiOiAicm90YXRlZC1hY2Nlc3MtdG9rZW4ifQ.signature" };
    adapter.mockImplementation((config: InternalAxiosRequestConfig) => {
      if (config.url === "/auth/refresh") return Promise.resolve(response(config, recovered));
      if (!(config as InternalAxiosRequestConfig & { _retry?: boolean })._retry) return Promise.reject(failure(config, 401));
      expect(config.headers.Authorization).toBe(`Bearer ${recovered.accessToken}`);
      return Promise.resolve(response(config, { authorized: true }));
    });
    await expect(api.apiRequest({ url: "/protected" })).resolves.toEqual({ authorized: true });
    expect(store.getState().status).toBe("authenticated");
    expect(tokens.getAccessToken()).toBe(recovered.accessToken);
  });

  it.each([[401, "SESSION_EXPIRED"], [401, "ACCOUNT_DELETED"], [403, "USER_SUSPENDED"]])(
    "terminal interceptor %i/%s clears auth and broadcasts logout", async (status, code) => {
    signIn();
    rejectRefresh(status as number, code as string);
    await expect(api.apiClient.get("/protected")).rejects.toMatchObject({ status: 401 });
    expect(store.getState().status).toBe("unauthenticated");
    expect(tokens.getAccessToken()).toBeNull();
    expect(TestBroadcastChannel.instance.postMessage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: "AUTH_LOGGED_OUT" }),
    );
  });

  it("preserves the bounded reuse retry, and repeated reuse remains terminal", async () => {
    signIn();
    rejectRefresh(401, "REFRESH_TOKEN_REUSED");
    await expect(api.apiClient.get("/protected")).rejects.toMatchObject({ status: 401 });
    expect(adapter.mock.calls.filter(([config]) => config.url === "/auth/refresh")).toHaveLength(2);
    expect(store.getState().status).toBe("unauthenticated");
    expect(TestBroadcastChannel.instance.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "AUTH_LOGGED_OUT" }));
  });

  it("429 on the bounded reuse retry preserves auth and surfaces 429", async () => {
    signIn();
    let refreshCalls = 0;
    adapter.mockImplementation((config: InternalAxiosRequestConfig) => {
      if (config.url !== "/auth/refresh") return Promise.reject(failure(config, 401));
      refreshCalls++;
      return Promise.reject(failure(config, refreshCalls === 1 ? 401 : 429, refreshCalls === 1 ? "REFRESH_TOKEN_REUSED" : undefined));
    });
    await expect(api.apiClient.get("/protected")).rejects.toMatchObject({ status: 429 });
    expect(refreshCalls).toBe(2);
    expect(store.getState().status).toBe("unverified");
    expect(tokens.getAccessToken()).toBe(auth.accessToken);
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalled();
  });

  it("same-tab concurrent refresh requests remain single-flight", async () => {
    const pending = deferred<ReturnType<typeof response>>();
    adapter.mockImplementation(() => pending.promise);
    const first = api.refreshSession();
    const second = api.refreshSession();
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    pending.resolve(response(adapter.mock.calls[0][0]));
    await Promise.all([first, second]);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("uses the existing cross-tab Web Lock for both failure and recovery", async () => {
    const request = vi.fn(async (_name: string, run: () => Promise<unknown>) => run());
    vi.stubGlobal("navigator", { locks: { request } });
    rejectRefresh(429);
    await store.getState().restoreSession();
    adapter.mockImplementation((config: InternalAxiosRequestConfig) => Promise.resolve(response(config)));
    await store.getState().restoreSession();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledWith("bookly-auth-refresh", expect.any(Function));
    expect(store.getState().status).toBe("authenticated");
  });

  it("does not send a refresh queued behind the Web Lock after logout", async () => {
    const gate = deferred<void>();
    vi.stubGlobal("navigator", { locks: {
      request: async (_name: string, run: () => Promise<unknown>) => { await gate.promise; return run(); },
    } });
    const restoring = store.getState().restoreSession();
    TestBroadcastChannel.instance.receive("AUTH_LOGGED_OUT");
    gate.resolve();
    await restoring;
    expect(adapter).not.toHaveBeenCalled();
    expect(store.getState().status).toBe("unauthenticated");
  });

  it("an old refresh finalizer cannot break a new generation's single-flight", async () => {
    const old = deferred<ReturnType<typeof response>>();
    const current = deferred<ReturnType<typeof response>>();
    adapter.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => current.promise);
    const first = api.refreshSession();
    const stale = expect(first).rejects.toBeInstanceOf(api.StaleAuthGenerationError);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    api.invalidateInFlightAuth();
    const second = api.refreshSession();
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
    old.reject(failure(adapter.mock.calls[0][0], 429));
    await stale;
    const third = api.refreshSession();
    current.resolve(response(adapter.mock.calls[1][0]));
    await Promise.all([second, third]);
    expect(adapter).toHaveBeenCalledTimes(2);
  });
});

describe("cross-tab session handling", () => {
  it("remote logout clears local auth without refresh or a broadcast loop", () => {
    signIn();
    TestBroadcastChannel.instance.receive("AUTH_LOGGED_OUT");
    expect(store.getState().status).toBe("unauthenticated");
    expect(tokens.getAccessToken()).toBeNull();
    expect(adapter).not.toHaveBeenCalled();
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalled();
  });

  it("rate-limited explicit logout signs out locally and in other tabs but never claims server sign-out (Phase 1B)", async () => {
    signIn();
    adapter.mockImplementation((config: InternalAxiosRequestConfig) => Promise.reject(failure(config, 429)));
    await expect(store.getState().logout()).resolves.toBe("unconfirmed");
    expect(store.getState().status).toBe("unauthenticated");
    expect(store.getState().logoutState).toMatchObject({ phase: "unconfirmed", reason: "RATE_LIMITED" });
    expect(window.localStorage.getItem("bookly:logout-pending")).not.toBeNull();
    expect(TestBroadcastChannel.instance.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "AUTH_LOGOUT_PENDING" }));
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "AUTH_LOGGED_OUT" }));
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "AUTH_LOGOUT_CONFIRMED" }));
  });

  it.each(["success", "429", "401"])("in-flight %s cannot undo a remote logout", async (outcome) => {
    signIn();
    const pending = deferred<ReturnType<typeof response>>();
    adapter.mockImplementation(() => pending.promise);
    const restoring = store.getState().restoreSession();
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    TestBroadcastChannel.instance.receive("AUTH_LOGGED_OUT");
    const config = adapter.mock.calls[0][0];
    if (outcome === "success") pending.resolve(response(config));
    else pending.reject(failure(config, Number(outcome)));
    await restoring;
    expect(store.getState()).toMatchObject({ status: "unauthenticated", user: null, isInitializing: false });
    expect(tokens.getAccessToken()).toBeNull();
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalled();
  });

  it("session change followed by 429 blocks the previous account without announcing logout", async () => {
    signIn();
    rejectRefresh(429);
    TestBroadcastChannel.instance.receive("AUTH_SESSION_CHANGED");
    await vi.waitFor(() => expect(store.getState().status).toBe("unverified"));
    expect(store.getState().user).toBeNull();
    expect(tokens.getAccessToken()).toBeNull();
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalled();
  });

  it("an old failed refresh cannot clear a newly restored cross-tab session", async () => {
    signIn();
    const old = deferred<ReturnType<typeof response>>();
    adapter.mockImplementationOnce(() => old.promise);
    const restoring = store.getState().restoreSession();
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    TestBroadcastChannel.instance.receive("AUTH_SESSION_CHANGED");
    await vi.waitFor(() => expect(store.getState().status).toBe("authenticated"));
    old.reject(failure(adapter.mock.calls[0][0], 401, "SESSION_EXPIRED"));
    await restoring;
    expect(store.getState().status).toBe("authenticated");
    expect(tokens.getAccessToken()).toBe(auth.accessToken);
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalled();
  });
});

describe("identity security boundaries", () => {
  const accountB = { ...auth, accessToken: "fixture.eyJzaWQiOiAiMjIyMjIyMjItMjIyMi00MjIyLTgyMjItMjIyMjIyMjIyMjIyIiwgImZpeHR1cmUiOiAidG9rZW4tQiJ9.signature", user: { ...auth.user, id: "user-B" } };

  it("isolates every cache key during A → B → A, preserving only public content", () => {
    signIn();
    const old = queries.queryClient;
    const keys = [["auth", "me"], ["businesses", "profile"], ["arbitrary-private-key"]];
    keys.forEach((key) => old.setQueryData(key, { owner: "A" }));
    old.setQueryData(["content", "publicFaqs", "CUSTOMER"], { published: true });
    old.setQueryData(["content", "faqs", {}], { draft: true });
    store.getState().setAuth(accountB);
    expect(queries.queryClient).not.toBe(old);
    keys.forEach((key) => expect(queries.queryClient.getQueryData(key)).toBeUndefined());
    expect(queries.queryClient.getQueryData(["content", "faqs", {}])).toBeUndefined();
    expect(queries.queryClient.getQueryData(["content", "publicFaqs", "CUSTOMER"])).toEqual({ published: true });
    // An already-scheduled mutation callback owns its retired client.
    old.setQueryData(["auth", "me"], { owner: "A" });
    expect(queries.queryClient.getQueryData(["auth", "me"])).toBeUndefined();
    queries.queryClient.setQueryData(["auth", "me"], { owner: "B" });
    store.getState().setAuth(auth);
    expect(queries.queryClient.getQueryData(["auth", "me"])).toBeUndefined();
  });

  it("keeps cache ownership on same-identity refresh and rotates on role changes", async () => {
    signIn();
    const current = queries.queryClient;
    current.setQueryData(["private"], "mine");
    await store.getState().restoreSession();
    expect(queries.queryClient).toBe(current);
    store.getState().setAuth({ ...auth, user: { ...auth.user, role: "STAFF" } });
    expect(queries.queryClient.getQueryData(["private"])).toBeUndefined();
  });

  it.each(["CUSTOMER", "BUSINESS_OWNER", "STAFF", "SUPERVISOR", "SUPER_ADMIN"] as UserRole[])("isolates arbitrary account data for %s", (role) => {
    store.getState().setAuth({ ...auth, user: { ...auth.user, role } });
    queries.queryClient.setQueryData(["role-private", role], "A");
    store.getState().setAuth({ ...accountB, user: { ...accountB.user, role } });
    expect(queries.queryClient.getQueryData(["role-private", role])).toBeUndefined();
  });

  it("refresh returning B rejects A requests and rotates cache ownership", async () => {
    signIn();
    queries.queryClient.setQueryData(["auth", "me"], { owner: "A" });
    adapter.mockImplementation((config) => config.url === "/auth/refresh" ? Promise.resolve(response(config, accountB)) : Promise.reject(failure(config, 401)));
    await expect(api.apiRequest({ url: "/private" })).rejects.toBeInstanceOf(api.StaleAuthGenerationError);
    expect(store.getState().user).toEqual(accountB.user);
    expect(queries.queryClient.getQueryData(["auth", "me"])).toBeUndefined();
  });

  it("delayed A request 401 cannot start refresh for or log out B", async () => {
    signIn();
    const pending = deferred<ReturnType<typeof response>>();
    adapter.mockImplementationOnce(() => pending.promise);
    const request = api.apiRequest({ url: "/private" });
    const rejected = expect(request).rejects.toBeInstanceOf(api.StaleAuthGenerationError);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    store.getState().setAuth(accountB);
    TestBroadcastChannel.instance.postMessage.mockClear();
    pending.reject(failure(adapter.mock.calls[0][0], 401));
    await rejected;
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(store.getState().user).toEqual(accountB.user);
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalled();
  });

  it("cookie-writing login waits for refresh's Web Lock without recursive acquisition on 401", async () => {
    let queue: Promise<unknown> = Promise.resolve();
    const lock = vi.fn((_name: string, run: () => Promise<unknown>) => {
      const result = queue.then(run);
      queue = result.catch(() => {});
      return result;
    });
    vi.stubGlobal("navigator", { locks: { request: lock } });
    const pending = deferred<ReturnType<typeof response>>();
    adapter.mockImplementationOnce(() => pending.promise);
    const refreshing = api.refreshSession();
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    const { authApi } = await import("@/lib/api/auth");
    const login = authApi.customerLogin({ email: "b@example.com", password: "test-password" });
    expect(adapter).toHaveBeenCalledTimes(1);
    pending.resolve(response(adapter.mock.calls[0][0]));
    await refreshing;
    await login;
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual(["/auth/refresh", "/auth/customer/login"]);
    adapter.mockImplementation((config) => Promise.reject(failure(config, 401)));
    await expect(authApi.customerLogin({ email: "b@example.com", password: "wrong" })).rejects.toMatchObject({ status: 401 });
    expect(lock).toHaveBeenCalledTimes(3);
  });

  it("active observers and copied component state cannot render A's avatar under B", async () => {
    signIn();
    const { useQuery, keepPreviousData } = await import("@tanstack/react-query");
    const { useState } = await import("react");
    const Providers = (await import("@/app/providers")).default;
    queries.queryClient.setQueryData(["auth", "me"], { avatar: "avatar-A" });
    function Viewer() {
      const user = store((state) => state.user);
      const query = useQuery({ queryKey: ["auth", "me"], queryFn: () => new Promise<{ avatar: string }>(() => {}), staleTime: Infinity, placeholderData: keepPreviousData });
      const [copied] = useState(query.data?.avatar);
      return createElement("div", null, `${user?.id}:${query.data?.avatar ?? "loading"}:${copied ?? "empty"}`);
    }
    root = createRoot(container);
    await act(async () => root?.render(createElement(Providers, null, createElement(Viewer))));
    expect(container.textContent).toContain("user-1:avatar-A:avatar-A");
    await act(async () => store.getState().setAuth(accountB));
    expect(container.textContent).toContain("user-B:loading:empty");
    expect(container.textContent).not.toContain("avatar-A");
  });

  it.each(["success", "401", "429"])("local login rejects old restore %s and its callbacks", async (outcome) => {
    signIn();
    const pending = deferred<ReturnType<typeof response>>();
    adapter.mockImplementationOnce(() => pending.promise);
    const restoring = store.getState().restoreSession();
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    store.getState().setAuth(accountB);
    TestBroadcastChannel.instance.postMessage.mockClear();
    if (outcome === "success") pending.resolve(response(adapter.mock.calls[0][0]));
    else pending.reject(failure(adapter.mock.calls[0][0], Number(outcome)));
    await restoring;
    expect(store.getState()).toMatchObject({ user: accountB.user, status: "authenticated", isInitializing: false });
    expect(tokens.getAccessToken()).toBe(accountB.accessToken);
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalled();
  });

  it.each(["success", "401"])("local login rejects old interceptor refresh %s without logout broadcast", async (outcome) => {
    signIn();
    const pending = deferred<ReturnType<typeof response>>();
    adapter.mockImplementation((config) => config.url === "/auth/refresh" ? pending.promise : Promise.reject(failure(config, 401)));
    const request = api.apiClient.get("/private");
    const rejected = expect(request).rejects.toBeInstanceOf(api.StaleAuthGenerationError);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
    store.getState().setAuth(accountB);
    TestBroadcastChannel.instance.postMessage.mockClear();
    if (outcome === "success") pending.resolve(response(adapter.mock.calls[1][0]));
    else pending.reject(failure(adapter.mock.calls[1][0], 401));
    await rejected;
    expect(store.getState().user).toEqual(accountB.user);
    expect(TestBroadcastChannel.instance.postMessage).not.toHaveBeenCalled();
  });

  it("rejects delayed protected responses and cannot refill the new cache", async () => {
    signIn();
    const pending = deferred<ReturnType<typeof response>>();
    adapter.mockImplementationOnce(() => pending.promise);
    const old = queries.queryClient;
    const fetching = old.fetchQuery({ queryKey: ["auth", "me"], queryFn: () => api.apiRequest({ url: "/auth/me" }) });
    const rejected = expect(fetching).rejects.toThrow();
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    store.getState().setAuth(accountB);
    pending.resolve(response(adapter.mock.calls[0][0], { avatar: "A" }));
    await rejected;
    expect(queries.queryClient.getQueryData(["auth", "me"])).toBeUndefined();
  });

  it("clears remote caches immediately even when verification is rate limited", async () => {
    signIn();
    queries.queryClient.setQueryData(["businesses", "profile"], { owner: "A" });
    rejectRefresh(429);
    TestBroadcastChannel.instance.receive("AUTH_SESSION_CHANGED");
    expect(queries.queryClient.getQueryData(["businesses", "profile"])).toBeUndefined();
    await vi.waitFor(() => expect(store.getState().status).toBe("unverified"));
  });

  it("logout prevents a pending refresh from applying before HTTP logout finishes", async () => {
    signIn();
    const pending = deferred<ReturnType<typeof response>>();
    const loggingOut = deferred<ReturnType<typeof response>>();
    adapter.mockImplementation((config) => config.url === "/auth/refresh" ? pending.promise : loggingOut.promise);
    const restoring = store.getState().restoreSession();
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    const logout = store.getState().logout();
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
    pending.resolve(response(adapter.mock.calls[0][0]));
    await restoring;
    expect(store.getState().status).toBe("unauthenticated");
    loggingOut.resolve(response(adapter.mock.calls[1][0]));
    await logout;
    expect(store.getState().status).toBe("unauthenticated");
  });

  it("old restore failure cannot clear B's newer initialization or refresh promise", async () => {
    signIn();
    const old = deferred<ReturnType<typeof response>>();
    const current = deferred<ReturnType<typeof response>>();
    adapter.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => current.promise);
    const restoringA = store.getState().restoreSession();
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    store.getState().setAuth(accountB);
    const restoringB = store.getState().restoreSession();
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
    old.reject(failure(adapter.mock.calls[0][0], 401));
    await restoringA;
    expect(store.getState()).toMatchObject({ user: accountB.user, isInitializing: true });
    const shared = api.refreshSession();
    current.resolve(response(adapter.mock.calls[1][0], accountB));
    await Promise.all([restoringB, shared]);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(store.getState()).toMatchObject({ user: accountB.user, isInitializing: false, status: "authenticated" });
  });
});

describe("query retry handling", () => {
  it.each([400, 401, 403, 404, 408, 422, 429])("does not retry HTTP %i", async (status) => {
    const queryFn = vi.fn(() => Promise.reject(new api.BooklyApiError({ message: "failed", status })));
    await expect(queries.queryClient.fetchQuery({ queryKey: [status], queryFn, retryDelay: 0 })).rejects.toMatchObject({ status });
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, 500, 502, 503])("retries transient %s once only", async (status) => {
    const queryFn = vi.fn(() => Promise.reject(new api.BooklyApiError({ message: "failed", status })));
    await expect(queries.queryClient.fetchQuery({ queryKey: [status], queryFn, retryDelay: 0 })).rejects.toThrow("failed");
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("refresh 429 does not produce another protected-query/refresh attempt", async () => {
    signIn();
    rejectRefresh(429);
    await expect(queries.queryClient.fetchQuery({
      queryKey: ["protected"], queryFn: () => api.apiRequest({ url: "/protected" }), retryDelay: 0,
    })).rejects.toMatchObject({ status: 429 });
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(store.getState().status).toBe("unverified");
  });

  it("recognizes raw Axios 4xx and keeps mutations non-retrying", () => {
    expect(queries.shouldRetryQuery(0, { response: { status: 429 } })).toBe(false);
    expect(queries.queryClient.getDefaultOptions().mutations?.retry).toBe(false);
  });
});

describe("protected route guards", () => {
  const guards = [
    ["RequireCustomer", "CUSTOMER"], ["RequireBusinessOwner", "BUSINESS_OWNER"],
    ["RequireStaff", "STAFF"], ["RequireSupervisor", "SUPERVISOR"], ["RequireSuperAdmin", "SUPER_ADMIN"],
  ] as const;

  it.each(guards)("%s blocks cold-start 429 without redirect, then recovers", async (name, role) => {
    const Guard = (await import(`../src/components/auth/${name}.tsx`)).default;
    const renderProtected = vi.fn(() => createElement("div", null, "protected-data"));
    rejectRefresh(429);
    root = createRoot(container);
    await act(async () => root!.render(createElement(Guard, null, createElement(renderProtected))));
    await vi.waitFor(() => expect(container.textContent).toContain("Try again"));
    expect(renderProtected).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledTimes(1);
    adapter.mockImplementation((config: InternalAxiosRequestConfig) => Promise.resolve(response(config, {
      ...auth, user: { ...auth.user, role },
    })));
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toContain("protected-data");
    expect(store.getState().status).toBe("authenticated");
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(guards)("%s hides previously authorized children after temporary failure", async (name, role) => {
    const Guard = (await import(`../src/components/auth/${name}.tsx`)).default;
    store.getState().setAuth({ ...auth, user: { ...auth.user, role: role as UserRole } });
    root = createRoot(container);
    await act(async () => root!.render(createElement(Guard, null, "protected-data")));
    expect(container.textContent).toContain("protected-data");
    rejectRefresh(429);
    await act(async () => { await store.getState().restoreSession(); });
    expect(container.textContent).not.toContain("protected-data");
    expect(container.textContent).toContain("Try again");
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(guards)("%s still redirects a genuinely invalid session", async (name) => {
    const Guard = (await import(`../src/components/auth/${name}.tsx`)).default;
    rejectRefresh(401, "SESSION_EXPIRED");
    root = createRoot(container);
    await act(async () => root!.render(createElement(Guard, null, "protected-data")));
    expect(container.textContent).not.toContain("protected-data");
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("a recovered session with the wrong role cannot render protected content", async () => {
    const Guard = (await import("@/components/auth/RequireBusinessOwner")).default;
    root = createRoot(container);
    await act(async () => root!.render(createElement(Guard, null, "protected-data")));
    expect(container.textContent).not.toContain("protected-data");
    expect(replace).toHaveBeenCalled();
  });
});

describe("authentication recovery screens", () => {
  it.each(["google", "facebook", "apple"])("%s callback recovers 429 even after its timeout", async (provider) => {
    const Page = (await import(`../src/app/auth/${provider}/callback/page.tsx`)).default;
    vi.useFakeTimers();
    rejectRefresh(429);
    root = createRoot(container);
    await act(async () => root!.render(createElement(Page)));
    expect(container.textContent).toContain("Try again");
    await act(async () => vi.advanceTimersByTime(10_001));
    expect(container.textContent).not.toContain("Sign-in didn't complete");
    expect(replace).not.toHaveBeenCalled();
    adapter.mockImplementation((config: InternalAxiosRequestConfig) => Promise.resolve(response(config)));
    await act(async () => container.querySelector("button")!.click());
    expect(store.getState().status).toBe("authenticated");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalledWith("/customer");
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it("Super Admin login offers session recovery instead of requesting credentials after 429", async () => {
    const Page = (await import("@/app/super-admin/login/page")).default;
    const { QueryClientProvider } = await import("@tanstack/react-query");
    rejectRefresh(429);
    root = createRoot(container);
    await act(async () => root!.render(createElement(QueryClientProvider, { client: queries.queryClient }, createElement(Page))));
    expect(container.textContent).toContain("Try again");
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    adapter.mockImplementation((config: InternalAxiosRequestConfig) => Promise.resolve(response(config, {
      ...auth, user: { ...auth.user, role: "SUPER_ADMIN" },
    })));
    await act(async () => container.querySelector("button")!.click());
    expect(store.getState().status).toBe("authenticated");
    expect(replace).toHaveBeenCalledWith("/super-admin-dashboard");
  });
});
