import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { servicesApi } from "@/lib/api/services";
import { addonsApi } from "@/lib/api/addons";
import { useUpdateServiceStatusMutation } from "@/lib/services/hooks";
import { useUpdateAddonStatusMutation } from "@/lib/addons/hooks";
import { invalidateBusinessBookingViews, invalidateStaffSchedulingViews } from "@/lib/bookings/dashboard-cache";
import { invalidateBusinessAvailability } from "@/lib/business/availability-hooks";

vi.mock("@/lib/api/services", () => ({ servicesApi: { updateServiceStatus: vi.fn().mockResolvedValue({}) } }));
vi.mock("@/lib/api/addons", () => ({ addonsApi: { updateAddonStatus: vi.fn().mockResolvedValue({}) } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it.each(["service", "addon"] as const)("refreshes %s booking selections and slots only for the changed business", async (kind) => {
  const cache = new QueryClient();
  const changed = [
    ["availability", "business", "service"],
    ["availability", "composite", "business", "business", {}],
    ["availability", "composite", "customer", "business", {}],
    ["catalog", "availability", "business", "service"],
    kind === "service" ? ["bookings", "bookable-services", "business"] : ["bookings", "bookable-addons", "business", "service"],
    kind === "service" ? ["catalog", "business", "business"] : ["catalog", "addons", "business", "service"],
    ...(kind === "service" ? [["staff", "my-services", "business"]] : []),
  ];
  const untouched = [["availability", "composite", "business", "other", {}], ["availability", "other", "service"],
    kind === "service" ? ["bookings", "bookable-services", "other"] : ["bookings", "bookable-addons", "other", "service"]];
  for (const key of [...changed, ...untouched]) cache.setQueryData(key, {});
  let save: () => Promise<unknown>;
  function Control() {
    const service = useUpdateServiceStatusMutation();
    const addon = useUpdateAddonStatusMutation();
    save = () => kind === "service" ? service.mutateAsync({ businessId: "business", serviceId: "service", status: "INACTIVE" }) : addon.mutateAsync({ businessId: "business", addonId: "addon", status: "INACTIVE" });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<QueryClientProvider client={cache}><Control /></QueryClientProvider>));
    await act(async () => { await save(); });
    expect(kind === "service" ? servicesApi.updateServiceStatus : addonsApi.updateAddonStatus).toHaveBeenCalledOnce();
    for (const key of changed) expect(cache.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of untouched) expect(cache.getQueryState(key)?.isInvalidated).toBe(false);
  } finally { await act(async () => root.unmount()); cache.clear(); }
});

it.each([invalidateBusinessBookingViews, invalidateStaffSchedulingViews, invalidateBusinessAvailability])(
  "refreshes composite slots after booking, staff, or business availability changes",
  async (invalidate) => {
    const cache = new QueryClient();
    const own = ["availability", "composite", "customer", "business", {}];
    const other = ["availability", "composite", "business", "other", {}];
    cache.setQueryData(own, {}); cache.setQueryData(other, {});
    await invalidate(cache, "business");
    expect(cache.getQueryState(own)?.isInvalidated).toBe(true);
    expect(cache.getQueryState(other)?.isInvalidated).toBe(false);
    cache.clear();
  },
);

it("refreshes service assignment details after a staff membership changes", async () => {
  const cache = new QueryClient();
  const own = ["services", "detail", "business", "service"];
  const other = ["services", "detail", "other", "service"];
  cache.setQueryData(own, {}); cache.setQueryData(other, {});
  await invalidateStaffSchedulingViews(cache, "business");
  expect(cache.getQueryState(own)?.isInvalidated).toBe(true);
  expect(cache.getQueryState(other)?.isInvalidated).toBe(false);
  cache.clear();
});
