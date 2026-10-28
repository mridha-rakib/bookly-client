"use client";

import { useState } from "react";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { BooklyApiError } from "@/lib/api/client";
import type { BookingStatus } from "@/lib/api/bookings";
import type { StaffAppointment } from "@/lib/api/staff-appointments";
import { useCurrentUserQuery } from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  type BookingStatusTone,
  formatBookingDate,
  formatBookingTimeRange,
} from "@/lib/bookings/format";
import { useMyAppointmentQuery, useMyAppointmentsQuery } from "@/lib/staff/appointment-hooks";

/**
 * P4C-1 (Owner decision D-S1) — the Staff member's OWN currently assigned appointments,
 * read-only. Data comes only from GET /businesses/:id/staff/me/appointments[/:bookingId]; the
 * server derives the membership from the session and returns only this Staff member's lines.
 * There are intentionally no Cancel, Reschedule, Complete, No-show, payment or Package controls.
 */

const TONE: Record<BookingStatusTone, string> = {
  info: "bg-[#E6F1FB] text-[#3760B7]",
  success: "bg-[#E1F5EE] text-[#2F8068]",
  warning: "bg-[#FCF4E0] text-[#D97706]",
  danger: "bg-[#FFF0F0] text-[#E42424]",
  neutral: "bg-[#F0F0EE] text-[#5F5E5A]",
};
const DAY_MS = 24 * 60 * 60 * 1000;

export type StaffAppointmentsView = "Upcoming" | "Canceled" | "Calendar";
const VIEW: Record<StaffAppointmentsView, { statuses: BookingStatus[]; subtitle: string; empty: string; pastDays: number; futureDays: number }> = {
  Calendar: {
    statuses: Object.keys(BOOKING_STATUS_LABELS) as BookingStatus[],
    subtitle: "Your assigned appointments · month agenda",
    empty: "No appointments on this page for the selected month.", pastDays: 1, futureDays: 60,
  },
  Upcoming: {
    statuses: ["UPCOMING", "PENDING"],
    subtitle: "Appointments assigned to you",
    empty: "You have no upcoming appointments assigned to you.",
    pastDays: 1,
    futureDays: 60,
  },
  Canceled: {
    statuses: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_BUSINESS", "LATE_CANCELLATION"],
    subtitle: "Your cancelled appointments",
    empty: "None of your appointments were cancelled in this period.",
    pastDays: 30,
    futureDays: 60,
  },
};

// The shared labels are written for the Customer ("Cancelled by you"); a Staff member reads them
// from the professional's side.
const STAFF_STATUS_LABELS: Record<BookingStatus, string> = {
  ...BOOKING_STATUS_LABELS,
  CANCELLED_BY_CUSTOMER: "Cancelled by customer",
};

const StatusBadge = ({ status }: { status: BookingStatus }) => (
  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${TONE[BOOKING_STATUS_TONE[status]]}`}>
    {STAFF_STATUS_LABELS[status]}
  </span>
);

const servicesLine = (appointment: StaffAppointment) =>
  appointment.services.map((service) => `${service.serviceName} · ${service.durationMin} min`).join(", ");

const accessMessage = (error: unknown) =>
  error instanceof BooklyApiError && (error.status === 404 || error.status === 403)
    ? "Your staff access to this business isn't active, so assigned appointments can't be shown. Contact the business owner if this is unexpected."
    : toUserMessage(error);

function monthRange(month: string) {
  const [year, number] = month.split("-").map(Number);
  // Pad UTC boundaries, then filter rows in each canonical Booking timezone.
  return { fromDate: new Date(Date.UTC(year, number - 1, 1) - DAY_MS).toISOString(),
    toDate: new Date(Date.UTC(year, number, 1) + DAY_MS).toISOString() };
}
function appointmentMonth(appointment: StaffAppointment): string {
  const parts = new Intl.DateTimeFormat("en", { year: "numeric", month: "2-digit",
    timeZone: appointment.schedule.timezone }).formatToParts(new Date(appointment.schedule.startAt));
  return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}`;
}

