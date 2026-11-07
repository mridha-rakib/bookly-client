import { expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { businessAvailabilityApi } from "@/lib/api/business-availability";
import { invalidateBusinessAvailability } from "@/lib/business/availability-hooks";
import { calendarRange, calendarRangeState } from "@/lib/bookings/calendar-blocks";

vi.mock("@/lib/api/client", async original => ({ ...await original<object>(), apiRequest: vi.fn() }));
it("sends Business-scoped rules and timezone-free local boundary inputs for server resolution", async () => {
  vi.mocked(apiRequest).mockResolvedValue({});
  const input = { publicVisible: false, minimumNoticeMinutes: 30, maximumAdvanceMonths: 3, closedPeriods: [{ startDate: "2030-03-31", endDate: "2030-03-31", note: "Holiday" }] };
  await businessAvailabilityApi.putRules("business", input);
  expect(apiRequest).toHaveBeenLastCalledWith({ method: "PUT", url: "/businesses/business/availability-rules", data: input });
  const interval = calendarRange("canonical-staff", "2030-03-31", 1410, 1440);
  expect(interval).toEqual({ staffMembershipId: "canonical-staff", startDate: "2030-03-31", startTime: "23:30", endDate: "2030-04-01", endTime: "00:00" });
  await businessAvailabilityApi.changeBlocks("business", { action: "BLOCK", intervals: [interval] });
  expect(apiRequest).toHaveBeenLastCalledWith({ method: "PUT", url: "/businesses/business/calendar-blocks", data: { action: "BLOCK", intervals: [interval] } });
});
it("invalidates persisted settings, both availability surfaces, Calendar, rescheduling and discovery", async () => {
  const client = new QueryClient(); const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
  await invalidateBusinessAvailability(client, "business");
  for (const key of [["businessAvailability", "business"], ["availability", "business"], ["catalog", "availability", "business"], ["bookings", "calendar", "business"], ["bookingRescheduleAvailability"], ["discovery"], ["favorite"]]) expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
});
it("restores blocked state in Business timezone, distinguishes global blocks and respects exact boundaries", () => {
  const blocks = [{ staffMembershipId: "staff", startAt: "2030-01-15T03:00:00Z", endAt: "2030-01-15T04:00:00Z" }];
  expect(calendarRangeState(calendarRange("staff", "2030-01-15", 540, 570), blocks, [], "Asia/Dhaka")).toMatchObject({ blocked: true, global: false });
  expect(calendarRangeState(calendarRange("staff", "2030-01-15"), blocks, [], "Asia/Dhaka")).toMatchObject({ blocked: true, fullyBlocked: false });
  expect(calendarRangeState(calendarRange("other", "2030-01-15", 540, 570), blocks, [], "Asia/Dhaka").blocked).toBe(false);
  expect(calendarRangeState(calendarRange("staff", "2030-01-15", 600, 630), blocks, [], "Asia/Dhaka").blocked).toBe(false);
  expect(calendarRangeState(calendarRange("other", "2030-01-15", 540, 570), [{ ...blocks[0]!, staffMembershipId: undefined }], [], "Asia/Dhaka").global).toBe(true);
  expect(calendarRangeState(calendarRange("staff", "2030-01-15"), [], [{ startDate: "2030-01-15", endDate: "2030-01-15" }], "Asia/Dhaka").closed).toBe(true);
});
