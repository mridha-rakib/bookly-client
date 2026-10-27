/** F2C Path B: real shared bell/headers; no in-app notification contract is simulated. */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/store";
import NotificationBell from "@/components/notifications/NotificationBell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import SuperAdminHeader from "@/components/super-admin/layout/SuperAdminHeader";

const fx = vi.hoisted(() => ({ apiRequest: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: fx.apiRequest,
}));
// Only the Super Admin's unrelated profile read is stubbed; the header/bell JSX is real.
vi.mock("@/lib/auth/hooks", () => ({
  useCurrentUserQuery: () => ({ data: { profile: { fullName: "Admin Fixture" }, user: { email: "admin@example.com" } } }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const render = async (node: React.ReactNode) => {
  await act(async () => root.render(node));
};
function HeaderWithSession() {
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);
  return <div data-session={status} data-role={role}><DashboardHeader title="Booking history" subtitle="Existing header subtitle" /></div>;
}
function setSession(role: AuthUser["role"] | null, id = "account-a") {
  useAuthStore.setState({
    user: role ? { id, email: `${id}@example.com`, role, status: "ACTIVE" } : null,
    status: role ? "authenticated" : "unauthenticated",
    isInitializing: false,
    cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
  });
}
function expectUnavailable() {
  const bell = host.querySelector<HTMLButtonElement>('button[aria-label="Notifications unavailable"]');
  expect(bell).not.toBeNull();
  expect(bell!.disabled).toBe(true);
  expect(bell!.title).toBe("In-app notifications are unavailable.");
  expect(host.textContent).not.toMatch(/Timur|5h ago|Account Deletion|has report|has Requested|has given a feedback/);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.querySelector('a')).toBeNull(); // no invented or inaccessible record destinations
  expect(bell!.parentElement!.children).toHaveLength(1); // only the bell, no unread badge or dropdown
  expect(fx.apiRequest).not.toHaveBeenCalled();
  expect(fx.fetch).not.toHaveBeenCalled();
  return bell!;
}
beforeEach(() => {
  fx.apiRequest.mockReset(); fx.fetch.mockReset();
  vi.stubGlobal("fetch", fx.fetch);
  setSession(null);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
});

describe("Notification bell — unsupported inbox is unavailable (F2C)", () => {
  it("has no sample events, unread count, dropdown or booking/payment/delivery success claim", async () => {
    await render(<NotificationBell />);
    const bell = expectUnavailable();
    expect(host.textContent?.trim()).toBe("");
    await act(async () => {
      bell.click();
      bell.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      bell.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expectUnavailable();
    expect(host.querySelectorAll("button")).toHaveLength(1);
    expect(host.textContent?.trim()).toBe("");
  });

  it.each(["CUSTOMER", "BUSINESS_OWNER", "SUPERVISOR", "STAFF", "SUPER_ADMIN"] as const)(
    "does not expose records or issue requests for %s, account switch, new session or logout", async (role) => {
      await render(<HeaderWithSession />);
      expectUnavailable();
      await act(async () => setSession(role));
      expect(host.querySelector("[data-role]")?.getAttribute("data-role")).toBe(role);
      expectUnavailable();
      await act(async () => setSession(role, "account-b"));
      expectUnavailable();
      await act(async () => setSession(role, "account-b")); // renewed session, same account
      expectUnavailable();
      await act(async () => setSession(null));
      expect(host.querySelector("[data-session]")?.getAttribute("data-session")).toBe("unauthenticated");
      expectUnavailable();
      expect(host.textContent).toContain("Booking history");
      expect(host.textContent).toContain("Existing header subtitle");
    },
  );

  it.each(["unknown", "unverified"] as const)("does not fetch or invent state while the session is %s", async (status) => {
    useAuthStore.setState({ status, isInitializing: status === "unknown" });
    await render(<HeaderWithSession />);
    expect(host.querySelector("[data-session]")?.getAttribute("data-session")).toBe(status);
    expectUnavailable();
  });

  it("preserves the real Super Admin search, avatar, collapse layout and bell placement", async () => {
    await render(<SuperAdminHeader isCollapsed={false} />);
    const bell = expectUnavailable();
    const header = host.querySelector("header")!;
    const search = host.querySelector<HTMLInputElement>('input[placeholder="Search businesses, customers, bookings..."]')!;
    expect(search).not.toBeNull();
    expect(host.textContent).toContain("AF");
    expect(header.className).toContain("left-[240px]");
    expect(bell.className).toContain("w-9 h-9");
    expect(bell.parentElement?.parentElement?.className).toBe("flex items-center gap-4");
    await act(async () => {
      search.value = "Existing search input";
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await render(<SuperAdminHeader isCollapsed />);
    expect(host.querySelector("input")).toBe(search);
    expect(search.value).toBe("Existing search input");
    expect(header.className).toContain("left-[72px]");
    expect(host.textContent).toContain("AF");
    expectUnavailable();
  });

  it("adds no API requests when multiple headers mount or rerender", async () => {
    const headers = <><DashboardHeader title="One" /><DashboardHeader title="Two" /></>;
    await render(headers);
    await render(<><DashboardHeader title="One updated" /><DashboardHeader title="Two" /></>);
    expect(host.querySelectorAll('button[aria-label="Notifications unavailable"]')).toHaveLength(2);
    expect(host.querySelectorAll("button:not(:disabled)")).toHaveLength(0);
    expect(host.textContent).toContain("One updated");
    expectUnavailable();
  });
});
