import { describe, expect, it } from "vitest";
import { bookingDayInterval, calendarDayHours, calendarDayLanes } from "@/lib/bookings/calendar-hours";

const booking = (startAt: string, endAt: string, timezone = "Europe/Nicosia") => ({ schedule: { startAt, endAt, timezone } });
describe("Day calendar coverage", () => {
  it("keeps overlapping appointments in separate lanes and resets after the group", () => {
    const rows = [
      { id: "one", ...booking("2026-11-02T04:00:00Z", "2026-11-02T05:00:00Z") },
      { id: "two", ...booking("2026-11-02T04:30:00Z", "2026-11-02T05:30:00Z") },
      { id: "three", ...booking("2026-11-02T06:00:00Z", "2026-11-02T07:00:00Z") },
    ];
    const lanes = calendarDayLanes(rows, "2026-11-02");
    expect(lanes.get("one")).toEqual({ lane: 0, count: 2 });
    expect(lanes.get("two")).toEqual({ lane: 1, count: 2 });
    expect(lanes.get("three")).toEqual({ lane: 0, count: 1 });
  });
  it("combines Business hours, split Staff shifts and persisted early/late appointments", () => {
    expect(calendarDayHours("2026-11-02", [
      booking("2026-11-02T03:30:00Z", "2026-11-02T04:00:00Z"),
      booking("2026-11-02T20:00:00Z", "2026-11-02T21:15:00Z"),
    ], [{ dayOfWeek: "MONDAY", isOpen: true, slots: [{ startTime: "09:00", endTime: "18:00" }] }], [
      [{ dayOfWeek: "MONDAY", intervals: [{ startTime: "04:00", endTime: "07:00" }, { startTime: "19:00", endTime: "21:00" }] }],
    ])).toEqual({ startHour: 4, endHour: 24 });
  });
  it("uses the Business timezone rather than the host or old Booking timezone", () => {
    const row = booking("2026-11-02T04:30:00Z", "2026-11-02T05:15:00Z", "UTC");
    expect(calendarDayHours("2026-11-02", [row], [], [], "Asia/Dhaka")).toEqual({ startHour: 10, endHour: 12 });
  });
  it("clips overnight appointments into both actual calendar dates", () => {
    const row = booking("2026-11-02T21:30:00Z", "2026-11-02T23:30:00Z");
    expect(bookingDayInterval(row, "2026-11-02")).toEqual({ from: 1410, to: 1440 });
    expect(bookingDayInterval(row, "2026-11-03")).toEqual({ from: 0, to: 90 });
    expect(bookingDayInterval(row, "2026-11-04")).toBeNull();
  });
  it("does not show a midnight-ending appointment again on the next day", () => {
    const row = booking("2026-11-02T21:00:00Z", "2026-11-02T22:00:00Z");
    expect(bookingDayInterval(row, "2026-11-02")).toEqual({ from: 1380, to: 1440 });
    expect(bookingDayInterval(row, "2026-11-03")).toBeNull();
  });
  it("keeps a positive-duration appointment visible across the repeated DST hour", () => {
    const row = booking("2026-10-25T00:45:00Z", "2026-10-25T01:15:00Z");
    expect(bookingDayInterval(row, "2026-10-25")).toEqual({ from: 225, to: 255 });
  });
  it("shows the complete empty day without inventing operating hours", () => {
    expect(calendarDayHours("2026-11-02", [], [
      { dayOfWeek: "MONDAY", isOpen: false, slots: [] },
      { dayOfWeek: "TUESDAY", isOpen: true, slots: [{ startTime: "08:00", endTime: "18:00" }] },
    ], [])).toEqual({ startHour: 0, endHour: 24 });
  });
});
