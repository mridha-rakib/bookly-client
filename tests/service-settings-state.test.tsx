import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ServicesListPage from "@/components/dashboard/services/ServicesListPage";

const fx = vi.hoisted(() => ({ settings: { isSuccess: true, isPending: false, isFetching: false, isError: false,
  data: { gapEliminationEnabled: true }, refetch: vi.fn() },
  services: { isLoading: false, isError: false, data: { services: [] }, refetch: vi.fn() }, save: vi.fn() }));
vi.mock("@/lib/business/hooks", () => ({ useMyBusinessProfileQuery: () => ({ data: { primary: { id: "business" } } }), useBusinessTravelSettingsQuery: () => ({}) }));
vi.mock("@/lib/business/cancellation-policy-hooks", () => ({ useCancellationPolicyQuery: () => ({}) }));
vi.mock("@/lib/addons/hooks", () => ({ useAddonsQuery: () => ({}) }));
vi.mock("@/lib/services/hooks", () => ({ useBookingSettingsQuery: () => fx.settings, useServicesQuery: () => fx.services,
  useUpdateBookingSettingsMutation: () => ({ mutate: fx.save, isPending: false }),
  useArchiveServiceMutation: () => ({}), useUpdateServiceStatusMutation: () => ({}) }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/dashboard/services/ServiceForm", () => ({ default: () => null }));
vi.mock("@/components/dashboard/services/ServiceCard", () => ({ default: () => null }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: vi.fn() } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  host = document.createElement("div"); root = createRoot(host);
  Object.assign(fx.settings, { isSuccess: true, isPending: false, isFetching: false, isError: false, data: { gapEliminationEnabled: true } });
  fx.services.isError = false; vi.clearAllMocks();
});
afterEach(async () => { await act(async () => root.unmount()); });
async function render() { await act(async () => root.render(<ServicesListPage />)); }

it.each(["loading", "failed", "refreshing"])("does not overwrite settings while %s", async (state) => {
  if (state === "loading") Object.assign(fx.settings, { isSuccess: false, isPending: true });
  if (state === "failed") Object.assign(fx.settings, { isSuccess: false, isError: true });
  if (state === "refreshing") fx.settings.isFetching = true;
  await render();
  const toggle = host.querySelector<HTMLButtonElement>('[role="switch"]')!;
  expect(toggle.disabled).toBe(true);
  await act(async () => toggle.click());
  expect(fx.save).not.toHaveBeenCalled();
  if (state === "failed") {
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Retry booking settings")!.click());
    expect(fx.settings.refetch).toHaveBeenCalledOnce();
  }
});
it("toggles the actual loaded value", async () => {
  await render();
  const toggle = host.querySelector<HTMLButtonElement>('[role="switch"]')!;
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  await act(async () => toggle.click());
  expect(fx.save).toHaveBeenCalledWith({ businessId: "business", gapEliminationEnabled: false }, expect.any(Object));
});
it("a failed service read shows retry instead of claiming there are no services", async () => {
  fx.services.isError = true;
  await render();
  expect(host.textContent).toContain("Services could not be loaded");
  expect(host.textContent).not.toContain("No services yet");
  await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Retry services")!.click());
  expect(fx.services.refetch).toHaveBeenCalledOnce();
});
