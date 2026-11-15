import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { useApproveBusinessMutation } from "@/lib/superAdminBusiness/hooks";

vi.mock("@/lib/api/superAdminBusiness", () => ({ superAdminBusinessApi: { approve: vi.fn().mockResolvedValue({}) } }));

it("invalidates business, dashboard and analytics reads after approval", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const client = new QueryClient(), root = createRoot(document.createElement("div"));
  const keys = [["superAdminBusiness", "list", {}], ["superAdminDashboard", "summary"], ["superAdminAnalytics", "businesses"]];
  keys.forEach(key => client.setQueryData(key, {}));
  let submit: () => Promise<unknown> = async () => undefined;
  function Control() { const mutation = useApproveBusinessMutation(); submit = () => mutation.mutateAsync("business"); return null; }
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Control /></QueryClientProvider>));
    await act(async () => { await submit(); });
    keys.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
  } finally { await act(async () => root.unmount()); client.clear(); vi.unstubAllGlobals(); }
});
