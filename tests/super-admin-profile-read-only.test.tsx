import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerStatus, SuperAdminCustomerDetail } from "@/lib/api/superAdminCustomers";

type Request = { method?: string; url: string; data?: unknown; params?: unknown };
const fx = vi.hoisted(() => ({ requests: [] as Request[], status: "ACTIVE" as CustomerStatus }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<object>()),
  apiRequest: async (request: Request) => {
    fx.requests.push(request);
    if (request.method === "GET" && request.url === "/super-admin/customers/c1") return detail();
    throw new Error(`Unexpected ${request.method} ${request.url}`);
  },
}));

import SuperAdminCustomerDetailView from "@/components/super-admin/customers/SuperAdminCustomerDetail";
import * as customerApi from "@/lib/api/superAdminCustomers";
import * as customerHooks from "@/lib/superAdminCustomers/hooks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function detail(): SuperAdminCustomerDetail {
  return {
    id: "c1",
    email: "dana@example.test",
    status: fx.status,
    firstName: "Dana",
    lastName: "Klein",
    phone: { countryCode: "+357", nationalNumber: "99123456", e164: "+35799123456" },
    createdAt: "2026-01-01T00:00:00.000Z",
    businessCount: 1,
    hasSavedCard: false,
    savedCard: null,
    marketingConsent: false,
    bookings: [],
    bookingsTotal: 0,
    bookingPagination: { page: 1, limit: 20, total: 0 },
    statistics: { total: 0, completed: 0, noShows: 0, upcoming: 0 },
    relationships: [],
    relationshipPagination: { page: 1, limit: 20, total: 0 },
    statusHistory: [],
    profileEditHistory: [
      { action: "PROFILE_UPDATE", fields: ["firstName", "lastName"], actorUserId: "admin-1", changedAt: "2026-11-08T09:00:00.000Z" },
    ],
  };
}

let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => {
  fx.requests = [];
  fx.status = "ACTIVE";
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
});

async function render() {
  await act(async () =>
    root.render(<QueryClientProvider client={client}><SuperAdminCustomerDetailView customerId="c1" onBack={() => {}} /></QueryClientProvider>),
  );
  for (let i = 0; i < 100 && !host.textContent?.includes("Dana Klein"); i++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  }
}
const buttonLabels = () => [...host.querySelectorAll("button")].map((b) => b.textContent?.trim() ?? "");

describe("P2.2.8.2.1 Super Admin Customer profile is read-only", () => {
  it("shows first name, last name, email and phone as plain read-only details", async () => {
    await render();
    const profile = host.querySelector('[aria-label="Customer profile"]');
    expect(profile?.textContent).toContain("Dana Klein");
    expect(profile?.textContent).toContain("dana@example.test");
    expect(profile?.textContent).toContain("+35799123456");
    expect(profile?.querySelectorAll("input, textarea, select, form")).toHaveLength(0);
    expect(buttonLabels().some((label) => /edit/i.test(label))).toBe(false);
    expect(fx.requests.every((request) => request.method === "GET")).toBe(true);
  });

  it("keeps historical profile edits visible, without any edit action", async () => {
    await render();
    const history = host.querySelector('[aria-label="Profile edit history"]');
    expect(history?.textContent).toContain("First name and Last name updated");
    expect(history?.querySelectorAll("button, input, form")).toHaveLength(0);
  });

  it("still offers Suspend / Reactivate (and nothing else that changes the account)", async () => {
    await render();
    expect(buttonLabels()).toContain("Suspend account");
    fx.status = "SUSPENDED";
    await act(async () => root.unmount());
    client.clear();
    root = createRoot(host);
    await render();
    expect(buttonLabels()).toContain("Reactivate account");
    expect(buttonLabels().some((label) => /edit/i.test(label))).toBe(false);
  });

  it("the client exposes no Super Admin profile mutation", () => {
    expect(customerApi.superAdminCustomersApi).not.toHaveProperty("updateProfile");
    expect(Object.keys(customerHooks)).not.toContain("useUpdateCustomerProfileMutation");
    expect(Object.keys(customerHooks).filter((name) => /Mutation$/u.test(name))).toEqual([
      "useChangeCustomerStatusMutation",
    ]);
  });
});
