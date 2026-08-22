"use client";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  ArrowDown01Icon,
  Add01Icon,
  FilterHorizontalIcon
} from "@hugeicons/core-free-icons";

import { useBusinessBookingsQuery } from "@/lib/bookings/hooks";
import { useStaffListQuery } from "@/lib/staff/hooks";
import type { BookingListItem, BookingStatus } from "@/lib/api/bookings";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  type BookingStatusTone,
  bookingClientBadge,
  formatBookingDate,
  formatBookingMoney,
  formatBookingTime,
} from "@/lib/bookings/format";

interface DashboardBookingsListProps {
  activeTab: string;
  /** Undefined means this actor has no manageable business right now (e.g. a STAFF account —
   * no product rule grants Staff booking-management rights, see
   * lib/business/hooks.ts's useManagedBusinessContext) — the list renders a clear "not
   * available" state rather than attempting a call the backend would reject. */
  businessId: string | undefined;
  onViewBookingDetails?: (bookingId: string) => void;
  onCreateManualBooking?: () => void;
  isStaffDashboard?: boolean;
}

const TONE_CLASSNAMES: Record<BookingStatusTone, string> = {
  info: "bg-[#E6F1FB] text-[#3760B7]",
  success: "bg-[#E1F5EE] text-[#2F8068]",
  warning: "bg-[#FCF4E0] text-[#D97706]",
  danger: "bg-[#FFF0F0] text-[#E42424]",
  neutral: "bg-[#F0F0EE] text-[#5F5E5A]",
};

const StatusBadge = ({ status }: { status: BookingStatus }) => (
  <span
    className={`inline-block px-3 py-1 text-[11px] font-semibold rounded-full select-none uppercase tracking-wider ${TONE_CLASSNAMES[BOOKING_STATUS_TONE[status]]}`}
  >
    {BOOKING_STATUS_LABELS[status]}
  </span>
);

const UPCOMING_STATUSES: BookingStatus[] = ["UPCOMING"];
const CANCELLED_STATUSES: BookingStatus[] = [
  "NO_SHOW_CHARGED",
  "NO_SHOW_WAIVED",
  "NO_SHOW_CANCELLED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_BUSINESS",
  "LATE_CANCELLATION",
];
const ALL_STATUSES: BookingStatus[] = [
  "UPCOMING",
  "COMPLETED",
  "PENDING",
  ...CANCELLED_STATUSES,
];

const PAGE_SIZE = 20;

