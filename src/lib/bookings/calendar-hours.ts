import type { BookingCalendarEntry } from "@/lib/api/bookings";
import type { BusinessHoursDay } from "@/lib/api/business-hours";
import { daysOfWeek, type ScheduleDay } from "@/lib/api/staff";

function localParts(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "0";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Intersect the actual appointment with a calendar-local day. Comparing local dates rather
 * than dividing elapsed milliseconds preserves midnight and DST boundaries. No Booking edits. */
export function bookingDayInterval(booking: Pick<BookingCalendarEntry, "schedule">, date: string, timezone = booking.schedule.timezone) {
  const start = localParts(booking.schedule.startAt, timezone), end = localParts(booking.schedule.endAt, timezone);
  if (start.date > date || end.date < date || (end.date === date && end.minutes === 0)) return null;
  const from = start.date < date ? 0 : start.minutes;
  let to = end.date > date ? 1440 : end.minutes;
  // The repeated hour at DST fall-back can end earlier on the wall clock. Keep a
  // positive persisted duration visible in the existing single-hour-row layout.
  if (to <= from && start.date === date && end.date === date) {
    const elapsed = (Date.parse(booking.schedule.endAt) - Date.parse(booking.schedule.startAt)) / 60000;
    if (elapsed > 0) to = Math.min(1440, from + elapsed);
  }
  return to > from ? { from, to } : null;
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
