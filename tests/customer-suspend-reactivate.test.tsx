import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BooklyApiError } from "@/lib/api/client";
import type { CustomerStatus, SuperAdminCustomerDetail } from "@/lib/api/superAdminCustomers";

type Request = { method?: string; url: string; data?: unknown; params?: unknown };
const fx = vi.hoisted(() => ({
  requests: [] as Request[],
  respond: undefined as undefined | ((request: Request) => Promise<unknown>),
}));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<object>()),
  apiRequest: (request: Request) => {
    fx.requests.push(request);
    return fx.respond!(request);
  },
}));

import SuperAdminCustomerDetailView from "@/components/super-admin/customers/SuperAdminCustomerDetail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root, client: QueryClient;
let status: CustomerStatus;
let history: NonNullable<SuperAdminCustomerDetail["statusHistory"]>;
let changeResponse: (request: Request) => Promise<unknown>;

const detail = (): SuperAdminCustomerDetail => ({
  id: "c1",
  email: "dana@example.test",
  status,
  firstName: "Dana",
  lastName: "Klein",
  createdAt: "2026-01-01T00:00:00.000Z",
  businessCount: 1,
  hasSavedCard: false,
  savedCard: null,
  marketingConsent: false,
  bookings: [],
  bookingsTotal: 0,
  bookingPagination: { page: 1, limit: 20, total: 0 },
  statistics: { total: 3, completed: 1, noShows: 0, upcoming: 2 },
  relationships: [],
  relationshipPagination: { page: 1, limit: 20, total: 0 },
  statusHistory: history,
});

