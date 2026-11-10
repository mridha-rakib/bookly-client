/**
 * P2.2.1 (Owner decision E17) — Super Admin Overview and Analytics periods are Cyprus calendar
 * periods (`Europe/Nicosia`). The client only works out which Cyprus calendar DATES a selection
 * covers and sends them as inclusive `YYYY-MM-DD` values; the API converts them to the exact UTC
 * instants (DST-aware, half-open `[from, to)`) and stays the reporting authority. No offset is
 * computed here, and the result never depends on the browser's own timezone.
 */
export const PLATFORM_REPORTING_TIMEZONE = "Europe/Nicosia";
export const PLATFORM_REPORTING_TIMEZONE_LABEL = "Cyprus time";

export type OverviewPeriodUnit = "WEEK" | "MONTH" | "QUARTER";
export type OverviewPeriodSelection =
  | { kind: "ALL_TIME" }
  | { kind: "YEAR"; year: number }
  | { kind: "CURRENT"; unit: OverviewPeriodUnit };

/** Inclusive Cyprus calendar dates, `YYYY-MM-DD`. */
export type OverviewPeriodParams = { fromDate: string; toDate: string };

type CalendarDate = { year: number; month: number; day: number }; // month 1-12

const cyprusDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: PLATFORM_REPORTING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Cyprus calendar date an instant falls on. */
export const platformToday = (now: Date = new Date()): CalendarDate => {
  const parts = Object.fromEntries(cyprusDateParts.formatToParts(now).map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
};

/** Pure calendar arithmetic (Date.UTC is used only as a day counter, never as a timezone);
 * month/day overflow normalizes, e.g. month 13 is January of the next year. */
const calendarDate = (year: number, month: number, day: number): string => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

/** Monday-first weekday index (0 = Monday) of a calendar date. */
const mondayIndex = ({ year, month, day }: CalendarDate) => (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;

export const resolveOverviewPeriod = (
  selection: OverviewPeriodSelection,
  now: Date = new Date(),
): OverviewPeriodParams | undefined => {
  if (selection.kind === "ALL_TIME") return undefined;
  if (selection.kind === "YEAR") {
    return { fromDate: calendarDate(selection.year, 1, 1), toDate: calendarDate(selection.year, 12, 31) };
  }
  const today = platformToday(now);
  if (selection.unit === "MONTH") {
    return { fromDate: calendarDate(today.year, today.month, 1), toDate: calendarDate(today.year, today.month + 1, 0) };
  }
  if (selection.unit === "QUARTER") {
    const first = today.month - ((today.month - 1) % 3);
    return { fromDate: calendarDate(today.year, first, 1), toDate: calendarDate(today.year, first + 3, 0) };
  }
  // ISO week, Monday to Sunday (unchanged week definition), in Cyprus.
  const offset = mondayIndex(today);
  return {
    fromDate: calendarDate(today.year, today.month, today.day - offset),
    toDate: calendarDate(today.year, today.month, today.day - offset + 6),
  };
};

/** Analytics presets: the previous Cyprus calendar month, and this month through today. */
export const platformLastMonth = (now: Date = new Date()): OverviewPeriodParams => {
  const today = platformToday(now);
  return { fromDate: calendarDate(today.year, today.month - 1, 1), toDate: calendarDate(today.year, today.month, 0) };
};
export const platformMonthToDate = (now: Date = new Date()): OverviewPeriodParams => {
  const today = platformToday(now);
  return { fromDate: calendarDate(today.year, today.month, 1), toDate: calendarDate(today.year, today.month, today.day) };
};

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** e.g. "1 Nov 2026 – 30 Nov 2026 (Cyprus time)". */
export const describeOverviewPeriod = (period: OverviewPeriodParams | undefined): string =>
  period ? `${dayLabel(period.fromDate)} – ${dayLabel(period.toDate)} (${PLATFORM_REPORTING_TIMEZONE_LABEL})` : "All time";

/** P2.2.2 — the last `days` Cyprus calendar dates, ending today (inclusive). */
export const platformRecentDays = (days: number, now: Date = new Date()): OverviewPeriodParams => {
  const today = platformToday(now);
  return { fromDate: calendarDate(today.year, today.month, today.day - (days - 1)), toDate: calendarDate(today.year, today.month, today.day) };
};

/** Inclusive calendar-day count of a `YYYY-MM-DD` range (pure date arithmetic). */
const inclusiveDays = (fromDate: string, toDate: string) =>
  (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000 + 1;

/** Client-side check before a request; the API re-validates the converted window. */
export const validatePlatformRange = (fromDate: string, toDate: string, maxDays: number): string | null => {
  if (!fromDate || !toDate) return "Choose both a start and an end date.";
  if (fromDate > toDate) return "The start date must be on or before the end date.";
  if (inclusiveDays(fromDate, toDate) > maxDays) return `Choose a range of at most ${maxDays} days.`;
  return null;
};
