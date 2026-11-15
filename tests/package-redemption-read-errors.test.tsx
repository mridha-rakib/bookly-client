import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RedeemSessionModal from "@/app/customer/packages/RedeemSessionModal";

const fx = vi.hoisted(() => ({
  catalog: { isLoading: false, isError: false, isFetching: false, data: undefined as unknown, refetch: vi.fn() },
  addons: { isLoading: false, isError: false, isFetching: false, data: undefined as unknown, refetch: vi.fn() },
}));
vi.mock("@/lib/catalog/hooks", () => ({ catalogKeys: {}, useBusinessCatalogQuery: () => fx.catalog, useServiceAddonsQuery: () => fx.addons, useServiceAvailabilityQuery: () => ({}) }));
vi.mock("@/lib/packages/hooks", () => ({ usePreviewPackageRedemptionMutation: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("@/components/packages/LegacyPackageRecovery", () => ({ default: () => null }));
vi.mock("@/app/venue/components/AddonsStep", () => ({ default: () => <div>Available add-ons</div> }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));

describe("package redemption read errors", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let client: QueryClient;
  const render = () => act(() => root.render(<QueryClientProvider client={client}><RedeemSessionModal businessId="business" packageProgressId="package" serviceId="service" fulfilmentEntitlement={{ mode: "AT_BUSINESS_LOCATION" }} packageName="Package" nextSessionIndex={1} totalSessions={3} onClose={() => {}} onBooked={() => {}} /></QueryClientProvider>));
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    Object.assign(fx.catalog, { isLoading: false, isError: false, isFetching: false, data: { services: [{ id: "service", assignedStaffMembershipIds: [] }], staff: [], business: { timezone: "UTC" } } });
    Object.assign(fx.addons, { isLoading: false, isError: false, isFetching: false, data: { addons: [] } });
    fx.catalog.refetch.mockReset(); fx.addons.refetch.mockReset();
    client = new QueryClient(); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    HTMLElement.prototype.scrollTo = vi.fn();
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); client.clear(); vi.unstubAllGlobals(); });
  it("distinguishes a failed catalog read from a removed service and retries", () => {
    Object.assign(fx.catalog, { isError: true, data: undefined }); render();
    expect(host.textContent).toContain("The service could not be loaded");
    expect(host.textContent).not.toContain("no longer available");
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Retry")!.click());
    expect(fx.catalog.refetch).toHaveBeenCalledOnce();
  });
  it("blocks continuation on an add-on read failure and resumes after recovery", () => {
    fx.addons.isError = true; render();
    expect(host.textContent).toContain("Add-ons could not be loaded");
    expect([...host.querySelectorAll("button")].find(button => button.textContent?.trim() === "Continue")?.disabled).toBe(true);
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Retry")!.click());
    expect(fx.addons.refetch).toHaveBeenCalledOnce();
    fx.addons.isError = false; render();
    expect(host.textContent).toContain("Available add-ons");
    expect([...host.querySelectorAll("button")].find(button => button.textContent?.trim() === "Continue")?.disabled).toBe(false);
  });
});
