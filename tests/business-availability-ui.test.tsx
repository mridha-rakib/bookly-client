import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import DashboardCreateBusiness from "@/components/dashboard/DashboardCreateBusiness";
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";
import type { BusinessAvailabilityRules, CalendarBlock } from "@/lib/api/business-availability";

const fx = vi.hoisted(() => ({ rules: {} as BusinessAvailabilityRules, blocks: [] as CalendarBlock[], save: vi.fn(), change: vi.fn(), back: vi.fn(), error: vi.fn(), warning: vi.fn(), failed: false }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/dashboard/CalendarBookingCompletion", () => ({ default: () => null }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: fx.error, warning: fx.warning } }));
vi.mock("@/lib/maps/googleGeocoding", () => ({ geocodeAddress: vi.fn(), reverseGeocodeCoordinates: vi.fn() }));
vi.mock("@/components/create-business/BusinessInfoSection", () => ({ default: () => null }));
vi.mock("@/components/create-business/AddressSection", () => ({ default: () => null }));
vi.mock("@/components/create-business/ServiceLocationTypeSection", () => ({ default: () => null }));
vi.mock("@/components/create-business/LocationSection", () => ({ default: () => null }));
vi.mock("@/components/create-business/ServiceCategorySection", () => ({ default: () => null }));
vi.mock("@/components/create-business/PhotosSection", () => ({ default: () => null }));
vi.mock("@/components/create-business/OpeningHoursSection", () => ({ default: () => null }));
vi.mock("@/components/create-business/BookingTimeControlSection", () => ({ default: () => null }));
vi.mock("@/components/create-business/AdditionalInfoSection", () => ({ default: () => null }));
vi.mock("@/components/create-business/TravelFeesSection", () => ({ default: () => null }));
vi.mock("@/lib/business-taxonomy/hooks", () => ({ useBusinessTaxonomyQuery: () => ({ data: [] }), subcategoriesFor: () => [] }));
vi.mock("@/lib/services/hooks", () => ({ useCreateServiceCategoryMutation: () => ({}), useUpdateServiceCategoryMutation: () => ({}), useServiceCategoriesQuery: () => ({ data: [] }) }));
vi.mock("@/lib/business/hooks", () => ({
  useBusinessQuery: () => ({ data: { id: "business", name: "Business", phone: { countryCode: "+357", nationalNumber: "99112233" }, address: { city: "Larnaca", area: "Centre", streetName: "Main", streetNumber: "1" }, category: "Beauty", subcategories: [], briefDescription: "", timezone: "Europe/Nicosia", visitType: "AT_BUSINESS_LOCATION" } }),
  useBusinessMediaQuery: () => ({ data: [] }), useBusinessTravelSettingsQuery: () => ({}),
  useUpdateBusinessMutation: () => ({ mutateAsync: vi.fn(async () => ({})) }), useUpdateBusinessTravelSettingsMutation: () => ({}),
  useDeleteBusinessMediaMutation: () => ({}), useSetBusinessProfileMediaMutation: () => ({}), useUploadBusinessMediaMutation: () => ({}),
}));
vi.mock("@/lib/business/hours-hooks", () => ({ useBusinessHoursQuery: () => ({}), useUpdateBusinessHoursMutation: () => ({ mutateAsync: vi.fn(async () => ({})) }) }));
vi.mock("@/lib/business/availability-hooks", () => ({
  useBusinessAvailabilityRulesQuery: () => ({ data: fx.rules, isError: fx.failed, refetch: vi.fn() }),
  useUpdateBusinessAvailabilityMutation: () => ({ mutateAsync: fx.save, isPending: false }),
  useCalendarBlocksQuery: () => ({ data: { blocks: fx.blocks, timezone: "Europe/Nicosia", closedPeriods: [] }, isError: fx.failed, refetch: vi.fn() }),
  useChangeCalendarBlocksMutation: () => ({ mutateAsync: fx.change, isPending: false }),
}));
vi.mock("@/lib/staff/hooks", () => ({ useStaffListQuery: () => ({ data: { members: [{ membershipId: "staff-id", name: "Same-Name Professional", schedule: [] }] } }) }));
vi.mock("@/lib/bookings/hooks", () => ({ useBusinessCalendarQuery: () => ({ data: { bookings: [] } }), useCancelByBusinessMutation: () => ({}), useMarkNoShowMutation: () => ({}), useWaiveFeeMutation: () => ({}) }));
let host: HTMLDivElement, root: Root;
const button = (text: string) => Array.from(host.querySelectorAll("button")).find(value => value.textContent?.trim().startsWith(text))!;
const click = async (text: string) => { await act(async () => button(text).click()); };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  fx.rules = { businessId: "business", timezone: "Europe/Nicosia", publicVisible: false, minimumNoticeMinutes: 60, maximumAdvanceMonths: 3,
    closedPeriods: [{ startDate: "2030-01-15", endDate: "2030-01-16", note: "Holiday" }] };
  fx.blocks = []; fx.failed = false; fx.save.mockReset(); fx.change.mockReset(); fx.back.mockReset(); fx.error.mockReset(); fx.warning.mockReset();
  fx.save.mockResolvedValue({ ...fx.rules, overlappingBookings: 2 }); fx.change.mockResolvedValue({ overlappingBookings: 0 });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const settings = async () => { await act(async () => root.render(createElement(DashboardCreateBusiness, { businessId: "business", mode: "edit", onBack: fx.back }))); };
const calendar = async () => { await act(async () => root.render(createElement(DashboardCalendar, { businessId: "business" }))); };

it("hydrates persisted settings and saves visibility, notice, window and edited closures", async () => {
  await settings();
  expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
  expect(Array.from(host.querySelectorAll("select")).map(value => value.value)).toEqual(expect.arrayContaining(["60", "3"]));
  expect(host.querySelector<HTMLInputElement>('input[placeholder="e.g. Christmas holidays"]')?.value).toBe("Holiday");
  await act(async () => (host.querySelector('[role="switch"]') as HTMLButtonElement).click());
  await act(async () => (host.querySelector('[aria-label="Remove closed period"]') as HTMLButtonElement).click());
  await click("Save changes");
  expect(fx.save).toHaveBeenCalledWith({ businessId: "business", input: { publicVisible: true, minimumNoticeMinutes: 60, maximumAdvanceMonths: 3, closedPeriods: [] } });
  expect(fx.warning).toHaveBeenCalledOnce(); expect(fx.back).toHaveBeenCalledOnce();
});
it("keeps the form open and surfaces an availability save failure", async () => {
  fx.save.mockRejectedValue(new Error("Save failed")); await settings(); await click("Save changes");
  expect(fx.back).not.toHaveBeenCalled(); expect(fx.error).toHaveBeenCalled();
});
it("does not allow failed settings loads to save invented defaults", async () => {
  fx.failed = true; await settings();
  expect(button("Save changes").disabled).toBe(true); expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(fx.save).not.toHaveBeenCalled();
});
it("persists a Weekly selection with canonical Staff identity and Business-local day boundaries", async () => {
  await calendar();
  const cell = Array.from(host.querySelectorAll<HTMLDivElement>("div")).find(value => value.className.includes("min-h-[140px]") && value.className.includes("cursor-pointer"))!;
  await act(async () => cell.click()); await click("Disable Selected Slots");
  expect(fx.change).toHaveBeenCalledWith({ businessId: "business", action: "BLOCK", intervals: [expect.objectContaining({ staffMembershipId: "staff-id", startTime: "00:00", endTime: "00:00" })] });
  expect(button("Disable Selected Slots")).toBeUndefined();
});
it("reloads a persisted block and reopens only its selected range", async () => {
  fx.blocks = [{ staffMembershipId: "staff-id", startAt: "2000-01-01T00:00:00Z", endAt: "2100-01-01T00:00:00Z" }];
  await calendar();
  const disabled = Array.from(host.querySelectorAll("span")).find(value => value.textContent === "Disabled")!;
  await act(async () => disabled.parentElement!.parentElement!.click()); await click("Activate Selected Slots");
  expect(fx.change).toHaveBeenCalledWith(expect.objectContaining({ action: "UNBLOCK", intervals: [expect.objectContaining({ staffMembershipId: "staff-id" })] }));
});
it("failed block loads prevent a local-only Disable action", async () => {
  fx.failed = true; await calendar();
  expect((host.querySelector('[aria-label="Calendar block scope"]') as HTMLSelectElement).disabled).toBe(true);
  expect(host.querySelector('[role="alert"]')).not.toBeNull(); expect(fx.change).not.toHaveBeenCalled();
});
