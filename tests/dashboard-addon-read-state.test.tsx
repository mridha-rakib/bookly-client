import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddonsListPage from "@/components/dashboard/addons/AddonsListPage";

const fx = vi.hoisted(() => ({ profile: { data: { primary: { id: "business" } }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }, addons: { data: undefined as unknown, isLoading: false, isError: true, isFetching: false, error: new Error("Offline"), refetch: vi.fn() }, archive: vi.fn() }));
vi.mock("@/lib/business/hooks", () => ({ useMyBusinessProfileQuery: () => fx.profile }));
vi.mock("@/lib/addons/hooks", () => ({ useAddonsQuery: () => fx.addons, useArchiveAddonMutation: () => ({ mutate: fx.archive }), useUpdateAddonStatusMutation: () => ({}) }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/dashboard/addons/AddonForm", () => ({ default: () => null }));
vi.mock("@/components/dashboard/addons/AddonCard", () => ({ default: ({ addon, onDeleteClick }: { addon: unknown; onDeleteClick: (addon: unknown) => void }) => <button onClick={() => onDeleteClick(addon)}>Loaded add-on</button> }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));

describe("business add-on read state", () => {
  let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
  const render = () => act(() => root.render(<AddonsListPage />));
  beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); Object.assign(fx.profile, { isError: false, isLoading: false, isFetching: false }); Object.assign(fx.addons, { data: undefined, isError: true, isLoading: false, isFetching: false }); vi.clearAllMocks(); host = document.createElement("div"); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); vi.unstubAllGlobals(); });
  it("does not present a failed read as an empty catalogue and retries safely", () => {
    render(); expect(host.textContent).toContain("Add-ons could not be loaded"); expect(host.textContent).not.toContain("No add-ons yet"); expect(host.textContent).toContain("— Active");
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Retry add-ons")!.click()); expect(fx.addons.refetch).toHaveBeenCalledOnce();
    fx.addons.isFetching = true; render(); expect([...host.querySelectorAll("button")].find(button => button.textContent === "Retrying…")?.disabled).toBe(true);
    Object.assign(fx.addons, { isError: false, isFetching: false, data: { addons: [{ id: "addon" }], counts: { active: 1, draft: 0 } } }); render(); expect(host.textContent).toContain("Loaded add-on");
  });
  it("retries the profile when business context fails", () => {
    fx.profile.isError = true; render(); act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Retry add-ons")!.click()); expect(fx.profile.refetch).toHaveBeenCalledOnce(); expect(fx.addons.refetch).not.toHaveBeenCalled();
  });
  it("asks for confirmation before archiving an add-on", () => {
    Object.assign(fx.addons, { isError: false, data: { addons: [{ id: "addon", name: "Extra" }], counts: { active: 1, draft: 0 } } });
    render();
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Loaded add-on")!.click());
    expect(host.textContent).toContain("Archive Extra?"); expect(fx.archive).not.toHaveBeenCalled();
    const confirm = [...host.querySelectorAll("button")].find(button => button.textContent === "Archive")!;
    act(() => { confirm.click(); confirm.click(); });
    expect(fx.archive).toHaveBeenCalledOnce();
    expect(fx.archive).toHaveBeenCalledWith({ businessId: "business", addonId: "addon" }, expect.any(Object));
  });
});
