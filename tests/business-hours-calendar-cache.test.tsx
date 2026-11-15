import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { useUpdateBusinessHoursMutation } from "@/lib/business/hours-hooks";

vi.mock("@/lib/api/business-hours", () => ({ businessHoursApi: { put: vi.fn().mockResolvedValue({ businessId: "business", days: [] }) } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("refreshes calendar and single/composite availability after Business hours change", async () => {
  const client = new QueryClient();
  const changed = [["bookings", "calendar", "business", "range"], ["availability", "business", "service"],
    ["availability", "composite", "business", "business", {}], ["availability", "composite", "customer", "business", {}], ["catalog", "availability", "business", "service"]];
  const untouched = [["availability", "composite", "customer", "other", {}], ["bookings", "calendar", "other", "range"]];
  for (const key of [...changed, ...untouched]) client.setQueryData(key, {});
  let save: () => Promise<unknown>;
  function Control() { const mutation = useUpdateBusinessHoursMutation(); save = () => mutation.mutateAsync({ businessId: "business", days: [] }); return null; }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Control /></QueryClientProvider>));
    await act(async () => { await save(); });
    expect(client.getQueryData(["businessHours", "business"])).toEqual({ businessId: "business", days: [] });
    for (const key of changed) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of untouched) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  } finally { await act(async () => root.unmount()); client.clear(); }
});
