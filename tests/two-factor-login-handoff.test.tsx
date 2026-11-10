import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthResponse } from "@/lib/api/auth";
import { BooklyApiError } from "@/lib/api/client";
import { twoFactorApi } from "@/lib/api/twoFactor";
import { useAuthStore } from "@/lib/auth/store";
import { getAccessToken } from "@/lib/auth/token-memory";
import { authRoutes } from "@/lib/auth/routes";

// P2.2.7.4 — the REAL Providers (which re-key the tree on cacheEpoch), the REAL auth store and the
// REAL TwoFactorChallenge. Only the 2FA HTTP calls, the router and presentational chrome are mocked.
const fx = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  loggedOut: vi.fn(),
}));
vi.mock("next/navigation", () => {
  const router = { replace: fx.replace, push: fx.push, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
  return { useRouter: () => router, usePathname: () => "/professional/two-factor" };
});
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/auth/AuthLayout", () => ({
  default: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
vi.mock("@/components/auth/AuthCard", () => ({
  default: ({ children, title }: React.PropsWithChildren<{ title: string }>) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null, toast: { success: vi.fn() } }));
vi.mock("@/components/auth/LogoutPendingNotice", () => ({ default: () => null }));
vi.mock("@/lib/auth/auth-channel", async (original) => {
  const actual = await original<typeof import("@/lib/auth/auth-channel")>();
  return {
    ...actual,
    postAuthLoggedOut: () => {
      fx.loggedOut();
      actual.postAuthLoggedOut();
    },
  };
});

import Providers from "@/app/providers";
import TwoFactorChallenge from "@/components/auth/TwoFactorChallenge";
import RequireBusinessOwner from "@/components/auth/RequireBusinessOwner";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const jwt = (sid: string) =>
  `h.${btoa(JSON.stringify({ sid })).replace(/=+$/u, "").replace(/\+/gu, "-").replace(/\//gu, "_")}.s`;
const authFor = (role: AuthResponse["user"]["role"], sid = "0b6c6d7e-7f3a-4b1c-9d2e-3f4a5b6c7d8e"): AuthResponse =>
  ({
    accessToken: jwt(sid),
    accessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
    user: { id: `${role.toLowerCase()}-1`, email: `${role.toLowerCase()}@example.test`, role, status: "ACTIVE" },
  }) as AuthResponse;

let host: HTMLDivElement, root: Root;
const initial = useAuthStore.getState();
beforeEach(() => {
  fx.replace.mockReset();
  fx.loggedOut.mockReset();
  // Boot restore is not part of this flow (the 428 already cleared the refresh cookie).
  useAuthStore.setState({ ...initial, restoreSession: vi.fn(async () => undefined), status: "unauthenticated", user: null });
  vi.spyOn(twoFactorApi, "challenge").mockResolvedValue({ expiresAt: "2099-01-01T00:05:00.000Z" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  useAuthStore.setState(initial);
});

const settle = async () => {
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
};
async function mount(node: React.ReactNode) {
  await act(async () => root.render(<Providers>{node}</Providers>));
  await settle();
}
async function enter(code: string) {
  const input = host.querySelector("input") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, code);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  await settle();
}
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);

describe("P2.2.7.4 a verified second factor completes the sign-in", () => {
  it.each([
    ["BUSINESS_OWNER", authRoutes.businessDashboard],
    ["SUPERVISOR", authRoutes.supervisorDashboard],
    ["STAFF", authRoutes.staffDashboard],
  ] as const)("%s: the new session survives the post-login remount and routes to its dashboard", async (role, home) => {
    const auth = authFor(role);
    vi.spyOn(twoFactorApi, "verify").mockResolvedValue(auth);
    await mount(<TwoFactorChallenge />);
    expect(fx.loggedOut).toHaveBeenCalled(); // first factor only: any previous identity is retired
    const broadcastsBefore = fx.loggedOut.mock.calls.length;
    const epochBefore = useAuthStore.getState().cacheEpoch;

    await enter("123456");

    // The tree WAS re-keyed (the identity changed) …
    expect(useAuthStore.getState().cacheEpoch).toBeGreaterThan(epochBefore);
    // … and the remounted challenge page did NOT wipe the session it had just established.
    expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", user: auth.user });
    expect(getAccessToken()).toBe(auth.accessToken);
    expect(fx.loggedOut).toHaveBeenCalledTimes(broadcastsBefore); // no logout broadcast after success
    expect(fx.replace).toHaveBeenCalledWith(home);
    expect(fx.replace).not.toHaveBeenCalledWith(authRoutes.professionalAuth);
  });

  it("the dashboard guard accepts the verified session (no redirect back to sign-in)", async () => {
    vi.spyOn(twoFactorApi, "verify").mockResolvedValue(authFor("BUSINESS_OWNER"));
    await mount(<TwoFactorChallenge />);
    await enter("123456");
    await act(async () =>
      root.render(
        <Providers>
          <RequireBusinessOwner>
            <p>Business dashboard content</p>
          </RequireBusinessOwner>
        </Providers>,
      ),
    );
    await settle();
    expect(host.textContent).toContain("Business dashboard content");
    expect(fx.replace).not.toHaveBeenCalledWith(authRoutes.professionalAuth);
  });

  it("a recovery sign-in that replaces codes also lands authenticated after the codes are saved", async () => {
    const auth = authFor("BUSINESS_OWNER");
    vi.spyOn(twoFactorApi, "verify").mockResolvedValue({ ...auth, recoveryCodes: ["a".repeat(32), "b".repeat(32)] });
    await mount(<TwoFactorChallenge />);
    await act(async () => button("Use a recovery code")!.click());
    await enter("c".repeat(32));
    expect(useAuthStore.getState().status).toBe("unauthenticated"); // not signed in before the codes are acknowledged
    expect(host.textContent).toContain("Save your new recovery codes");
    await act(async () => (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    await act(async () => button("Continue to Bookly")!.click());
    await settle();
    expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", user: auth.user });
    expect(getAccessToken()).toBe(auth.accessToken);
    expect(fx.replace).toHaveBeenCalledWith(authRoutes.businessDashboard);
  });

  it("an invalid, replayed or expired code establishes nothing", async () => {
    vi.spyOn(twoFactorApi, "verify").mockRejectedValue(
      new BooklyApiError({ message: "That code is not valid", status: 400, code: "TWO_FACTOR_INVALID" }),
    );
    await mount(<TwoFactorChallenge />);
    await enter("000000");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("not valid");
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(getAccessToken()).toBeNull();
    expect(fx.replace).not.toHaveBeenCalled();
  });

  it("a later, genuine visit to the challenge page still retires a previous account's session", async () => {
    vi.spyOn(twoFactorApi, "verify").mockResolvedValue(authFor("BUSINESS_OWNER"));
    await mount(<TwoFactorChallenge />);
    await enter("123456");
    expect(useAuthStore.getState().status).toBe("authenticated");
    // Same browser, another first-factor sign-in later (a different session is in memory now).
    useAuthStore.getState().setAuth(authFor("STAFF", "1b6c6d7e-7f3a-4b1c-9d2e-3f4a5b6c7d8f"));
    await act(async () => root.unmount());
    root = createRoot(host);
    fx.loggedOut.mockReset();
    await mount(<TwoFactorChallenge />);
    expect(useAuthStore.getState()).toMatchObject({ status: "unauthenticated", user: null });
    expect(getAccessToken()).toBeNull();
    expect(fx.loggedOut).toHaveBeenCalled();
  });
});
