import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OwnedFirstClassPackages, ManagementPackageSettlement } from "@/components/packages/FirstClassPackageIntegration";
import { useAuthStore } from "@/lib/auth/store";
import type { AuthUser } from "@/lib/api/auth";
import { BooklyApiError } from "@/lib/api/client";
import { owned } from "./visual/package-view-fixtures";
const fx = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), apiRequest: fx.request }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement, client: QueryClient;
const user = (id: string, role = "CUSTOMER") => ({ id, role } as AuthUser);
beforeEach(() => {
  fx.request.mockReset(); client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  useAuthStore.setState({ status: "authenticated", user: user("customer-a"), cacheEpoch: 1 });
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); useAuthStore.setState({ status: "unauthenticated", user: null }); });
async function render(element: React.ReactNode) { await act(async () => { root.render(<QueryClientProvider client={client}>{element}</QueryClientProvider>); await new Promise((r) => setTimeout(r, 30)); }); await act(async () => { await new Promise((r) => setTimeout(r, 30)); }); }
it("C09: backend empty list is honest and one request is deduplicated across rerenders", async () => {
  fx.request.mockResolvedValue({ packages: [], hasMore: false });
  await render(<OwnedFirstClassPackages />);
  expect(host.textContent).toContain("no purchased first-class");
  await render(<OwnedFirstClassPackages />); expect(fx.request).toHaveBeenCalledTimes(1);
});
it.each([429, 503])("C21/C23: %s is displayed once with no automatic retry or polling", async (status) => {
  fx.request.mockRejectedValue(new BooklyApiError({ message: "private", status }));
  await render(<OwnedFirstClassPackages />);
  expect(host.querySelector('[role="alert"]')).not.toBeNull(); expect(fx.request).toHaveBeenCalledTimes(1);
});
it("C22: Customer switch does not render previous account's cached package", async () => {
  fx.request.mockResolvedValueOnce({ packages: [owned], hasMore: false }).mockResolvedValue({ packages: [], hasMore: false });
  await render(<OwnedFirstClassPackages />); expect(host.textContent).toContain(owned.name);
  await act(async () => useAuthStore.setState({ user: user("customer-b"), cacheEpoch: 2 }));
  expect(host.textContent).not.toContain(owned.name);
  await render(<OwnedFirstClassPackages />); expect(host.textContent).toContain("no purchased first-class");
  expect(fx.request).toHaveBeenCalledTimes(2);
});
it("C20: Staff settlement never dispatches a financial read", async () => {
  useAuthStore.setState({ user: user("staff", "STAFF") });
  await render(<ManagementPackageSettlement businessId="business" bookingId="booking" />);
  expect(host.textContent).toContain("restricted"); expect(fx.request).not.toHaveBeenCalled();
});
