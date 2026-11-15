import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { bookingKeys, useCancelByCustomerMutation, useRescheduleByCustomerMutation } from "@/lib/bookings/hooks";
import { packageKeys } from "@/lib/packages/hooks";

const api = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/api/bookings", () => ({ bookingsApi: {
  cancelByCustomer: vi.fn(async () => {
    if (api.fail) throw new Error("failed");
    return { id: "booking", businessId: "business", status: "CANCELLED_BY_CUSTOMER", serviceLines: [{ packageProgressId: "package" }] };
  }),
  rescheduleByCustomer: vi.fn(async () => ({ id: "booking", businessId: "business", status: "UPCOMING", schedule: { startAt: "2030-01-01T00:00:00Z" }, serviceLines: [{ packageProgressId: "package" }] })),
} }));

it("refreshes linked customer booking and package caches only after successful mutations", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const host = document.createElement("div"), root = createRoot(host);
  const list = bookingKeys.customerList({}), detail = bookingKeys.customerDetail("booking");
  const pkgList = packageKeys.list(), pkgDetail = packageKeys.detail("package");
  let cancel = async () => {}, move = async () => {};
  function Control() {
    const c = useCancelByCustomerMutation(), r = useRescheduleByCustomerMutation();
    const view = useQuery<{ status: string; schedule?: { startAt: string } }>({ queryKey: detail, queryFn: async () => ({ status: "UPCOMING" }), enabled: false });
    cancel = async () => { await c.mutateAsync({ bookingId: "booking" }); };
    move = async () => { await r.mutateAsync({ bookingId: "booking", startAt: "2030-01-01T00:00:00Z" }); };
    return <div>{view.data?.status} {view.data?.schedule?.startAt}</div>;
  }
  const seed = () => { for (const key of [list, detail, pkgList, pkgDetail]) client.setQueryData(key, { status: "UPCOMING" }); };
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Control /></QueryClientProvider>));
    seed(); api.fail = true;
    await act(async () => { await expect(cancel()).rejects.toThrow("failed"); });
    expect(client.getQueryData(detail)).toEqual({ status: "UPCOMING" });
    expect(client.getQueryState(pkgDetail)?.isInvalidated).toBe(false);
    api.fail = false;
    await act(async () => { await cancel(); });
    expect(client.getQueryState(list)?.isInvalidated).toBe(true);
    expect(client.getQueryState(pkgList)?.isInvalidated).toBe(true);
    expect(client.getQueryState(pkgDetail)?.isInvalidated).toBe(true);
    expect(client.getQueryData<{ status: string }>(detail)?.status).toBe("CANCELLED_BY_CUSTOMER");
    seed();
    await act(async () => { await move(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(client.getQueryState(list)?.isInvalidated).toBe(true);
    expect(client.getQueryState(pkgDetail)?.isInvalidated).toBe(true);
    expect(client.getQueryData<{ status: string }>(detail)?.status).toBe("UPCOMING");
    expect(host.textContent).toContain("2030-01-01T00:00:00Z");
  } finally { await act(async () => root.unmount()); client.clear(); api.fail = false; vi.unstubAllGlobals(); }
});
