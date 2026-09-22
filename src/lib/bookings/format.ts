import type { BookingSource, BookingStatus } from "@/lib/api/bookings";
import { formatTime12Hour } from "@/lib/staff/format";

/** ONE canonical "Get Directions"/"Open in maps" destination builder — always the Booking's OWN
 * historical fulfilment snapshot (address text, or the frozen coordinate when one exists), NEVER
 * the Business's current address. Prefers the coordinate-based destination when a valid
 * historical `location` was snapshotted (more precise); falls back to the historical address
 * text otherwise. Never geocodes anything itself — this only builds an external Google Maps URL
 * the browser navigates to when clicked. */
export const buildBookingDirectionsUrl = (destination: {
  location?: { lat: number; lng: number } | undefined;
  addressText: string;
}): string => {
  const query = destination.location
    ? `${destination.location.lat},${destination.location.lng}`
    : destination.addressText;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

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

/** Same instant/timezone conversion as before (via Intl's `timeZone` option, `hour12: false`
 * only to get a stable "HH:mm" intermediate) — then rendered through the app's one canonical
 * 12-hour display formatter so every booking surface matches Staff/Business-hours' AM/PM style
 * ("9:00 AM", never "09:00 AM"). */
export const formatBookingTime = (isoInstant: string, timezone: string): string => {
  const canonical = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(isoInstant));
  return formatTime12Hour(canonical);
};

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

/** Batch 9 — the customer "My Bookings" tab groupings, one canonical mapping from the real
 * BookingStatus enum instead of each screen inventing its own (see the old mock's
 * "deposit_paid"/"passed_fee"/etc — a vocabulary with no backend equivalent). */
export type CustomerBookingTab = "upcoming" | "completed" | "noshow" | "canceled";

export const CUSTOMER_BOOKING_TAB_STATUSES: Record<CustomerBookingTab, BookingStatus[]> = {
  upcoming: ["UPCOMING", "PENDING"],
  completed: ["COMPLETED"],
  noshow: ["NO_SHOW_CHARGED", "NO_SHOW_WAIVED", "NO_SHOW_CANCELLED"],
  canceled: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_BUSINESS", "LATE_CANCELLATION"],
};
