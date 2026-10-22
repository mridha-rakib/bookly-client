"use client";

import Link from "next/link";
import type { PackageProgressSession } from "@/lib/api/packages";
import type { BookingStatus } from "@/lib/api/bookings";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_TONE, formatBookingDate, formatBookingTimeRange } from "@/lib/bookings/format";
import { PACKAGE_SESSION_STATUS_PRESENTATION } from "@/lib/packages/presentation";

const BOOKING_BADGE_CLASSES = {
  info: "bg-[#E6F1FB] text-[#3760B7]",
  success: "bg-[#E1F5EE] text-[#2F8068]",
  warning: "bg-[#FCF4E0] text-[#D97706]",
  danger: "bg-[#FFF0F0] text-[#E42424]",
  neutral: "bg-[#F0F0EE] text-[#5F5E5A]",
};

interface PackageAppointmentHistoryProps {
  sessions: PackageProgressSession[];
  totalSessions: number;
  onViewBooking?: (bookingId: string) => void;
  customer?: boolean;
  showCustomerActions?: boolean;
  currentBookingId?: string;
}

/** Persisted appointment attempts in DTO order. Repeated indices are display metadata,
 * never row identity, unique credit slots, or evidence of a replacement relationship. */
export default function PackageAppointmentHistory({
  sessions,
  totalSessions,
  onViewBooking,
  customer = false,
  showCustomerActions = false,
  currentBookingId,
}: PackageAppointmentHistoryProps) {
  const counts = new Map<number, number>();
  const seen = new Map<number, number>();
  for (const session of sessions) {
    counts.set(session.sessionIndex, (counts.get(session.sessionIndex) ?? 0) + 1);
  }

  if (sessions.length === 0) {
    return <p className="rounded-xl bg-[#F5F4EE] p-5 text-sm text-[#5F5E5A]">No session appointments are available to show yet.</p>;
  }

  const actionClassName = "rounded-lg border border-[#C6C6CB] px-4 py-2 text-center text-sm font-semibold text-[#020305] hover:bg-neutral-50";
  return (
    <ol className="flex flex-col gap-4">
      {sessions.map((session, position) => {
        const attemptNumber = (seen.get(session.sessionIndex) ?? 0) + 1;
        seen.set(session.sessionIndex, attemptNumber);
        const repeatedAttempts = counts.get(session.sessionIndex) ?? 1;
        const presentation = PACKAGE_SESSION_STATUS_PRESENTATION[session.status];
        const booking = session.booking;
        const status = booking?.status as BookingStatus | undefined;
        const statusLabel = status === "CANCELLED_BY_CUSTOMER" && !customer
          ? "Cancelled by customer"
          : status ? BOOKING_STATUS_LABELS[status] ?? "Status unavailable" : undefined;
        const tone = status ? BOOKING_STATUS_TONE[status] ?? "neutral" : "neutral";
        const bookingUrl = session.bookingId ? `/customer/bookings/view?id=${encodeURIComponent(session.bookingId)}` : undefined;
        return (
          <li key={session.bookingId || `unlinked-attempt-${position}`} className="rounded-xl border border-[#E2E0DF] bg-white p-4 md:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 break-words">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={customer ? "font-manrope font-bold text-[#020305]" : "font-poppins text-sm font-semibold text-[#1C1B1C]"}>
                    Session record {session.sessionIndex} of {totalSessions}
                  </h3>
                  {session.bookingId && session.bookingId === currentBookingId && (
                    <span className="rounded-full bg-[#F0F0EE] px-2.5 py-1 text-xs font-semibold text-[#5F5E5A]">Current booking</span>
                  )}
                </div>
                {repeatedAttempts > 1 && (
                  <p className="mt-1 text-xs font-medium text-[#725B00]">Appointment attempt {attemptNumber} of {repeatedAttempts} with this recorded index</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.className}`}>Package outcome: {presentation.label}</span>
                  {booking && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BOOKING_BADGE_CLASSES[tone]}`}>Booking: {statusLabel}</span>}
                </div>
                {booking ? (
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-wider text-[#888780]">Date and time</dt>
                      <dd className="mt-1 font-medium text-[#1C1B1C]">{formatBookingDate(booking.schedule.startAt, booking.schedule.timezone)} · {formatBookingTimeRange(booking.schedule)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-wider text-[#888780]">Professional</dt>
                      <dd className="mt-1 font-medium text-[#1C1B1C]">{booking.professional.displayName ?? "Professional"}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-4 rounded-lg bg-[#F5F4EE] p-3 text-sm text-[#5F5E5A]">Booking details are unavailable.</p>
                )}
              </div>
              {booking && bookingUrl && (customer || onViewBooking) && (
                <div className="flex w-full flex-col gap-2 sm:w-[180px] sm:flex-none">
                  {customer ? <Link href={bookingUrl} className={actionClassName}>View booking</Link> : (
                    <button type="button" onClick={() => onViewBooking?.(session.bookingId)} className={actionClassName}>View booking</button>
                  )}
                  {customer && showCustomerActions && session.status === "SCHEDULED" && booking.status === "UPCOMING" && (
                    <>
                      <Link href={bookingUrl} className={actionClassName}>Reschedule session</Link>
                      <Link href={bookingUrl} className="rounded-lg border border-red-200 px-4 py-2 text-center text-sm font-semibold text-[#BA1A1A] hover:bg-red-50">Cancel this appointment</Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
