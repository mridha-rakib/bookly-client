import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { useCreateStaffMutation } from "@/lib/staff/hooks";

vi.mock("@/lib/api/staff", () => ({ staffApi: { createStaff: vi.fn().mockRejectedValue(new Error("delivery failed")) } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("refreshes pending invitations when an invitation request fails", async () => {
  const cache = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const own = ["staff", "list", "business"], other = ["staff", "list", "other"];
  cache.setQueryData(own, {}); cache.setQueryData(other, {});
  let submit: () => Promise<unknown>;
  function Control() {
    const mutation = useCreateStaffMutation();
    submit = () => mutation.mutateAsync({ businessId: "business", input: { name: "Alex", email: "alex@example.com", role: "STAFF" } });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<QueryClientProvider client={cache}><Control /></QueryClientProvider>));
    await act(async () => { await expect(submit()).rejects.toThrow("delivery failed"); });
    expect(cache.getQueryState(own)?.isInvalidated).toBe(true);
    expect(cache.getQueryState(other)?.isInvalidated).toBe(false);
  } finally { await act(async () => root.unmount()); cache.clear(); }
});
