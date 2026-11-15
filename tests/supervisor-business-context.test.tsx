import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { useManagedBusinessContext } from "@/lib/business/hooks";

const fx = vi.hoisted(() => ({ role: "SUPERVISOR", request: vi.fn() }));
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: () => ({ data: { user: { role: fx.role }, business: { id: "supervised" } }, isLoading: false }) }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<object>(), apiRequest: fx.request }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
function Probe() { const context = useManagedBusinessContext(); return <div>{context.businessId}</div>; }

it("uses Supervisor membership without requesting the owner-only business profile", async () => {
  fx.role = "SUPERVISOR"; fx.request.mockReset();
  const host = document.createElement("div"), root = createRoot(host), client = new QueryClient();
  try {
    await act(async () => { root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>); });
    expect(host.textContent).toBe("supervised");
    expect(fx.request).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); client.clear(); }
});

it("still requests the owner's business profile for an Owner", async () => {
  fx.role = "BUSINESS_OWNER"; fx.request.mockReset(); fx.request.mockResolvedValue({ primary: { id: "owned" } });
  const host = document.createElement("div"), root = createRoot(host), client = new QueryClient();
  try {
    await act(async () => { root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>); });
    expect(fx.request).toHaveBeenCalledWith(expect.objectContaining({ url: "/businesses/my-profile" }));
  } finally { await act(async () => root.unmount()); client.clear(); }
});
