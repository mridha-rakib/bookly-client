import type { CalendarBlock, ClosedPeriod, LocalCalendarRange } from "@/lib/api/business-availability";

/** Select by canonical membership and local date/time, never row labels or grid offsets. */
export function calendarRange(staffMembershipId: string | undefined, date: string, startMinute = 0, endMinute = 1440): LocalCalendarRange {
  const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  return { ...(staffMembershipId ? { staffMembershipId } : {}), startDate: date, startTime: clock(startMinute), endDate: endMinute === 1440 ? next.toISOString().slice(0, 10) : date, endTime: endMinute === 1440 ? "00:00" : clock(endMinute) };
}
function localKey(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find(value => value.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function createCalendarRangeState(blocks: CalendarBlock[], closedPeriods: ClosedPeriod[], timezone: string) {
  // Convert saved instants once per query snapshot rather than once per grid cell/render.
  const localBlocks = blocks.map(block => ({ staffMembershipId: block.staffMembershipId, start: localKey(block.startAt, timezone), end: localKey(block.endAt, timezone) })).sort((a, b) => a.start.localeCompare(b.start));
  return (range: LocalCalendarRange) => {
    const start = `${range.startDate}T${range.startTime}`, end = `${range.endDate}T${range.endTime}`;
    const matches = localBlocks.filter(block => (!block.staffMembershipId || block.staffMembershipId === range.staffMembershipId) && block.start < end && start < block.end);
    let coveredUntil = start;
    for (const block of matches) { if (block.start > coveredUntil) break; if (block.end > coveredUntil) coveredUntil = block.end; }
    return {
      blocked: matches.length > 0,
      fullyBlocked: coveredUntil >= end,
      global: matches.some(block => !block.staffMembershipId),
      closed: closedPeriods.some(period => `${period.startDate}T00:00` < end && `${period.endDate}T23:59` >= start),
    };
  };
}
export function calendarRangeState(range: LocalCalendarRange, blocks: CalendarBlock[], closedPeriods: ClosedPeriod[], timezone: string) {
  return createCalendarRangeState(blocks, closedPeriods, timezone)(range);
}
