import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { useChangeCustomerStatusMutation } from "@/lib/superAdminCustomers/hooks";

vi.mock("@/lib/api/superAdminCustomers", () => ({
  superAdminCustomersApi: { changeStatus: vi.fn().mockResolvedValue({}) },
}));

it("refreshes customer list and open detail after suspension and reactivation", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const client = new QueryClient();
  const root = createRoot(document.createElement("div"));
  const list = ["superAdminCustomers", "list", {}];
  const detail = ["superAdminCustomers", "detail", "customer", 1, 1];
  let submit: (action: "SUSPEND" | "REACTIVATE") => Promise<unknown> = async () => undefined;
  function Control() {
    const mutation = useChangeCustomerStatusMutation();
    submit = (action) => mutation.mutateAsync({ userId: "customer", action });
    return null;
  }
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Control /></QueryClientProvider>));
    for (const action of ["SUSPEND", "REACTIVATE"] as const) {
      client.setQueryData(list, {});
      client.setQueryData(detail, {});
      await act(async () => { await submit(action); });
      expect(client.getQueryState(list)?.isInvalidated).toBe(true);
      expect(client.getQueryState(detail)?.isInvalidated).toBe(true);
    }
  } finally {
    await act(async () => root.unmount());
    client.clear();
    vi.unstubAllGlobals();
  }
});
