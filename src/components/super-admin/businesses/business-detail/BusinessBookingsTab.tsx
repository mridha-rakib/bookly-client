"use client";

import React, { useState } from "react";
import SuperAdminBookingsTable from "../../bookings/SuperAdminBookingsTable";
import SuperAdminBookingDrawer from "../../bookings/SuperAdminBookingDrawer";
import { useSuperAdminBookingsQuery } from "@/lib/superAdminBookings/hooks";

interface BusinessBookingsTabProps {
  businessId: string;
}

const PAGE_SIZE = 20;

/** Batch 11 — reuses the SAME global, cross-business-safe Super Admin Bookings read path
 * (GET /super-admin/bookings) scoped to this one businessId, rather than a second query builder
 * or bypassing the Business-scoped booking route's own authorization. Read-only: Super Admin has
 * no write endpoint for booking lifecycle actions — those stay exactly where they already are
 * (the Business Owner's own booking routes). */
export default function BusinessBookingsTab({ businessId }: BusinessBookingsTabProps) {
  const [page, setPage] = useState(1);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useSuperAdminBookingsQuery({
    businessId,
    page,
    limit: PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-6 w-full font-sans text-gray-900">
      {isError && (
        <div className="p-8 text-center text-rose-500 bg-white rounded-xl border border-gray-100">
          Failed to load bookings for this business.
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
          onSelectBooking={(id) => setSelectedBookingId(id)}
          pagination={data.pagination}
          onPageChange={setPage}
        />
      )}

      <SuperAdminBookingDrawer bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />
    </div>
  );
}
