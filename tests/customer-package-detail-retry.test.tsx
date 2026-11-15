import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PackageDetailPage from "@/app/customer/packages/[packageProgressId]/page";
import { BooklyApiError } from "@/lib/api/client";

const fx = vi.hoisted(() => ({ query: { data: undefined as unknown, error: undefined as unknown, isLoading: true, isError: false, isFetching: false, refetch: vi.fn() } }));
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
vi.mock("@/lib/packages/hooks", () => ({ usePackageDetailQuery: () => fx.query, useVoidPackageMutation: () => ({ isPending: false }) }));
vi.mock("@/lib/auth/store", () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ logout: vi.fn() }) }));

describe("customer package detail read recovery", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const render = () => act(() => root.render(<PackageDetailPage />));
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    Object.assign(fx.query, { data: undefined, error: undefined, isLoading: true, isError: false, isFetching: false });
    fx.query.refetch.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  it("loads, retries a transient failure once and displays recovered details", () => {
    render(); expect(host.textContent).not.toContain("Package unavailable");
    Object.assign(fx.query, { isLoading: false, isError: true, error: new Error("offline") }); render();
    expect(host.textContent).toContain("Package details could not be loaded");
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Retry")!.click());
    expect(fx.query.refetch).toHaveBeenCalledOnce();
    fx.query.isFetching = true; render(); expect(host.querySelector("button")?.disabled).toBe(true);
    Object.assign(fx.query, { isError: false, isFetching: false, data: { id: "package", businessId: "business", serviceId: "service", status: "ACTIVE", totalSessions: 3, remainingSessions: 2, completedSessions: 0, availableSessions: 2, balanceSettled: true, outstandingBalanceCents: 0, sessions: [], purchaseSnapshot: { name: "Recovery test package", packageServicesName: "Service", bundlePriceCents: 3000, durationMin: 60, sessionsInPackage: 3 } } });
    render(); expect(host.textContent).toContain("Recovery test package");
  });
  it("distinguishes an authoritative 404 from a transient failure", () => {
    Object.assign(fx.query, { isLoading: false, isError: true, error: new BooklyApiError({ message: "Not found", status: 404 }) }); render();
    expect(host.textContent).toContain("could not be found or is not available to your account");
    expect([...host.querySelectorAll("button")].some(button => button.textContent === "Retry")).toBe(false);
  });
});
