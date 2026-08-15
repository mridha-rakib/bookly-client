import type { DayOfWeek, ScheduleDay, StaffTimeOffEntry, StaffTimeOffType } from "@/lib/api/staff";

// Monday-first, matching both the backend's canonical DayOfWeek order and the existing
// Add Staff form's day-chip order.
export const dayOrder: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
];

export const dayShortLabel: Record<DayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun"
};

const hhmmPattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isValidCanonicalTime = (value: string): boolean => hhmmPattern.test(value);

/** Canonical "HH:mm" (24-hour) -> 12-hour display, e.g. "09:00" -> "9:00 AM". UI must never
 * show the raw 24-hour value directly. */
export const formatTime12Hour = (hhmm: string): string => {
  const match = hhmmPattern.exec(hhmm);
  if (!match) return hhmm;
  const [, hoursRaw, minutes] = match;
  const hours24 = Number(hoursRaw);
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
};

/** 12-hour display input -> canonical "HH:mm". Throws for an out-of-range hour/minute. */
export const parseTime12HourToCanonical = (
  hour12: number,
  minute: number,
  period: "AM" | "PM"
): string => {
  if (!Number.isInteger(hour12) || hour12 < 1 || hour12 > 12) {
    throw new Error("Enter a valid hour (1-12)");
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error("Enter a valid minute (00-59)");
  }
  const hours24 = period === "AM" ? hour12 % 12 : (hour12 % 12) + 12;
  return `${String(hours24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

/** Parses free-text "H:MM" or "HH:MM" (no AM/PM) into {hour12, minute}, for the input field
 * paired with a separate AM/PM toggle. Returns null if the text doesn't parse. Any minute
 * 00-59 is accepted — there is no 15/30-minute increment restriction on Staff schedules. */
export const parseTimeInputText = (raw: string): { hour: number; minute: number } | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

/**
 * Sanitizes a raw keystroke-by-keystroke Start/End Shift draft (digits + at most one colon,
 * "H"/"HH" hour part, "MM" minute part) WITHOUT validating range or completeness — that's
 * {@link parseTimeInputText}'s job, applied on blur / Add Hours / Save. This only strips
 * characters that could never be part of a valid "H:MM" and caps each part's length, so the
 * controlled input never fights the user mid-keystroke (typing "9", "9:", "9:2", "9:20" all
 * stay exactly as typed instead of being reformatted or snapped back).
 */
export const sanitizeTimeDraftInput = (raw: string): string => {
  let digitsAndColon = raw.replace(/[^\d:]/g, "");

  const firstColon = digitsAndColon.indexOf(":");
  if (firstColon !== -1) {
    digitsAndColon =
      digitsAndColon.slice(0, firstColon + 1) + digitsAndColon.slice(firstColon + 1).replace(/:/g, "");
  }

  const [hourPart, minutePart] = digitsAndColon.split(":");
  const hour = (hourPart ?? "").slice(0, 2);
  if (minutePart === undefined) {
    return hour;
  }
  return `${hour}:${minutePart.slice(0, 2)}`;
};

export const timeOffTypeLabels: Record<StaffTimeOffType, string> = {
  ANNUAL_HOLIDAY: "Annual Holiday",
  SICK_LEAVE: "Sick leave"
};

/** "2026-06-05" -> "5 Jun 2026". Used for both single-day and range endpoints. */
export const formatIsoDateShort = (isoDate: string): string => {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** "5 Jun 2026" for a single day (startDate === endDate), "2 Jun 2026 - 6 Jun 2026" (inclusive)
 * for a range. */
export const formatTimeOffRange = (entry: Pick<StaffTimeOffEntry, "startDate" | "endDate">): string =>
  entry.startDate === entry.endDate
    ? formatIsoDateShort(entry.startDate)
    : `${formatIsoDateShort(entry.startDate)} - ${formatIsoDateShort(entry.endDate)}`;

type HourGroup = { startTime: string; endTime: string; days: DayOfWeek[] };

/** Groups configured days by identical (startTime, endTime) — never merges days whose
 * hours actually differ, so callers can render each group as its own truthful segment. */
const groupByHours = (days: ScheduleDay[]): HourGroup[] => {
  const byKey = new Map<string, HourGroup>();

  for (const day of days) {
    const key = `${day.startTime}-${day.endTime}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.days.push(day.dayOfWeek);
    } else {
      byKey.set(key, { startTime: day.startTime, endTime: day.endTime, days: [day.dayOfWeek] });
    }
  }

  // Earliest-weekday-first, so segment order is stable and predictable regardless of the
  // order the underlying days[] happened to be stored/returned in.
  return [...byKey.values()].sort(
    (a, b) => Math.min(...a.days.map((d) => dayOrder.indexOf(d))) - Math.min(...b.days.map((d) => dayOrder.indexOf(d)))
  );
};

