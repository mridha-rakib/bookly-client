import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { ManagementPackageSettlement } from "@/components/packages/FirstClassPackageIntegration";
import { useAuthStore } from "@/lib/auth/store";
import type { AuthUser } from "@/lib/api/auth";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), apiRequest: request }));
vi.mock("next/link", () => ({ default: ({ children }: React.PropsWithChildren) => <>{children}</> }));

it("renders Supervisor operations without financial fields and retains authorized actions", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  useAuthStore.setState({ status: "authenticated", user: { id: "supervisor", role: "SUPERVISOR" } as AuthUser, cacheEpoch: 1 });
  request.mockResolvedValue({ originBookingId: "origin", packageProgressId: "progress", purchaseCompletion: "VERIFIED", actionsAvailable: true,
    session: { bookingId: "booking", itemId: "item", status: "SCHEDULED", restoration: null,
      booking: { status: "UPCOMING", role: "REDEMPTION", startAt: "2030-08-20T07:00:00Z", endAt: "2030-08-20T08:00:00Z", timezone: "UTC", staffId: "staff", occupiedDurationMin: 60 } } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => { root.render(<QueryClientProvider client={client}><ManagementPackageSettlement businessId="business" bookingId="booking" /></QueryClientProvider>); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(host.textContent).toContain("Session status: SCHEDULED");
    expect(host.textContent).not.toContain("Original total");
    expect(host.textContent).not.toContain("Original purchase balance unavailable");
    expect(host.querySelector('[aria-label="Package session action"]')?.textContent).toContain("Cancel appointment");
    expect(host.querySelector('[aria-label="Package session action"]')?.textContent).toContain("Record venue settlement");
  } finally {
    await act(async () => root.unmount()); client.clear();
    useAuthStore.setState({ status: "unauthenticated", user: null }); vi.unstubAllGlobals();
  }
});
