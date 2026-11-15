import { describe, expect, it } from "vitest";
import { bookingDayInterval, calendarDayHours, calendarDayLanes, calendarDayTimeline } from "@/lib/bookings/calendar-hours";
import { calendarInstantRangeState } from "@/lib/bookings/calendar-blocks";

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

describe("business-local elapsed timeline", () => {
  it("represents ordinary days as 24 hours and keeps adjacent bookings in separate groups", () => {
    const timeline = calendarDayTimeline("2026-11-02", "Europe/Nicosia");
    expect(timeline.slots).toHaveLength(48);
    const rows = [{ id: "a", ...booking("2026-11-02T07:00:00Z", "2026-11-02T08:00:00Z") },
      { id: "b", ...booking("2026-11-02T08:00:00Z", "2026-11-02T09:00:00Z") }];
    expect(bookingDayInterval(rows[0]!, "2026-11-02")).toEqual({ from: 540, to: 600 });
    expect(calendarDayLanes(rows, "2026-11-02").get("a")).toEqual({ lane: 0, count: 1 });
    expect(calendarDayLanes(rows, "2026-11-02").get("b")).toEqual({ lane: 0, count: 1 });
  });
  it("omits the missing spring hour and uses elapsed time across the jump", () => {
    const timeline = calendarDayTimeline("2026-03-29", "Europe/Nicosia");
    expect(timeline.slots).toHaveLength(46);
    expect(timeline.slots.some(slot => slot.wallMinute === 180)).toBe(false);
    expect(bookingDayInterval(booking("2026-03-29T00:30:00Z", "2026-03-29T01:30:00Z"), "2026-03-29")).toEqual({ from: 150, to: 210 });
    expect(timeline.slots.find(slot => slot.wallMinute === 150)?.discontinuous).toBe(true);
  });
  it("distinguishes both fall-back hours and places intervals by actual instants", () => {
    const timeline = calendarDayTimeline("2026-10-25", "Europe/Nicosia");
    expect(timeline.slots).toHaveLength(50);
    const repeated = timeline.slots.filter(slot => slot.wallMinute === 180);
    expect(repeated).toHaveLength(2);
    expect(repeated.map(slot => slot.offset)).toEqual(["GMT+3", "GMT+2"]);
    expect(repeated[1]!.startAt - repeated[0]!.startAt).toBe(3600000);
    expect(repeated.every(slot => slot.ambiguous)).toBe(true);
    expect(bookingDayInterval(booking("2026-10-25T00:15:00Z", "2026-10-25T00:45:00Z"), "2026-10-25")).toEqual({ from: 195, to: 225 });
    expect(bookingDayInterval(booking("2026-10-25T01:15:00Z", "2026-10-25T01:45:00Z"), "2026-10-25")).toEqual({ from: 255, to: 285 });
    expect(bookingDayInterval(booking("2026-10-25T00:45:00Z", "2026-10-25T01:15:00Z"), "2026-10-25")).toEqual({ from: 225, to: 255 });
  });
  it("does not overlap separate repeated-hour occurrences but separates true overlaps", () => {
    const rows = [
      { id: "first", ...booking("2026-10-25T00:10:00Z", "2026-10-25T00:40:00Z") },
      { id: "overlap", ...booking("2026-10-25T00:20:00Z", "2026-10-25T00:30:00Z") },
      { id: "second", ...booking("2026-10-25T01:10:00Z", "2026-10-25T01:40:00Z") },
    ];
    const lanes = calendarDayLanes(rows, "2026-10-25");
    expect(lanes.get("first")).toEqual({ lane: 0, count: 2 });
    expect(lanes.get("overlap")).toEqual({ lane: 1, count: 2 });
    expect(lanes.get("second")).toEqual({ lane: 0, count: 1 });
  });
  it("shows a saved block only in the actual repeated-hour occurrence it intersects", () => {
    const repeated = calendarDayTimeline("2026-10-25", "Europe/Nicosia").slots.filter(slot => slot.wallMinute === 180);
    const blocks = [{ staffMembershipId: "staff", startAt: "2026-10-25T00:00:00Z", endAt: "2026-10-25T00:30:00Z" }];
    expect(calendarInstantRangeState(repeated[0]!.startAt, repeated[0]!.endAt, "2026-10-25", "staff", blocks, []).fullyBlocked).toBe(true);
    expect(calendarInstantRangeState(repeated[1]!.startAt, repeated[1]!.endAt, "2026-10-25", "staff", blocks, []).blocked).toBe(false);
  });
});