const formatHourGroup = (group: HourGroup): string =>
  `${compressDayRanges(group.days)} • ${formatTime12Hour(group.startTime)}–${formatTime12Hour(group.endTime)}`;

/**
 * Card-sized weekly schedule summary. Never fabricates uniform hours across days that
 * actually differ — mixed-hours groups render as separate segments (joined with "; " since
 * the card has only one line), each internally truthful.
 */
export const summarizeScheduleForCard = (days: ScheduleDay[]): string => {
  if (days.length === 0) {
    return "Not set yet";
  }

  return groupByHours(days).map(formatHourGroup).join("; ");
};

/**
 * ["MONDAY","TUESDAY","WEDNESDAY"] -> "Mon–Wed"; ["MONDAY","WEDNESDAY","FRIDAY"] -> "Mon, Wed, Fri".
 * Understands the weekly cycle: ["SATURDAY","SUNDAY","MONDAY","TUESDAY"] -> "Sat–Tue", not
 * three broken fragments — the week wraps from Sunday back to Monday.
 */
const compressDayRanges = (days: DayOfWeek[]): string => {
  const indices = [...new Set(days.map((day) => dayOrder.indexOf(day)))].sort((a, b) => a - b);
  if (indices.length === 0) return "";

  if (indices.length === 7) {
    return `${dayShortLabel[dayOrder[0]!]}–${dayShortLabel[dayOrder[6]!]}`;
  }

  // Linear (Monday-first, non-wrapping) contiguous runs.
  let runs: number[][] = [];
  for (const index of indices) {
    const lastRun = runs[runs.length - 1];
    if (lastRun && index === lastRun[lastRun.length - 1]! + 1) {
      lastRun.push(index);
    } else {
      runs.push([index]);
    }
  }

  // A week-boundary wrap (e.g. Sat, Sun, Mon, Tue) shows up as two separate linear runs:
  // one ending at Sunday (index 6) and one starting at Monday (index 0). If both exist,
  // they're actually one contiguous run across the boundary — merge them so it reads in
  // its natural wrap order ("Sat–Tue"), not split at the Sunday/Monday seam.
  if (runs.length > 1) {
    const firstRun = runs[0]!;
    const lastRun = runs[runs.length - 1]!;
    if (firstRun[0] === 0 && lastRun[lastRun.length - 1] === 6) {
      const merged = [...lastRun, ...firstRun];
      runs = [merged, ...runs.slice(1, -1)];
    }
  }

  return runs
    .map((run) =>
      run.length > 1
        ? `${dayShortLabel[dayOrder[run[0]!]!]}–${dayShortLabel[dayOrder[run[run.length - 1]!]!]}`
        : dayShortLabel[dayOrder[run[0]!]!]
    )
    .join(", ");
};

/** One line per hour-group for the Availability table, e.g. "Sat–Mon • 9:00 AM–5:00 PM". */
export const summarizeScheduleForTable = (days: ScheduleDay[]): string[] => {
  if (days.length === 0) {
    return ["Not set yet"];
  }

  return groupByHours(days).map(formatHourGroup);
};

/** Availability table's Time Off cell — first entry plus a "+N more" suffix when applicable. */
export const summarizeTimeOffForTable = (entries: StaffTimeOffEntry[]): string => {
  if (entries.length === 0) {
    return "None recorded";
  }

  const [first, ...rest] = entries;
  const label = `${formatTimeOffRange(first!)} (${timeOffTypeLabels[first!.type]})`;
  return rest.length > 0 ? `${label} +${rest.length} more` : label;
};
