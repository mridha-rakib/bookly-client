import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServiceForm from "@/components/dashboard/services/ServiceForm";
import AddonForm from "@/components/dashboard/addons/AddonForm";

const fx = vi.hoisted(() => ({ service: { data: undefined as unknown, isError: false, isFetching: false, refetch: vi.fn() }, addon: { data: undefined as unknown, isError: false, isFetching: false, refetch: vi.fn() }, staff: { data: undefined as unknown, isError: false, isLoading: false, isFetching: false, refetch: vi.fn() }, services: { data: { services: [] as { id: string; name: string }[] }, isError: false, isLoading: false, isFetching: false, refetch: vi.fn() }, save: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/dashboard/services/ServiceScheduleEditor", () => ({ default: () => null, buildEmptyManualSchedule: () => Object.fromEntries(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map(day => [day, { isOpen: false, slots: [] }])) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/business/hooks", () => ({ useBusinessQuery: () => ({ data: { visitType: "AT_BUSINESS_LOCATION" } }), useBusinessTravelSettingsQuery: () => ({}) }));
vi.mock("@/lib/staff/hooks", () => ({ useStaffListQuery: () => fx.staff }));
vi.mock("@/lib/services/hooks", () => ({ useServiceQuery: () => fx.service, useServiceCategoriesQuery: () => ({ data: [] }), useServicesQuery: () => fx.services, useCreateServiceMutation: () => ({ mutateAsync: fx.save }), useUpdateServiceMutation: () => ({ mutateAsync: fx.save }) }));
vi.mock("@/lib/addons/hooks", () => ({ useAddonQuery: () => fx.addon, useAddonsForServiceQuery: () => ({}), useCreateAddonMutation: () => ({ mutateAsync: fx.save }), useUpdateAddonMutation: () => ({ mutateAsync: fx.save }) }));

describe("business edit detail guards", () => {
  let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
  beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); Object.assign(fx.service, { data: undefined, isError: false, isFetching: false }); Object.assign(fx.addon, { data: undefined, isError: false, isFetching: false }); Object.assign(fx.staff, { data: { members: [] }, isError: false, isLoading: false, isFetching: false }); Object.assign(fx.services, { data: { services: [] }, isError: false, isLoading: false, isFetching: false }); vi.clearAllMocks(); host = document.createElement("div"); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); vi.unstubAllGlobals(); });
  it.each(["service", "addon"] as const)("gates %s editing until its detail has loaded and offers retry", (kind) => {
    const query = kind === "service" ? fx.service : fx.addon;
    const render = () => act(() => root.render(kind === "service" ? <ServiceForm businessId="business" serviceId="item" mode="edit" onDone={() => {}} /> : <AddonForm businessId="business" addonId="item" mode="edit" onDone={() => {}} />));
    render(); expect(host.textContent).toContain("Loading"); expect(host.querySelector("input")).toBeNull();
    query.isError = true; render(); expect(host.textContent).toContain("details could not be loaded"); expect(host.querySelector("input")).toBeNull();
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Retry")!.click()); expect(query.refetch).toHaveBeenCalledOnce();
    query.isFetching = true; render(); expect([...host.querySelectorAll("button")].find(button => button.textContent === "Retrying…")?.disabled).toBe(true);
    expect(fx.save).not.toHaveBeenCalled();
    Object.assign(query, { isError: false, isFetching: false, data: kind === "service" ? { id: "item", updatedAt: "1", status: "ACTIVE", name: "Actual service", isFeatured: false, isPackageDeal: false, sessionExpiryAlert: { enabled: false }, scheduleMode: "AUTO", manualSchedule: [], servedCities: [], assignedStaff: [] } : { id: "item", updatedAt: "1", status: "ACTIVE", name: "Actual add-on", assignedServices: [] } });
    render();
    expect([...host.querySelectorAll("input")].some(input => input.value === (kind === "service" ? "Actual service" : "Actual add-on"))).toBe(true);
  });
  it("does not mislabel an assigned professional as inactive when the staff read fails", () => {
    fx.service.data = { id: "item", updatedAt: "1", status: "ACTIVE", name: "Actual service", isFeatured: false, isPackageDeal: false, sessionExpiryAlert: { enabled: false }, scheduleMode: "AUTO", manualSchedule: [], servedCities: [], assignedStaff: [{ membershipId: "member", name: "Professional" }] };
    Object.assign(fx.staff, { data: undefined, isError: true });
    act(() => root.render(<ServiceForm businessId="business" serviceId="item" mode="edit" onDone={() => {}} />));
    expect(host.textContent).toContain("Staff could not be loaded");
    expect(host.textContent).not.toContain("Previously assigned staff who are no longer active");
    expect(host.textContent).not.toContain("No active staff yet");
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Retry staff")!.click());
    expect(fx.staff.refetch).toHaveBeenCalledOnce();
  });
  it("reports a failed service read when assigning add-ons and offers retry", () => {
    fx.services.isError = true;
    act(() => root.render(<AddonForm businessId="business" mode="create" onDone={() => {}} />));
    expect(host.textContent).toContain("Services could not be loaded");
    expect(host.textContent).not.toContain("No services yet");
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Retry services")!.click());
    expect(fx.services.refetch).toHaveBeenCalledOnce();
  });
  it.each(["service", "addon"] as const)("submits a %s draft only once during rapid clicks", async (kind) => {
    fx.service.data = { id: "item", updatedAt: "1", status: "DRAFT", name: "Service draft", isFeatured: false, isPackageDeal: false, sessionExpiryAlert: { enabled: false }, scheduleMode: "AUTO", manualSchedule: [], servedCities: [], assignedStaff: [] };
    fx.addon.data = { id: "item", updatedAt: "1", status: "DRAFT", name: "Addon draft", assignedServices: [] };
    fx.save.mockImplementation(() => new Promise(() => {}));
    act(() => root.render(kind === "service" ? <ServiceForm businessId="business" serviceId="item" mode="edit" onDone={() => {}} /> : <AddonForm businessId="business" addonId="item" mode="edit" onDone={() => {}} />));
    const button = [...host.querySelectorAll("button")].find(item => item.textContent === "Save as Draft")!;
    act(() => { button.click(); button.click(); });
    expect(fx.save).toHaveBeenCalledOnce();
    expect(fx.save).toHaveBeenCalledWith(expect.objectContaining({ businessId: "business", input: expect.objectContaining({ status: "DRAFT", name: kind === "service" ? "Service draft" : "Addon draft" }) }));
    if (kind === "service") expect(fx.save.mock.calls[0][0].input).not.toHaveProperty("fixedPricing");
  });
  it("saves only selected active staff membership IDs on a service", () => {
    fx.service.data = { id: "item", updatedAt: "1", status: "DRAFT", name: "Service", isFeatured: false, isPackageDeal: false, sessionExpiryAlert: { enabled: false }, scheduleMode: "AUTO", manualSchedule: [], servedCities: [], assignedStaff: [] };
    fx.staff.data = { members: [{ membershipId: "active", name: "Active person", employmentActive: true }, { membershipId: "inactive", name: "Inactive person", employmentActive: false }] };
    fx.save.mockImplementation(() => new Promise(() => {}));
    act(() => root.render(<ServiceForm businessId="business" serviceId="item" mode="edit" onDone={() => {}} />));
    expect(host.textContent).not.toContain("Inactive person");
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Active person")!.click());
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Save as Draft")!.click());
    expect(fx.save).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ assignedStaffMembershipIds: ["active"] }) }));
  });
  it("saves the selected service association on an add-on", () => {
    fx.addon.data = { id: "item", updatedAt: "1", status: "DRAFT", name: "Addon", assignedServices: [] };
    fx.services.data.services = [{ id: "service", name: "Massage" }];
    fx.save.mockImplementation(() => new Promise(() => {}));
    act(() => root.render(<AddonForm businessId="business" addonId="item" mode="edit" onDone={() => {}} />));
    const label = [...host.querySelectorAll("span")].find(span => span.textContent === "Massage")!;
    act(() => label.parentElement!.parentElement!.click());
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Save as Draft")!.click());
    expect(fx.save).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ assignedServiceIds: ["service"] }) }));
  });
  it("preserves a fractional service discount when saving an edit", () => {
    fx.service.data = { id: "item", updatedAt: "1", status: "DRAFT", name: "Service", isFeatured: false, isPackageDeal: false, sessionExpiryAlert: { enabled: false }, scheduleMode: "AUTO", manualSchedule: [], servedCities: [], assignedStaff: [], pricingMode: "FIXED", fixedPricing: { priceCents: 2000, durationMin: 30, discountPercent: 12.5 } };
    fx.save.mockImplementation(() => new Promise(() => {}));
    act(() => root.render(<ServiceForm businessId="business" serviceId="item" mode="edit" onDone={() => {}} />));
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Save as Draft")!.click());
    expect(fx.save).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ fixedPricing: expect.objectContaining({ discountPercent: 12.5 }) }) }));
  });
});
