import type { BookingSource, BookingStatus } from "@/lib/api/bookings";

/** Integer-cents formatter — same convention as lib/services/format.ts's formatEuro. */
export const formatBookingMoney = (cents: number): string => `€${(cents / 100).toFixed(2)}`;

/** ONE canonical label per status — the single source of truth every Booking screen should
 * read from instead of inventing its own copy (see DashboardBookingsList.tsx's current mix of
 * "Upcoming"/"Canceled"/"Cancelled" for the inconsistency this replaces). */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  UPCOMING: "Upcoming",
  COMPLETED: "Completed",
  PENDING: "Pending resolution",
  NO_SHOW_CHARGED: "No-show (charged)",
  NO_SHOW_WAIVED: "No-show (waived)",
  NO_SHOW_CANCELLED: "No-show (cancelled)",
  CANCELLED_BY_CUSTOMER: "Cancelled by you",
  CANCELLED_BY_BUSINESS: "Cancelled by business",
  LATE_CANCELLATION: "Late cancellation",
};

export type BookingStatusTone = "info" | "success" | "warning" | "danger" | "neutral";

/** ONE badge/state map — tone only (no colors/classNames baked in here, so each screen's own
 * design system maps tone -> its own badge component/palette). */
export const BOOKING_STATUS_TONE: Record<BookingStatus, BookingStatusTone> = {
  UPCOMING: "info",
  COMPLETED: "success",
  PENDING: "warning",
  NO_SHOW_CHARGED: "danger",
  NO_SHOW_WAIVED: "neutral",
  NO_SHOW_CANCELLED: "neutral",
  CANCELLED_BY_CUSTOMER: "neutral",
  CANCELLED_BY_BUSINESS: "neutral",
  LATE_CANCELLATION: "warning",
};

/** Renders a Booking's absolute UTC schedule.startAt/endAt in ITS OWN snapshotted timezone —
 * never the browser's local timezone — matching the backend's own historical-integrity
 * guarantee (see BookingSchedule's model comment). `Intl.DateTimeFormat`'s `timeZone` option
 * does the conversion correctly in one step; never round-trip through a second `Date` parse. */
export const formatBookingDate = (isoInstant: string, timezone: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(isoInstant));

export const formatBookingTime = (isoInstant: string, timezone: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(isoInstant));

export const formatBookingTimeRange = (schedule: { startAt: string; endAt: string; timezone: string }): string =>
  `${formatBookingTime(schedule.startAt, schedule.timezone)}–${formatBookingTime(schedule.endAt, schedule.timezone)}`;

export type BookingClientBadge = "Manual" | "New" | "Returning";

/** ONE canonical rule for the Manual/New/Returning client badge — see booking.dto.ts's own
 * `platformFeeCents` doc comment for the evidence (a first BOOKLY_MANAGED booking is the only
 * case that field is ever nonzero). Never infer this from a mock tag or booking id. */
export const bookingClientBadge = (
  source: BookingSource,
  platformFeeCents: number,
): BookingClientBadge => {
  if (source === "MANUAL") return "Manual";
  return platformFeeCents > 0 ? "New" : "Returning";
};