beforeEach(() => {
  fx.requests = [];
  status = "ACTIVE";
  history = [];
  changeResponse = async (request) => {
    const suspend = request.url.endsWith("/suspend");
    const from = status;
    status = suspend ? "SUSPENDED" : "ACTIVE";
    const change = {
      action: suspend ? "SUSPEND" : "REACTIVATE",
      fromStatus: from,
      toStatus: status,
      actorUserId: "admin-1",
      changedAt: "2026-11-07T10:00:00.000Z",
      ...((request.data as { reason?: string }).reason ? { reason: (request.data as { reason: string }).reason } : {}),
    } as const;
    history = [change, ...history];
    return { customerId: "c1", status, changed: true, change };
  };
  fx.respond = async (request) => {
    if (request.method === "GET" && request.url === "/super-admin/customers/c1") return detail();
    if (request.method === "POST") return changeResponse(request);
    throw new Error(`Unexpected ${request.method} ${request.url}`);
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
});

async function settle() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); }); }
async function waitFor(check: () => void) {
  for (let i = 0; i < 100; i++) {
    try { check(); return; } catch (error) { if (i === 99) throw error; }
    await settle();
  }
}
async function render() {
  await act(async () =>
    root.render(<QueryClientProvider client={client}><SuperAdminCustomerDetailView customerId="c1" onBack={() => {}} /></QueryClientProvider>),
  );
  await waitFor(() => expect(host.textContent).toContain("Dana Klein"));
}
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
const dialog = () => host.querySelector('[role="alertdialog"]');
const dialogButton = (label: string) => [...(dialog()?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === label);
async function click(node: Element | null | undefined) {
  expect(node).toBeTruthy();
  await act(async () => node!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
async function type(node: HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const posts = () => fx.requests.filter((r) => r.method === "POST");

describe("P2.2.6 Super Admin Customer suspend / reactivate UI", () => {
  it("Suspend needs confirmation that explains bookings and payments are untouched; Cancel sends nothing", async () => {
    await render();
    await click(button("Suspend account"));
    expect(dialog()?.textContent).toContain("Suspend Dana Klein?");
    expect(dialog()?.textContent).toContain("All active sessions will be terminated");
    expect(dialog()?.textContent).toContain("must sign in again after reactivation");
    expect(dialog()?.textContent).toContain("nothing is cancelled or refunded automatically");
    await click(dialogButton("Cancel"));
    expect(dialog()).toBeNull();
    expect(posts()).toHaveLength(0);
  });

  it("confirmed suspension posts once (with the note), shows loading, then the server-refreshed status and history", async () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const original = changeResponse;
    changeResponse = async (request) => { await gate; return original(request); };
    await render();
    await click(button("Suspend account"));
    await type(dialog()!.querySelector("textarea")!, "Chargeback pattern");
    await click(dialogButton("Suspend account"));
    await waitFor(() => expect(dialogButton("Suspending…")?.disabled).toBe(true));
    await click(dialogButton("Suspending…")); // duplicate click while pending
    expect(host.textContent).toContain("Active"); // no optimistic status change
    expect(host.textContent).not.toContain("Account restricted");
    release();
    await waitFor(() => expect(host.textContent).toContain("Customer suspended."));
    await waitFor(() => expect(host.textContent).toContain("Account restricted"));
    expect(posts()).toEqual([
      { method: "POST", url: "/super-admin/customers/c1/suspend", data: { reason: "Chargeback pattern" } },
    ]);
    expect(host.querySelector('[aria-label="Account status history"]')?.textContent).toContain("Chargeback pattern");
    expect(button("Reactivate account")).toBeTruthy();
    expect(invalidate.mock.calls.map((call) => call[0]?.queryKey)).toEqual([["superAdminCustomers"]]);
  });

  it("reactivates a suspended Customer", async () => {
    status = "SUSPENDED";
    await render();
    await click(button("Reactivate account"));
    expect(dialog()?.textContent).toContain("Their bookings and payment records are unchanged");
    await click(dialogButton("Reactivate account"));
    await waitFor(() => expect(host.textContent).toContain("Customer reactivated."));
    await waitFor(() => expect(button("Suspend account")).toBeTruthy());
    expect(posts()[0]).toEqual({ method: "POST", url: "/super-admin/customers/c1/reactivate", data: {} });
  });

  it("a change by another admin (409) explains the conflict and refreshes to the latest status", async () => {
    changeResponse = async () => {
      status = "SUSPENDED"; // another admin already suspended, then something else changed
      throw new BooklyApiError({
        message: "This customer's status was changed by someone else",
        status: 409,
        code: "SUPER_ADMIN_CUSTOMER_STATUS_CONFLICT",
        errors: [{ message: "Refresh and try again.", code: "CURRENT_STATUS_SUSPENDED" }],
      });
    };
    await render();
    await click(button("Suspend account"));
    await click(dialogButton("Suspend account"));
    await waitFor(() =>
      expect(host.querySelector('[data-testid="customer-status-error"]')?.textContent).toContain("changed by another admin"),
    );
    await waitFor(() => expect(button("Reactivate account")).toBeTruthy());
    expect(dialog()).toBeNull();
  });

  it("an already-applied action says so without claiming a change", async () => {
    changeResponse = async () => {
      status = "SUSPENDED";
      return { customerId: "c1", status: "SUSPENDED", changed: false };
    };
    await render();
    await click(button("Suspend account"));
    await click(dialogButton("Suspend account"));
    await waitFor(() => expect(host.textContent).toContain("This customer was already suspended."));
  });

  it("an unconfirmed session termination shows a recoverable error, never success; retry completes", async () => {
    const success = changeResponse;
    changeResponse = async () => { throw new BooklyApiError({ message: "Unconfirmed", status: 503, code: "SUPER_ADMIN_CUSTOMER_STATUS_UNCONFIRMED", errors: [] }); };
    await render();
    await click(button("Suspend account"));
    await click(dialogButton("Suspend account"));
    await waitFor(() => expect(host.textContent).toContain("Retry this action safely"));
    expect(dialog()).toBeTruthy();
    expect(host.querySelector('[data-testid="customer-status-notice"]')).toBeNull();
    expect(host.textContent).not.toContain("Customer suspended.");
    changeResponse = success;
    await click(dialogButton("Suspend account"));
    await waitFor(() => expect(host.textContent).toContain("Customer suspended."));
  });

  it("a closed (DELETED) account offers no status action", async () => {
    status = "DELETED";
    await render();
    expect(button("Suspend account")).toBeUndefined();
    expect(button("Reactivate account")).toBeUndefined();
  });
});

describe("P2.2.6 a suspended Customer's session ends with an explanation", () => {
  type Api = typeof import("@/lib/api/client");
  let api: Api;
  let tokens: typeof import("@/lib/auth/token-memory");
  let restricted: ReturnType<typeof vi.fn>, expired: ReturnType<typeof vi.fn>;
  let calls: string[];

  const fail = (config: InternalAxiosRequestConfig, status: number, code: string) =>
    new AxiosError("Request failed", undefined, config, undefined, {
      status, statusText: "Failed", config, headers: {}, data: { success: false, message: code, errors: [{ code, message: code }] },
    });

  async function boot(routes: Record<string, [number, string]>) {
    vi.resetModules();
    const actual = await vi.importActual<Api>("@/lib/api/client");
    api = actual;
    tokens = await import("@/lib/auth/token-memory");
    calls = [];
    restricted = vi.fn();
    expired = vi.fn();
    api.setOnAccountRestricted(restricted as () => void);
    api.setOnSessionExpired(expired as () => void);
    api.apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      calls.push(`${(config.method ?? "get").toUpperCase()} ${config.url}`);
      const [statusCode, code] = routes[config.url ?? ""] ?? [500, "UNEXPECTED"];
      throw fail(config, statusCode, code);
    }) as AxiosAdapter;
    tokens.setAccessToken("header.eyJzaWQiOiJmIn0.sig");
  }

  it("a 403 USER_SUSPENDED on a signed-in request clears the session and shows the restriction", async () => {
    await boot({ "/me/bookings": [403, "USER_SUSPENDED"] });
    await expect(api.apiClient.get("/me/bookings")).rejects.toMatchObject({ status: 403, code: "USER_SUSPENDED" });
    expect(restricted).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();
    expect(tokens.getAccessToken()).toBeNull();
    expect(calls).toEqual(["GET /me/bookings"]); // no refresh loop
  });

  it("a refresh refused with USER_SUSPENDED is a restriction, not a generic expiry", async () => {
    await boot({ "/me/bookings": [401, "SESSION_EXPIRED"], "/auth/refresh": [403, "USER_SUSPENDED"] });
    await expect(api.apiClient.get("/me/bookings")).rejects.toBeTruthy();
    expect(restricted).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();
    expect(calls).toEqual(["GET /me/bookings", "POST /auth/refresh"]);
  });

  it("an ordinary refresh failure is still a plain session expiry", async () => {
    await boot({ "/me/bookings": [401, "SESSION_EXPIRED"], "/auth/refresh": [401, "SESSION_EXPIRED"] });
    await expect(api.apiClient.get("/me/bookings")).rejects.toBeTruthy();
    expect(expired).toHaveBeenCalledTimes(1);
    expect(restricted).not.toHaveBeenCalled();
  });

  it("a sign-in attempt keeps its inline message, and other 403s are not treated as restrictions", async () => {
    await boot({ "/auth/customer/login": [403, "USER_SUSPENDED"], "/businesses/x": [403, "PORTAL_MISMATCH"] });
    await expect(api.apiClient.post("/auth/customer/login", {})).rejects.toMatchObject({ code: "USER_SUSPENDED" });
    await expect(api.apiClient.get("/businesses/x")).rejects.toMatchObject({ code: "PORTAL_MISMATCH" });
    expect(restricted).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
  });
});
