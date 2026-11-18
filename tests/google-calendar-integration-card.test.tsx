import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleCalendarStatus } from "@/lib/api/business";

type Request = { method?: string; url: string };
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
vi.mock("next/image", () => ({ default: () => null }));

import GoogleCalendarIntegrationCard from "@/components/dashboard/GoogleCalendarIntegrationCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const bestEffort = { mode: "BEST_EFFORT", available: true, pending: 0, retrying: 0, recoveryRequired: 0, notConnected: 0, truncated: false } as const;
let statuses: Record<string, GoogleCalendarStatus | Error>;
let host: HTMLDivElement, root: Root, client: QueryClient;

beforeEach(() => {
  fx.requests = [];
  statuses = {};
  fx.respond = async (request) => {
    const match = /^\/businesses\/([^/]+)\/integrations\/google-calendar\/status$/.exec(request.url);
    if (match) {
      const value = statuses[match[1] as string];
      if (!value || value instanceof Error) throw value ?? new Error("missing");
      return value;
    }
    if (request.url.endsWith("/google-calendar/connect")) return new Promise(() => {}); // stays pending
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
async function render(businessId = "b1") {
  await act(async () =>
    root.render(<QueryClientProvider client={client}><GoogleCalendarIntegrationCard businessId={businessId} /></QueryClientProvider>),
  );
}
const text = () => host.textContent ?? "";
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
async function click(node: Element | null | undefined) {
  expect(node).toBeTruthy();
  await act(async () => node!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
const statusRequests = () => fx.requests.filter((r) => r.url.endsWith("/status"));

describe("P2.2.9 Google Calendar integration card", () => {
  it("disconnected: says so, offers Connect, and explains best-effort sync truthfully", async () => {
    statuses.b1 = { connected: false, needsReconnection: false, delivery: bestEffort };
    await render();
    expect(text()).toContain("Checking connection…");
    await waitFor(() => expect(host.querySelector('[data-testid="calendar-subtitle"]')?.textContent).toBe("Not connected"));
    expect(button("Connect")).toBeTruthy();
    expect(text()).toContain("not retried automatically");
    expect(text()).not.toContain("in sync");
  });

  it("connected and healthy: account, last confirmed sync time, Disconnect", async () => {
    statuses.b1 = {
      connected: true,
      googleAccountEmail: "owner@gmail.com",
      status: "CONNECTED",
      needsReconnection: false,
      lastSuccessfulSyncAt: "2026-07-15T07:00:00.000Z",
      delivery: bestEffort,
    };
    await render();
    await waitFor(() => expect(text()).toContain("Connected · owner@gmail.com"));
    expect(host.querySelector('[data-testid="calendar-last-success"]')?.textContent).toContain("15 Jul 2026, 10:00");
    expect(host.querySelector('[data-testid="calendar-sync-failed"]')).toBeNull();
    expect(button("Disconnect")).toBeTruthy();
    expect(button("Reconnect")).toBeUndefined();
  });

  it("failed sync is shown as failed, not as connected-and-fine", async () => {
    statuses.b1 = {
      connected: true,
      googleAccountEmail: "owner@gmail.com",
      status: "ERROR",
      needsReconnection: false,
      lastSyncProblem: "SYNC_FAILED",
      lastSyncFailedAt: "2026-01-05T10:00:00.000Z",
      delivery: bestEffort,
    };
    await render();
    await waitFor(() => expect(host.querySelector('[data-testid="calendar-sync-failed"]')?.textContent).toContain("failed"));
    expect(host.querySelector('[data-testid="calendar-subtitle"]')?.textContent).toContain("last sync failed");
  });

  it("reconnection required: explains the pause and offers Reconnect through the OAuth flow (single request)", async () => {
    statuses.b1 = {
      connected: true,
      googleAccountEmail: "owner@gmail.com",
      status: "RECONNECT_REQUIRED",
      needsReconnection: true,
      lastSyncProblem: "RECONNECT_REQUIRED",
      lastSyncFailedAt: "2026-01-05T10:00:00.000Z",
      delivery: bestEffort,
    };
    await render();
    await waitFor(() => expect(host.querySelector('[data-testid="calendar-reconnect"]')?.textContent).toContain("sync is paused"));
    expect(host.querySelector('[data-testid="calendar-subtitle"]')?.textContent).toContain("Reconnection required");
    await click(button("Reconnect"));
    await waitFor(() => expect(button("Redirecting...")?.disabled).toBe(true));
    await click(button("Redirecting..."));
    expect(fx.requests.filter((r) => r.url.endsWith("/connect"))).toEqual([
      { method: "GET", url: "/businesses/b1/integrations/google-calendar/connect" },
    ]);
  });

  it("reliable mode shows the server's pending / retrying / attention counts", async () => {
    statuses.b1 = {
      connected: true,
      googleAccountEmail: "owner@gmail.com",
      status: "CONNECTED",
      needsReconnection: false,
      delivery: { mode: "RELIABLE", available: true, pending: 2, retrying: 1, recoveryRequired: 3, notConnected: 0, truncated: true },
    };
    await render();
    await waitFor(() =>
      expect(host.querySelector('[data-testid="calendar-delivery"]')?.textContent).toBe(
        "Bookings: 2 waiting to sync · 1 retrying · 3 need attention (and more).",
      ),
    );
  });

  it("reliable mode: all-clear and unavailable states", async () => {
    statuses.b1 = { connected: true, googleAccountEmail: "o@g.com", status: "CONNECTED", needsReconnection: false, delivery: { ...bestEffort, mode: "RELIABLE" } };
    await render();
    await waitFor(() => expect(text()).toContain("All bookings are in sync."));
    statuses.b1 = { ...statuses.b1, delivery: { ...bestEffort, mode: "RELIABLE", available: false } } as GoogleCalendarStatus;
    await click(button("Refresh status"));
    await waitFor(() => expect(text()).toContain("temporarily unavailable"));
    expect(text()).not.toContain("All bookings are in sync.");
  });

  it("a failed status load shows an error with Retry — never a fake connected/synced state", async () => {
    statuses.b1 = new Error("Network down");
    await render();
    await waitFor(() => expect(host.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load"));
    expect(text()).not.toMatch(/Connected|in sync|Last successful/);
    expect(button("Connect")).toBeUndefined();
    statuses.b1 = { connected: true, googleAccountEmail: "owner@gmail.com", status: "CONNECTED", needsReconnection: false, delivery: bestEffort };
    await click(button("Retry"));
    await waitFor(() => expect(text()).toContain("Connected · owner@gmail.com"));
    expect(statusRequests()).toHaveLength(2);
  });

  it("Refresh status shows only the confirmed server state", async () => {
    statuses.b1 = {
      connected: true, googleAccountEmail: "owner@gmail.com", status: "RECONNECT_REQUIRED", needsReconnection: true,
      lastSyncProblem: "RECONNECT_REQUIRED", delivery: bestEffort,
    };
    await render();
    await waitFor(() => expect(host.querySelector('[data-testid="calendar-reconnect"]')).toBeTruthy());
    statuses.b1 = { connected: true, googleAccountEmail: "owner@gmail.com", status: "CONNECTED", needsReconnection: false, delivery: bestEffort };
    await click(button("Refresh status"));
    await waitFor(() => expect(host.querySelector('[data-testid="calendar-reconnect"]')).toBeNull());
    expect(text()).toContain("Connected · owner@gmail.com");
  });

  it("each Business reads its own status; another Business never shows the previous one's account", async () => {
    statuses.b1 = { connected: true, googleAccountEmail: "first@gmail.com", status: "CONNECTED", needsReconnection: false, delivery: bestEffort };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    statuses.b2 = { connected: false, needsReconnection: false, delivery: bestEffort };
    const respond = fx.respond!;
    fx.respond = async (request) => {
      if (request.url.includes("/b2/")) await gate;
      return respond(request);
    };
    await render("b1");
    await waitFor(() => expect(text()).toContain("first@gmail.com"));
    await render("b2");
    await settle();
    expect(text()).not.toContain("first@gmail.com");
    expect(text()).toContain("Checking connection…");
    release();
    await waitFor(() => expect(text()).toContain("Not connected"));
    expect(statusRequests().map((r) => r.url)).toEqual([
      "/businesses/b1/integrations/google-calendar/status",
      "/businesses/b2/integrations/google-calendar/status",
    ]);
  });

  it("P2.2.9.1 — tells retry-limit and Google-rejected bookings apart and points to where to act", async () => {
    statuses.b1 = {
      connected: true,
      googleAccountEmail: "owner@gmail.com",
      status: "CONNECTED",
      needsReconnection: false,
      delivery: { mode: "RELIABLE", available: true, pending: 0, retrying: 0, recoveryRequired: 3, retryLimitReached: 2, permanentFailure: 1, notConnected: 0, truncated: false },
    };
    await render();
    await waitFor(() => expect(host.querySelector('[data-testid="calendar-attention"]')).toBeTruthy());
    const attention = host.querySelector('[data-testid="calendar-attention"]')?.textContent ?? "";
    expect(attention).toContain("2 stopped after repeated failures");
    expect(attention).toContain("1 rejected by Google");
    expect(attention).toContain("Open each affected booking");
    expect(text()).not.toContain("All bookings are in sync.");
    expect([...host.querySelectorAll("button")].some((b) => /resend|retry sync/i.test(b.textContent ?? ""))).toBe(false);
  });
});

describe("Google account selection", () => {
  async function renderWithNotice(notice: "account_in_use" | "cancelled") {
    await act(async () =>
      root.render(<QueryClientProvider client={client}><GoogleCalendarIntegrationCard businessId="b1" redirectNotice={notice} /></QueryClientProvider>),
    );
  }

  it("not connected: explains that ANY Gmail or Workspace account may be chosen, independent of the Bookly email", async () => {
    statuses.b1 = { connected: false, needsReconnection: false, delivery: bestEffort };
    await render();
    await waitFor(() => expect(button("Connect")).toBeTruthy());
    expect(host.querySelector('[data-testid="calendar-account-choice"]')?.textContent).toBe(
      "You'll choose which Google account to connect. It can be any Gmail or Google Workspace account you manage; it doesn't have to match your Bookly sign-in email.",
    );
    expect(button("Change account")).toBeUndefined();
  });

  it("connected: Change account starts the same OAuth flow (one request) and Disconnect stays available", async () => {
    statuses.b1 = { connected: true, needsReconnection: false, googleAccountEmail: "owner.personal@gmail.com", delivery: bestEffort } as GoogleCalendarStatus;
    await render();
    await waitFor(() => expect(text()).toContain("Connected · owner.personal@gmail.com"));
    expect(button("Disconnect")).toBeTruthy();
    await click(button("Change account"));
    await waitFor(() => expect(text()).toContain("Redirecting..."));
    expect(fx.requests.filter((r) => r.url.endsWith("/google-calendar/connect"))).toHaveLength(1);
    expect(button("Redirecting...")?.disabled).toBe(true);
  });

  it("reconnection required: offers Reconnect only (no separate Change account)", async () => {
    statuses.b1 = { connected: true, needsReconnection: true, googleAccountEmail: "a@gmail.com", delivery: bestEffort } as GoogleCalendarStatus;
    await render();
    await waitFor(() => expect(button("Reconnect")).toBeTruthy());
    expect(button("Change account")).toBeUndefined();
  });

  it("explains an account already used by another business, and a cancelled choice", async () => {
    statuses.b1 = { connected: false, needsReconnection: false, delivery: bestEffort };
    await renderWithNotice("account_in_use");
    await waitFor(() => expect(host.querySelector('[data-testid="calendar-account-in-use"]')).toBeTruthy());
    expect(text()).toContain("That Google account is already connected to another business on Bookly. Choose a different Google account.");
    expect(text()).not.toContain("Google Calendar connected.");
    await renderWithNotice("cancelled");
    await waitFor(() => expect(text()).toContain("Google Calendar connection was cancelled. No account was connected."));
  });
});
