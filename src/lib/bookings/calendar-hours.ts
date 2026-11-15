import type { BookingCalendarEntry } from "@/lib/api/bookings";
import type { BusinessHoursDay } from "@/lib/api/business-hours";
import { daysOfWeek, type ScheduleDay } from "@/lib/api/staff";

function localParts(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "0";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Locate the first instant of a civil date without using the browser's timezone. */
const dayBoundaryCache = new Map<string, number>();
function dayBoundary(date: string, timezone: string): number {
  const cacheKey = `${timezone}:${date}`;
  const cached = dayBoundaryCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const key = (ms: number) => {
    const parts = formatter.formatToParts(new Date(ms));
    const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  };
  const reference = Date.parse(`${date}T00:00:00Z`);
  let low = Math.floor((reference - 48 * 3600000) / 60000);
  let high = Math.ceil((reference + 48 * 3600000) / 60000);
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (key(mid * 60000) < date) low = mid + 1; else high = mid;
  }
  const result = low * 60000;
  if (dayBoundaryCache.size >= 512) dayBoundaryCache.clear();
  dayBoundaryCache.set(cacheKey, result);
  return result;
}

export interface CalendarTimelineSlot {
  startAt: number;
  endAt: number;
  wallMinute: number;
  offset: string;
  ambiguous: boolean;
  discontinuous: boolean;
}

/** Half-hour rows in chronological instant order, including both repeated-hour occurrences. */
const timelineCache = new Map<string, { startAt: number; endAt: number; slots: CalendarTimelineSlot[] }>();
export function calendarDayTimeline(date: string, timezone: string) {
  const cacheKey = `${timezone}:${date}`;
  const cached = timelineCache.get(cacheKey);
  if (cached) return cached;
  const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  const startAt = dayBoundary(date, timezone);
  const endAt = dayBoundary(next.toISOString().slice(0, 10), timezone);
  const offsetFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, timeZoneName: "shortOffset", hour: "2-digit" });
  const slots: CalendarTimelineSlot[] = [];
  for (let start = startAt; start < endAt; start += 30 * 60000) {
    const end = Math.min(start + 30 * 60000, endAt);
    const wallMinute = localParts(new Date(start).toISOString(), timezone).minutes;
    const endParts = localParts(new Date(end).toISOString(), timezone);
    const expected = wallMinute + (end - start) / 60000;
    slots.push({ startAt: start, endAt: end, wallMinute,
      offset: offsetFormatter.formatToParts(new Date(start)).find(part => part.type === "timeZoneName")?.value ?? "",
      ambiguous: false,
      discontinuous: endParts.date === date ? endParts.minutes !== expected : expected !== 1440 });
  }
  const occurrences = new Map<number, number>();
  for (const slot of slots) occurrences.set(slot.wallMinute, (occurrences.get(slot.wallMinute) ?? 0) + 1);
  for (const slot of slots) slot.ambiguous = (occurrences.get(slot.wallMinute) ?? 0) > 1;
  const result = { startAt, endAt, slots };
  if (timelineCache.size >= 128) timelineCache.clear();
  timelineCache.set(cacheKey, result);
  return result;
}

/** Intersect an appointment with a business-local day, measured in real elapsed minutes. */
export function bookingDayInterval(booking: Pick<BookingCalendarEntry, "schedule">, date: string, timezone = booking.schedule.timezone) {
  const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  const dayStart = dayBoundary(date, timezone), dayEnd = dayBoundary(next.toISOString().slice(0, 10), timezone);
  const start = Math.max(dayStart, Date.parse(booking.schedule.startAt));
  const end = Math.min(dayEnd, Date.parse(booking.schedule.endAt));
  return end > start ? { from: (start - dayStart) / 60000, to: (end - dayStart) / 60000 } : null;
}

export function calendarDayHours(date: string, bookings: Pick<BookingCalendarEntry, "schedule">[], openingHours: BusinessHoursDay[], schedules: ScheduleDay[][], timezone?: string) {
  const weekday = daysOfWeek[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];
  const intervals: { from: number; to: number }[] = [];
  const minute = (time: string) => { const [hours, minutes] = time.split(":").map(Number); return hours * 60 + minutes; };
  for (const day of openingHours) if (day.dayOfWeek === weekday && day.isOpen)
    for (const slot of day.slots) intervals.push({ from: minute(slot.startTime), to: minute(slot.endTime) });
  for (const schedule of schedules) for (const day of schedule) if (day.dayOfWeek === weekday)
    for (const slot of day.intervals) intervals.push({ from: minute(slot.startTime), to: minute(slot.endTime) });
  for (const booking of bookings) {
    const interval = bookingDayInterval(booking, date, timezone ?? booking.schedule.timezone);
    if (interval) intervals.push(interval);
  }
  const valid = intervals.filter(interval => Number.isFinite(interval.from) && Number.isFinite(interval.to) && interval.to > interval.from);
  // No configured hours and no appointments: show the complete day, with no invented shift.
  if (!valid.length) return { startHour: 0, endHour: 24 };
  return { startHour: Math.max(0, Math.floor(Math.min(...valid.map(value => value.from)) / 60)),
    endHour: Math.min(24, Math.ceil(Math.max(...valid.map(value => value.to)) / 60)) };
}

/** Assign parallel lanes within each overlapping group without changing appointment times. */
export function calendarDayLanes(bookings: Pick<BookingCalendarEntry, "id" | "schedule">[], date: string, timezone?: string) {
  const intervals = bookings.flatMap(booking => {
    const interval = bookingDayInterval(booking, date, timezone);
    return interval ? [{ id: booking.id, ...interval }] : [];
  }).sort((a, b) => a.from - b.from || a.to - b.to || a.id.localeCompare(b.id));
  const layout = new Map<string, { lane: number; count: number }>();
  let group: { id: string; lane: number }[] = [], laneEnds: number[] = [], groupEnd = -1;
  const finishGroup = () => {
    for (const entry of group) layout.set(entry.id, { lane: entry.lane, count: laneEnds.length });
    group = []; laneEnds = []; groupEnd = -1;
  };
  for (const interval of intervals) {
    if (interval.from >= groupEnd) finishGroup();
    let lane = laneEnds.findIndex(end => end <= interval.from);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = interval.to;
    group.push({ id: interval.id, lane }); groupEnd = Math.max(groupEnd, interval.to);
  }
  finishGroup();
  return layout;
}
