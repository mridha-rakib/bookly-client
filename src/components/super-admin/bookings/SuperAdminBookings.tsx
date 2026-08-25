"use client";

import React, { useState } from "react";
import SuperAdminBookingsFilter from "./SuperAdminBookingsFilter";
import SuperAdminBookingsTabs, { type BookingTabFilter } from "./SuperAdminBookingsTabs";
import SuperAdminBookingsTable from "./SuperAdminBookingsTable";
import SuperAdminBookingDrawer from "./SuperAdminBookingDrawer";
import type { BookingStatus } from "@/lib/api/bookings";
import { useSuperAdminBookingsQuery } from "@/lib/superAdminBookings/hooks";
import { CUSTOMER_BOOKING_TAB_STATUSES } from "@/lib/bookings/format";

const PAGE_SIZE = 20;

// The Cancelled/No-Shows tabs reuse the SAME status groupings as the Customer "My Bookings"
// tabs (lib/bookings/format.ts) — one canonical mapping from the real 9-value enum.
const TAB_STATUSES: Record<Exclude<BookingTabFilter, "All">, BookingStatus[]> = {
  Upcoming: CUSTOMER_BOOKING_TAB_STATUSES.upcoming,
  Completed: CUSTOMER_BOOKING_TAB_STATUSES.completed,
  Cancelled: CUSTOMER_BOOKING_TAB_STATUSES.canceled,
  "No-Shows": CUSTOMER_BOOKING_TAB_STATUSES.noshow,
};

export default function SuperAdminBookings() {
  const [activeStatusFilter, setActiveStatusFilter] = useState<BookingTabFilter>("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<{ id: string; businessName: string } | null>(null);

  const { data, isLoading, isError } = useSuperAdminBookingsQuery({
    ...(activeStatusFilter !== "All" ? { status: TAB_STATUSES[activeStatusFilter] } : {}),
    ...(fromDate ? { fromDate: new Date(fromDate).toISOString() } : {}),
    ...(toDate ? { toDate: new Date(toDate).toISOString() } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
    page,
    limit: PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-6 w-full pb-12 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
        <h2 className="font-semibold text-2xl text-[#111827] leading-[32px]">Bookings</h2>
      </div>

      <SuperAdminBookingsTabs
        activeStatusFilter={activeStatusFilter}
        setActiveStatusFilter={(v) => {
          setActiveStatusFilter(v);
          setPage(1);
        }}
        counts={data?.counts ?? { all: 0, upcoming: 0, completed: 0, cancelled: 0, noShow: 0 }}
      />

      <SuperAdminBookingsFilter
        fromDate={fromDate}
        setFromDate={(v) => {
          setFromDate(v);
          setPage(1);
        }}
        toDate={toDate}
        setToDate={(v) => {
          setToDate(v);
          setPage(1);
        }}
        search={search}
        setSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />

      {isError && (
        <div className="p-8 text-center text-rose-500 bg-white rounded-xl border border-gray-100">
          Failed to load bookings. Please try again.
        </div>
      )}

      {isLoading && !data && (
        <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
          Loading bookings…
        </div>
      )}

      {data && (
        <SuperAdminBookingsTable
          bookings={data.bookings}
          onSelectBooking={(id, businessName) => setSelectedBooking({ id, businessName })}
          pagination={data.pagination}
          onPageChange={setPage}
        />
      )}

      <SuperAdminBookingDrawer
        bookingId={selectedBooking?.id ?? null}
        businessName={selectedBooking?.businessName}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  );
}
