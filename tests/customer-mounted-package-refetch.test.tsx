import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import PackageDetailPage from "@/app/customer/packages/[packageProgressId]/page";
import { useCancelByCustomerMutation } from "@/lib/bookings/hooks";

const fx = vi.hoisted(() => ({ remaining: 1, fail: false, reads: 0 }));
vi.mock("next/navigation", () => ({ useParams: () => ({ packageProgressId: "package" }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ children }: React.PropsWithChildren) => <a>{children}</a> }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/auth/RequireCustomer", () => ({ default: ({ children }: React.PropsWithChildren) => children }));
vi.mock("@/components/packages/BusinessInfoSidebar", () => ({ default: () => null }));
vi.mock("@/components/packages/LegacyPackageRecovery", () => ({ default: () => null }));
vi.mock("@/components/packages/PackageActionControls", () => ({ default: () => null }));
vi.mock("@/components/packages/PackageAppointmentHistory", () => ({ default: () => null }));
vi.mock("@/components/packages/FirstClassPackageIntegration", () => ({ OwnedFirstClassDetail: () => null }));
vi.mock("@/components/packages/LegacyRedemptionConfirmation", () => ({ LegacyRedemptionConfirmation: () => null }));
vi.mock("@/app/customer/packages/RedeemSessionModal", () => ({ default: () => null }));
vi.mock("@/lib/api/packages", () => ({ packagesApi: { getForCustomer: vi.fn(async () => {
  fx.reads++;
  return { id: "package", businessId: "business", serviceId: "service", status: "ACTIVE", totalSessions: 3, remainingSessions: fx.remaining,
    completedSessions: 0, availableSessions: fx.remaining, balanceSettled: true, outstandingBalanceCents: 0, sessions: [],
    purchaseSnapshot: { name: "Mounted package", packageServicesName: "Service", bundlePriceCents: 3000, durationMin: 60, sessionsInPackage: 3 } };
}) } }));
vi.mock("@/lib/api/bookings", () => ({ bookingsApi: { cancelByCustomer: vi.fn(async () => {
  if (fx.fail) throw Error("cancel failed");
  fx.remaining = 2;
  return { id: "booking", businessId: "business", status: "CANCELLED_BY_CUSTOMER", serviceLines: [{ packageProgressId: "package" }] };
}) } }));

it("refetches the mounted package after a successful linked booking cancellation", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); fx.remaining = 1; fx.fail = false; fx.reads = 0;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const host = document.createElement("div"), root = createRoot(host);
  let cancel = async () => {};
  function Screen() { const m = useCancelByCustomerMutation(); cancel = async () => { await m.mutateAsync({ bookingId: "booking" }); }; return <PackageDetailPage />; }
  const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); }); };
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Screen /></QueryClientProvider>));
    await settle(); expect(host.textContent).toContain("Mounted package"); expect(fx.reads).toBe(1);
    fx.fail = true;
    await act(async () => { await expect(cancel()).rejects.toThrow("cancel failed"); });
    expect(fx.reads).toBe(1); expect(client.getQueryData<{ remainingSessions: number }>(["packages", "detail", "package"])?.remainingSessions).toBe(1);
    fx.fail = false;
    await act(async () => { await cancel(); }); await settle();
    expect(fx.reads).toBe(2);
    expect(client.getQueryData<{ remainingSessions: number }>(["packages", "detail", "package"])?.remainingSessions).toBe(2);
    expect(host.textContent).toMatch(/2\s*\/\s*3|2\s*(remaining|available)|remaining\s*2/i);
  } finally { await act(async () => root.unmount()); client.clear(); vi.unstubAllGlobals(); }
});
