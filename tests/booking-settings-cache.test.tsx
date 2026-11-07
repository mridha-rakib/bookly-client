import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { bookingSettingsApi } from "@/lib/api/bookingSettings";
import { bookingSettingsKeys, useUpdateBookingSettingsMutation } from "@/lib/services/hooks";

vi.mock("@/lib/api/bookingSettings", () => ({ bookingSettingsApi: { updateBookingSettings: vi.fn() } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("uses the saved setting and invalidates affected slot caches without touching another Business", async () => {
  vi.mocked(bookingSettingsApi.updateBookingSettings).mockResolvedValue({ businessId: "business", gapEliminationEnabled: true });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const changed = [["availability", "business", "service"], ["catalog", "availability", "business", "service"],
    ["bookingRescheduleAvailability", "business", "business", "booking"], ["bookingRescheduleAvailability", "customer", "business", "booking"]];
  const untouched = [["availability", "other", "service"], ["catalog", "availability", "other", "service"],
    ["bookingRescheduleAvailability", "customer", "other", "booking"]];
  for (const key of [...changed, ...untouched]) cache.setQueryData(key, { days: [] });
  let save: (() => Promise<unknown>) | undefined;
  function Control() {
    const mutation = useUpdateBookingSettingsMutation();
    save = () => mutation.mutateAsync({ businessId: "business", gapEliminationEnabled: true });
    return null;
  }
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<QueryClientProvider client={cache}><Control /></QueryClientProvider>));
    await act(async () => { await save!(); });
    expect(bookingSettingsApi.updateBookingSettings).toHaveBeenCalledWith("business", true);
    expect(cache.getQueryData(bookingSettingsKeys.detail("business"))).toEqual({ businessId: "business", gapEliminationEnabled: true });
    for (const key of changed) expect(cache.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of untouched) expect(cache.getQueryState(key)?.isInvalidated).toBe(false);
  } finally {
    await act(async () => root.unmount()); cache.clear();
  }
});