function AppointmentDetail({ businessId, bookingId, onBack }: { businessId: string; bookingId: string; onBack: () => void }) {
  const query = useMyAppointmentQuery(businessId, bookingId);
  const appointment = query.data;
  return (
    <section aria-label="Appointment details" className="flex flex-col gap-4 w-full bg-white border border-[#EDEBE6] rounded-xl p-5">
      <button type="button" onClick={onBack} className="self-start font-poppins text-xs text-[#5F5E5A] underline">
        Back to appointments
      </button>
      {query.isLoading && <p className="font-poppins text-sm text-neutral-400">Loading appointment…</p>}
      {query.isError && (
        <div className="flex items-center gap-3">
          <p role="alert" className="font-poppins text-sm text-[#BA1A1A]">
            {query.error instanceof BooklyApiError && query.error.status === 404
              ? "This appointment is no longer assigned to you."
              : toUserMessage(query.error)}
          </p>
          <button type="button" onClick={() => void query.refetch()} className="font-poppins text-xs underline">Try again</button>
        </div>
      )}
      {appointment && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 font-poppins text-sm">
          <div className="flex flex-col"><dt className="text-xs text-[#73726D]">Reference</dt><dd className="text-[#111111]">{appointment.reference}</dd></div>
          <div className="flex flex-col"><dt className="text-xs text-[#73726D]">Status</dt><dd><StatusBadge status={appointment.status} /></dd></div>
          <div className="flex flex-col">
            <dt className="text-xs text-[#73726D]">Date</dt>
            <dd className="text-[#111111]">{formatBookingDate(appointment.schedule.startAt, appointment.schedule.timezone)}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-[#73726D]">Time ({appointment.schedule.timezone})</dt>
            <dd className="text-[#111111]">{formatBookingTimeRange(appointment.schedule)}</dd>
          </div>
          <div className="flex flex-col"><dt className="text-xs text-[#73726D]">Customer</dt><dd className="text-[#111111]">{appointment.customer.displayName}</dd></div>
          <div className="flex min-w-0 flex-col">
            <dt className="text-xs text-[#73726D]">Service Location</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[#111111]">
              {appointment.fulfilment.mode === "AT_BUSINESS_LOCATION"
                ? appointment.fulfilment.businessLocation
                  ? `${appointment.fulfilment.businessLocation.streetName} ${appointment.fulfilment.businessLocation.streetNumber}, ${appointment.fulfilment.businessLocation.area}, ${appointment.fulfilment.businessLocation.city}`
                  : "At the business"
                : <>
                    <span>At the customer&apos;s address.</span>
                    {appointment.travelAddress ? (
                      <span className="block">
                        {appointment.travelAddress.streetName} {appointment.travelAddress.streetNumber}, {appointment.travelAddress.area}, {appointment.travelAddress.city}
                        {appointment.travelAddress.floorUnit && <span className="block">Floor / unit: {appointment.travelAddress.floorUnit}</span>}
                        {appointment.travelAddress.aptRoom && <span className="block">Apartment / room: {appointment.travelAddress.aptRoom}</span>}
                      </span>
                    ) : <span className="block">Travel address isn&apos;t available. Contact the business owner.</span>}
                  </>}
            </dd>
          </div>
          <div className="flex flex-col sm:col-span-2">
            <dt className="text-xs text-[#73726D]">Your services</dt>
            <dd>
              <ul className="flex flex-col gap-1">
                {appointment.services.map((service, index) => (
                  <li key={`${service.serviceName}-${index}`} className="text-[#111111]">
                    {service.serviceName} · {service.durationMin} min
                    {service.occupiedDurationMin !== undefined && service.occupiedDurationMin !== service.durationMin
                      ? ` (${service.occupiedDurationMin} min reserved)` : ""}
                    {service.addonNames.length > 0 ? ` · with ${service.addonNames.join(", ")}` : ""}
                    {service.isPackageSession ? " · package session" : ""}
                  </li>
                ))}
              </ul>
              {appointment.sharedWithOtherProfessionals && (
                <p className="mt-1 text-xs text-[#73726D]">Other professionals also have services in this booking.</p>
              )}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

export default function StaffMyAppointments({ view }: { view: StaffAppointmentsView }) {
  const businessId = useCurrentUserQuery().data?.business?.id;
  const config = VIEW[view];
  // The window is fixed when the tab opens, so paging through it stays stable.
  const [range] = useState(() => {
    const now = Date.now();
    return { fromDate: new Date(now - config.pastDays * DAY_MS).toISOString(),
      toDate: new Date(now + config.futureDays * DAY_MS).toISOString() };
  });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });
  const query = useMyAppointmentsQuery(businessId, { status: config.statuses,
    ...(view === "Calendar" ? monthRange(month) : range), page, limit: 20 });
  const appointments = (query.data?.appointments ?? []).filter((appointment) =>
    view !== "Calendar" || appointmentMonth(appointment) === month);

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto bg-[#FCF8F8] select-none font-poppins relative">
      <DashboardHeader title={view === "Calendar" ? "My calendar" : view === "Upcoming" ? "My appointments" : "Cancelled appointments"} subtitle={config.subtitle} />
      <div className="flex-1 p-4 sm:p-6 md:p-8 flex flex-col gap-4">
        {view === "Calendar" && !selected && <label className="font-poppins text-sm text-[#5F5E5A]">
          Month<input aria-label="Calendar month" type="month" value={month} className="ml-2 rounded border p-2"
            onChange={(event) => {
              if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) { setMonth(event.target.value); setPage(1); }
            }} />
          <span className="block text-xs">Dates and times use each appointment&apos;s business timezone. Pages show your assigned appointments only.</span>
        </label>}
        {!businessId ? (
          <p className="font-poppins text-sm text-[#5F5E5A]">
            Your staff access isn&apos;t linked to an active business, so there are no appointments to show.
          </p>
        ) : selected ? (
          <AppointmentDetail businessId={businessId} bookingId={selected} onBack={() => setSelected(null)} />
        ) : query.isLoading ? (
          <p className="font-poppins text-sm text-neutral-400">Loading appointments…</p>
        ) : query.isError ? (
          <div className="flex flex-col items-start gap-2">
            <p role="alert" className="font-poppins text-sm text-[#BA1A1A]">{accessMessage(query.error)}</p>
            <button type="button" onClick={() => void query.refetch()} className="font-poppins text-xs underline">Try again</button>
          </div>
        ) : appointments.length === 0 ? (
          <p className="font-poppins text-sm text-[#5F5E5A]">{view === "Calendar" ? config.empty : page > 1 ? "No more appointments." : config.empty}</p>
        ) : (
          <ul aria-label="Assigned appointments" className="flex flex-col gap-3">
            {appointments.map((appointment) => (
              <li key={appointment.id}>
                <button
                  type="button"
                  onClick={() => setSelected(appointment.id)}
                  className="w-full text-left bg-white border border-[#EDEBE6] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:border-[#C9C7C1]"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="font-poppins text-sm font-medium text-[#111111]">
                      {formatBookingDate(appointment.schedule.startAt, appointment.schedule.timezone)} · {formatBookingTimeRange(appointment.schedule)}
                    </span>
                    <span className="font-poppins text-xs text-[#5F5E5A]">{servicesLine(appointment)}</span>
                    <span className="font-poppins text-xs text-[#73726D]">{appointment.customer.displayName} · {appointment.reference}</span>
                  </span>
                  <StatusBadge status={appointment.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {businessId && !selected && query.data && (page > 1 || query.data.hasMore) && (
          <div className="flex items-center gap-3">
            {page > 1 && (
              <button type="button" onClick={() => setPage((current) => current - 1)} className="font-poppins text-xs underline">
                Previous
              </button>
            )}
            {query.data.hasMore && (
              <button type="button" onClick={() => setPage((current) => current + 1)} className="font-poppins text-xs underline">
                Next
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