export default function DashboardBookingsList({
  activeTab,
  businessId,
  onViewBookingDetails,
  onCreateManualBooking,
  isStaffDashboard = false,
}: DashboardBookingsListProps) {
  const [openBookingActionIdx, setOpenBookingActionIdx] = React.useState<number | null>(null);
  const [dropdownCoords, setDropdownCoords] = React.useState<{ top: number; left: number } | null>(null);
  const [bookingSearch, setBookingSearch] = React.useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = React.useState<BookingStatus | "All">("All");
  const [bookingStaffFilter, setBookingStaffFilter] = React.useState("All Staff");
  const [page, setPage] = React.useState(1);

  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const [dateFilter, setDateFilter] = React.useState<{ label: string; fromDate: string; toDate: string } | null>(null);
  const now = new Date();
  const [tempMonth, setTempMonth] = React.useState(now.getMonth());
  const [tempDay, setTempDay] = React.useState(now.getDate());
  const tempYear = now.getFullYear();

  // Reset to page 1 whenever a filter changes — adjusted during render (React's own recommended
  // pattern for this) rather than an effect, since an effect here would cause an extra, avoidable
  // render pass on every filter change.
  const filterSignature = `${activeTab}|${bookingStatusFilter}|${bookingStaffFilter}|${dateFilter?.fromDate ?? ""}`;
  const [prevFilterSignature, setPrevFilterSignature] = React.useState(filterSignature);
  if (filterSignature !== prevFilterSignature) {
    setPrevFilterSignature(filterSignature);
    setPage(1);
  }

  const tabStatuses: BookingStatus[] | undefined =
    activeTab === "Upcoming" ? UPCOMING_STATUSES : activeTab === "Canceled" ? CANCELLED_STATUSES : undefined;
  const effectiveStatuses =
    bookingStatusFilter === "All" ? tabStatuses : [bookingStatusFilter];

  const staffListQuery = useStaffListQuery(businessId);
  const staffMembershipId = bookingStaffFilter === "All Staff"
    ? undefined
    : staffListQuery.data?.members.find((m) => m.name === bookingStaffFilter)?.membershipId ?? undefined;

  const bookingsQuery = useBusinessBookingsQuery(businessId, {
    ...(effectiveStatuses ? { status: effectiveStatuses } : {}),
    ...(staffMembershipId ? { staffMembershipId } : {}),
    ...(dateFilter ? { fromDate: dateFilter.fromDate, toDate: dateFilter.toDate } : {}),
    page,
    limit: PAGE_SIZE,
  });

  const bookings = bookingsQuery.data?.bookings ?? [];
  const pagination = bookingsQuery.data?.pagination;

  // No server-side text search exists yet (confirmed — see booking.schema.ts's
  // listBusinessBookingsQuerySchema) — this filters only the CURRENT fetched page, matching
  // "don't reproduce server-side filtering locally" while still offering the existing search
  // box some function rather than removing it outright.
  const visibleBookings = bookings.filter((b) => {
    if (!bookingSearch) return true;
    const q = bookingSearch.toLowerCase();
    return b.customerName.toLowerCase().includes(q) || b.reference.toLowerCase().includes(q);
  });

  const statusOptions: BookingStatus[] =
    activeTab === "Upcoming" ? UPCOMING_STATUSES : activeTab === "Canceled" ? CANCELLED_STATUSES : ALL_STATUSES;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] select-none">
      {/* Bookings Header */}
      <DashboardHeader title={activeTab === "Upcoming" ? "Upcoming bookings" : activeTab === "Canceled" ? "Canceled bookings" : "All bookings"} subtitle={activeTab === "Upcoming" ? "View all upcoming bookings" : activeTab === "Canceled" ? "View all canceled bookings" : "View all bookings in details"} />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

      {/* Bookings Filter Bar Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between mb-6 select-none">
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2.5 items-stretch sm:items-center w-full md:w-auto">
          {/* Search bar input */}
          <div className="relative col-span-2 sm:w-[240px] h-9">
            <span className="absolute left-3 top-2.5">
              <HugeiconsIcon icon={Search01Icon} className="w-4 h-4 text-[#ABAAA6]" />
            </span>
            <input
              type="text"
              value={bookingSearch}
              onChange={(e) => setBookingSearch(e.target.value)}
              placeholder="Search by client or reference..."
              className="w-full h-full pl-9 pr-4 bg-white border border-[#D5D2C9] rounded-xl text-xs font-poppins placeholder-neutral-400 focus:outline-none focus:border-[#2E9DA7] transition-all"
            />
          </div>

          {/* Status filter select */}
          {!isStaffDashboard && (
            <div className="relative h-9 w-full sm:w-auto">
              <select
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter(e.target.value as BookingStatus | "All")}
                className="w-full appearance-none bg-white border border-[#D5D2C9] rounded-xl px-4 h-full pr-8 text-xs font-poppins font-medium text-[#111111] focus:outline-none focus:border-[#2E9DA7] cursor-pointer hover:bg-neutral-50 transition-all"
              >
                <option value="All">All Status</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{BOOKING_STATUS_LABELS[status]}</option>
                ))}
              </select>
              <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-neutral-600 pointer-events-none" />
            </div>
          )}

          {/* Staff filter select */}
          {!isStaffDashboard && (
            <div className="relative h-9 w-full sm:w-auto">
              <select
                value={bookingStaffFilter}
                onChange={(e) => setBookingStaffFilter(e.target.value)}
                className="w-full appearance-none bg-white border border-[#D5D2C9] rounded-xl px-4 h-full pr-8 text-xs font-poppins font-medium text-[#111111] focus:outline-none focus:border-[#2E9DA7] cursor-pointer hover:bg-neutral-50 transition-all"
              >
                <option value="All Staff">All Staff</option>
                {(staffListQuery.data?.members ?? [])
                  .filter((m) => m.membershipId)
                  .map((m) => (
                    <option key={m.membershipId} value={m.name}>{m.name}</option>
                  ))}
              </select>
              <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-neutral-600 pointer-events-none" />
            </div>
          )}

          {/* Date Filter Button */}
          <div className="relative h-9 col-span-2 sm:col-span-1 sm:w-auto">
            <button
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="w-full h-full px-4 bg-white border border-[#D5D2C9] hover:bg-neutral-50 rounded-xl text-xs font-medium font-poppins text-[#111111] flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
            >
              <span>{dateFilter ? dateFilter.label : "Filter Date"}</span>
              <HugeiconsIcon icon={FilterHorizontalIcon} className="w-4 h-4 text-[#111111]" />
            </button>

            {/* Custom Date Picker Modal Popup */}
            {isDatePickerOpen && (
              <div
                className="absolute top-11 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] border border-[#E8E8E6] p-6 z-50 w-[calc(100vw-32px)] sm:w-[360px] max-w-[360px] animate-fadeIn"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center w-full pb-3">
                  <h3 className="font-poppins font-semibold text-lg text-black">Custom date</h3>
                </div>

                <div className="flex flex-row justify-between items-center w-full py-2 mb-2">
                  <div className="relative">
                    <select
                      value={tempMonth}
                      onChange={(e) => setTempMonth(parseInt(e.target.value))}
                      className="appearance-none bg-transparent font-poppins font-medium text-xs text-[#111111] pr-4 focus:outline-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23111111' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right center',
                        backgroundSize: '10px'
                      }}
                    >
                      {monthNames.map((m, i) => (
                        <option key={i} value={i}>{m} {tempYear}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (tempMonth === 0) {
                          setTempMonth(11);
                        } else {
                          setTempMonth(tempMonth - 1);
                        }
                      }}
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-neutral-50 text-neutral-800 transition-colors"
                    >
                      {"<"}
                    </button>
                    <button
                      onClick={() => {
                        if (tempMonth === 11) {
                          setTempMonth(0);
                        } else {
                          setTempMonth(tempMonth + 1);
                        }
                      }}
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-neutral-50 text-neutral-800 transition-colors"
                    >
                      {">"}
                    </button>
                  </div>
                </div>

                <div className="w-full text-left font-poppins text-2xl font-bold text-black pb-4 border-b border-[#EFEFED]">
                  {(() => {
                    const tempDateObj = new Date(tempYear, tempMonth, tempDay);
                    const weekday = tempDateObj.toLocaleDateString("en-US", { weekday: "short" });
                    const mName = tempDateObj.toLocaleDateString("en-US", { month: "short" });
                    return `${weekday}, ${mName} ${tempDay}`;
                  })()}
                </div>

                {/* Weekdays Header */}
                <div className="grid grid-cols-7 text-center w-full font-poppins text-xs font-semibold text-neutral-500 my-2">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
                    <div key={idx} className="h-8 flex items-center justify-center">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid cells */}
                <div className="grid grid-cols-7 gap-y-1 text-center w-full mb-6">
                  {(() => {
                    const cellsList = [];
                    const firstDayIdx = new Date(tempYear, tempMonth, 1).getDay();
                    const daysInM = new Date(tempYear, tempMonth + 1, 0).getDate();
                    for (let i = 0; i < firstDayIdx; i++) {
                      cellsList.push(<div key={`empty-${i}`} className="h-8" />);
                    }
                    for (let d = 1; d <= daysInM; d++) {
                      const isSelected = d === tempDay;
                      cellsList.push(
                        <div key={d} className="h-8 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setTempDay(d)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-poppins text-xs font-semibold transition-all ${
                              isSelected
                                ? "bg-black text-white"
                                : "text-black hover:bg-neutral-100"
                            }`}
                          >
                            {d}
                          </button>
                        </div>
                      );
                    }
                    return cellsList;
                  })()}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#EFEFED]">
                  <button
                    type="button"
                    onClick={() => {
                      setTempMonth(now.getMonth());
                      setTempDay(now.getDate());
                      setDateFilter(null);
                      setIsDatePickerOpen(false);
                    }}
                    className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDatePickerOpen(false);
                      }}
                      className="px-4 py-2 border border-[#D5D2C9] rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const dayStart = new Date(tempYear, tempMonth, tempDay, 0, 0, 0, 0);
                        const dayEnd = new Date(tempYear, tempMonth, tempDay, 23, 59, 59, 999);
                        setDateFilter({
                          label: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                          fromDate: dayStart.toISOString(),
                          toDate: dayEnd.toISOString(),
                        });
                        setIsDatePickerOpen(false);
                      }}
                      className="px-4 py-2 bg-[#2E9DA7] hover:opacity-90 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Filter
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Manual Booking Button */}
        {!isStaffDashboard && (
          <button
            onClick={onCreateManualBooking}
            className="h-9 px-4 bg-[#111111] text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-neutral-800 transition-colors w-full md:w-auto shrink-0 shadow-sm"
          >
            <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 text-white" />
            <span>Manual Booking</span>
          </button>
        )}
      </div>

      {/* Bookings Table Block */}
      <div className="bg-white border border-[#E8E8E6] rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm">
        {!businessId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
            <span className="font-poppins text-sm font-semibold text-[#5F5E5A]">Booking management isn&apos;t available for your account</span>
            <span className="font-poppins text-xs text-[#ABAAA6] max-w-sm">Only the Business Owner and an active Supervisor can view and manage bookings.</span>
          </div>
        ) : bookingsQuery.isLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <span className="font-poppins text-sm text-neutral-400">Loading bookings…</span>
          </div>
        ) : bookingsQuery.isError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
            <span className="font-poppins text-sm font-semibold text-[#BA1A1A]">Couldn&apos;t load bookings</span>
            <span className="font-poppins text-xs text-[#ABAAA6]">Please try again in a moment.</span>
          </div>
        ) : visibleBookings.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
            <span className="font-poppins text-sm font-semibold text-[#5F5E5A]">No bookings found</span>
            <span className="font-poppins text-xs text-[#ABAAA6]">Try adjusting your filters.</span>
          </div>
        ) : (
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-[#FAFAF8] border-b border-[#E8E8E6] text-[11px] text-[#888780] font-normal font-poppins">
                <th className="py-3 px-5 font-normal">Client</th>
                <th className="py-3 px-4 font-normal">Reference</th>
                <th className="py-3 px-4 font-normal">Date &amp; Time</th>
                <th className="py-3 px-4 font-normal">Staff</th>
                <th className="py-3 px-4 font-normal text-center">Status</th>
                <th className="py-3 px-4 font-normal">Amount</th>
                <th className="py-3 px-5 font-normal text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEFED]">
              {visibleBookings.map((booking: BookingListItem, idx) => {
                const clientInitials = booking.customerName
                  .split(" ")
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const badge = bookingClientBadge(booking.source, booking.platformFeeCents);

                return (
                  <tr key={booking.id} className="hover:bg-neutral-50/40 transition-colors font-poppins">
                    {/* Client column */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#E1F5EE] flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-semibold text-[#5F5E5A]">
                            {clientInitials || "?"}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#1A1A1A]">
                            {booking.customerName}
                          </span>
                          <div className="mt-1 flex items-center">
                            <span className={`px-2 py-0.5 text-[9px] font-medium rounded-full ${
                              badge === "Manual" ? "bg-[#F5F4EE] text-[#5F5E5A]" : badge === "New" ? "bg-[#EEF2FF] text-[#3760B7]" : "bg-[#E1F5EE] text-[#2F8068]"
                            }`}>
                              {badge}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Reference column */}
                    <td className="py-4 px-4 text-xs font-semibold text-[#4C4B47]">
                      {booking.reference}
                    </td>

                    {/* Date & Time column */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-[#1A1A1A]">
                          {formatBookingDate(booking.schedule.startAt, booking.schedule.timezone)}
                        </span>
                        <span className="text-xs text-[#4C4B47] mt-0.5">
                          {formatBookingTime(booking.schedule.startAt, booking.schedule.timezone)}
                        </span>
                      </div>
                    </td>

                    {/* Staff column */}
                    <td className="py-4 px-4 text-sm font-normal text-[#4C4B47]">
                      {booking.staffNames.length > 0 ? booking.staffNames.join(", ") : "—"}
                    </td>

                    {/* Status Badge column */}
                    <td className="py-4 px-4 text-center">
                      <StatusBadge status={booking.status} />
                    </td>

                    {/* Amount column */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className={`text-sm font-semibold ${booking.totalCents > 0 ? "text-[#3A9C76]" : "text-neutral-500"}`}>
                          {formatBookingMoney(booking.totalCents)}
                        </span>
                        <span className="text-[11px] text-[#6F6E68] mt-0.5">
                          {booking.source === "MANUAL"
                            ? "Manual booking"
                            : booking.depositCents > 0
                              ? `Deposit ${formatBookingMoney(booking.depositCents)}`
                              : "Pay at venue"}
                        </span>
                      </div>
                    </td>

                    {/* Action Button column */}
                    <td className="py-4 px-5 text-center relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const dropdownHeight = 90;
                          const spaceBelow = window.innerHeight - rect.bottom;
                          setDropdownCoords({
                            top: spaceBelow < dropdownHeight ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
                            left: rect.right - 176
                          });
                          setOpenBookingActionIdx(openBookingActionIdx === idx ? null : idx);
                        }}
                        className="h-9 px-4 border border-[#111827] rounded-full flex items-center justify-center gap-1.5 hover:bg-neutral-50 transition-all text-xs font-semibold text-[#111827] mx-auto"
                      >
                        <span>Action</span>
                        <HugeiconsIcon icon={ArrowDown01Icon} className="w-4 h-4 text-[#111827]" />
                      </button>

                      {/* Click backdrop */}
                      {openBookingActionIdx === idx && (
                        <>
                          <div
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={() => setOpenBookingActionIdx(null)}
                          />
                          <div
                            style={{
                              position: "fixed",
                              top: dropdownCoords?.top,
                              left: dropdownCoords?.left
                            }}
                            className="z-50 w-44 bg-white rounded-xl shadow-xl border border-neutral-200/50 flex flex-col py-1.5 text-xs text-left animate-fadeIn"
                          >
                            <button
                              onClick={() => {
                                setOpenBookingActionIdx(null);
                                onViewBookingDetails?.(booking.id);
                              }}
                              className="px-4 py-2 hover:bg-neutral-50 font-medium text-neutral-700 w-full text-left"
                            >
                              View details
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* Pagination footer */}
        {businessId && pagination && (
          <div className="bg-[#FAFAF8] border-t border-[#E8E8E6] p-4 flex items-center justify-between text-xs font-poppins text-[#888780] select-none">
            <span>{pagination.total} {pagination.total === 1 ? "booking" : "bookings"}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="w-8 h-8 rounded-lg bg-white border border-neutral-800 text-neutral-800 flex items-center justify-center font-semibold">
                {page}
              </span>
              <button
                onClick={() => setPage((p) => (p * PAGE_SIZE < pagination.total ? p + 1 : p))}
                disabled={page * PAGE_SIZE >= pagination.total}
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      </div></main>
  );
}
