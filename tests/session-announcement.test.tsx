import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { AuthResponse } from "@/lib/api/auth";

// The routine-restore announcement contract (auth-channel.ts / store.ts restoreSession):
// a restore announces AUTH_SESSION_CHANGED unless it restored the refresh family this browser
// profile already announced. The record only decides whether to SEND; receivers are unchanged.

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

const KEY = "bookly-auth-announced-session";
const FAMILY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FAMILY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const token = (payload: Record<string, unknown>) => `fixture.${btoa(JSON.stringify(payload))}.signature`;
const authAs = (userId: string, family: string | null): AuthResponse => ({
  accessToken: token(family ? { sid: family } : { legacy: true }),
  accessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
  user: { id: userId, email: `${userId}@example.com`, role: "CUSTOMER", status: "ACTIVE" },
});

let api: typeof import("@/lib/api/client");
let store: typeof import("@/lib/auth/store").useAuthStore;
let queries: typeof import("@/lib/query-client");
let tokens: typeof import("@/lib/auth/token-memory");
let adapter: Mock<AxiosAdapter>;

const refreshReturns = (auth: AuthResponse | 401) => {
  adapter.mockImplementation((config: InternalAxiosRequestConfig) => {
    if (auth === 401) {
      return Promise.reject(new AxiosError("Unauthorized", undefined, config, undefined, {
        status: 401, statusText: "Unauthorized", config, headers: {},
        data: { success: false, message: "x", errors: [{ code: "SESSION_EXPIRED", message: "x" }] },
      }));
    }
    return Promise.resolve({ status: 200, statusText: "OK", config, headers: {}, data: { success: true, message: "OK", data: auth } });
  });
};
const sessionChangedPosts = () =>
  TestBroadcastChannel.instance.postMessage.mock.calls.filter(([event]) => event.type === "AUTH_SESSION_CHANGED").length;

beforeEach(async () => {
  window.localStorage.clear();
  vi.resetModules();
  vi.stubGlobal("BroadcastChannel", TestBroadcastChannel);
  api = await import("@/lib/api/client");
  store = (await import("@/lib/auth/store")).useAuthStore;
  queries = await import("@/lib/query-client");
  tokens = await import("@/lib/auth/token-memory");
  adapter = vi.fn();
  api.apiClient.defaults.adapter = adapter;
});

describe("sending side", () => {
  it("a fresh profile's first restore announces and records the family", async () => {
    refreshReturns(authAs("u1", FAMILY_A));
    await store.getState().restoreSession();
    expect(sessionChangedPosts()).toBe(1);
    expect(window.localStorage.getItem(KEY)).toBe(FAMILY_A);
  });

  it("a routine restore of the already-announced family does not announce", async () => {
    window.localStorage.setItem(KEY, FAMILY_A);
    refreshReturns(authAs("u1", FAMILY_A));
    await store.getState().restoreSession();
    expect(store.getState()).toMatchObject({ status: "authenticated", user: { id: "u1" } });
    expect(sessionChangedPosts()).toBe(0);
  });

  it.each([
    ["a different account (new family)", "u2"],
    ["the same account signed in again (new family)", "u1"],
  ])("restoring %s announces", async (_label, userId) => {
    window.localStorage.setItem(KEY, FAMILY_A);
    refreshReturns(authAs(userId, FAMILY_B));
    await store.getState().restoreSession();
    expect(sessionChangedPosts()).toBe(1);
    expect(window.localStorage.getItem(KEY)).toBe(FAMILY_B);
  });

  it("an unknown family (token without sid) is announced and never recorded", async () => {
    window.localStorage.setItem(KEY, FAMILY_A);
    refreshReturns(authAs("u1", null));
    await store.getState().restoreSession();
    expect(sessionChangedPosts()).toBe(1);
    expect(window.localStorage.getItem(KEY)).toBe(FAMILY_A);
  });

  it("unreadable shared storage falls back to announcing", async () => {
    window.localStorage.setItem(KEY, FAMILY_A);
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    refreshReturns(authAs("u1", FAMILY_A));
    await store.getState().restoreSession();
    expect(sessionChangedPosts()).toBe(1);
    getItem.mockRestore();
  });

  it("login (setAuth) always announces, even for the already-announced family", () => {
    window.localStorage.setItem(KEY, FAMILY_A);
    store.getState().setAuth(authAs("u1", FAMILY_A));
    expect(sessionChangedPosts()).toBe(1);
  });

  it("a receiver's verification restore (broadcast: false) never announces but records what it verified", async () => {
    refreshReturns(authAs("u1", FAMILY_B));
    await store.getState().restoreSession({ broadcast: false });
    expect(sessionChangedPosts()).toBe(0);
    expect(window.localStorage.getItem(KEY)).toBe(FAMILY_B);
  });

  it("an interceptor-discovered account switch still announces", async () => {
    store.getState().setAuth(authAs("u1", FAMILY_A));
    TestBroadcastChannel.instance.postMessage.mockClear();
    refreshReturns(authAs("u2", FAMILY_B));
    await api.refreshSession();
    expect(store.getState().user?.id).toBe("u2");
    expect(sessionChangedPosts()).toBe(1);
    expect(window.localStorage.getItem(KEY)).toBe(FAMILY_B);
  });
});

describe("receiving side and security boundaries are unchanged", () => {
  it("a notice still retires private caches immediately and re-verifies, even when the family was announced", async () => {
    store.getState().setAuth(authAs("u1", FAMILY_A));
    queries.queryClient.setQueryData(["businesses", "profile"], { owner: "u1" });
    const before = store.getState().cacheEpoch;
    refreshReturns(authAs("u1", FAMILY_A));
    TestBroadcastChannel.instance.receive("AUTH_SESSION_CHANGED");
    expect(queries.queryClient.getQueryData(["businesses", "profile"])).toBeUndefined();
    expect(store.getState()).toMatchObject({ user: null, status: "unknown" });
    expect(store.getState().cacheEpoch).toBe(before + 1);
    await vi.waitFor(() => expect(store.getState().status).toBe("authenticated"));
    expect(adapter.mock.calls.filter(([config]) => config.url === "/auth/refresh")).toHaveLength(1);
  });

  it("the shared record is never an authentication input", async () => {
    window.localStorage.setItem(KEY, FAMILY_A);
    refreshReturns(401);
    await store.getState().restoreSession();
    expect(store.getState()).toMatchObject({ status: "unauthenticated", user: null });
    expect(tokens.getAccessToken()).toBeNull();
    expect(sessionChangedPosts()).toBe(0);
  });

  it("a failed routine restore (terminal 401) announces nothing and signs this tab out", async () => {
    refreshReturns(401);
    await store.getState().restoreSession();
    expect(store.getState().status).toBe("unauthenticated");
    expect(sessionChangedPosts()).toBe(0);
  });
});
