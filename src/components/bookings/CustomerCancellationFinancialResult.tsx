"use client";

import React from "react";
import type { BookingDetail } from "@/lib/api/bookings";
import { useCustomerBookingDetailQuery } from "@/lib/bookings/hooks";
import { presentCancellation } from "@/lib/bookings/customer-financial";
import CustomerFinancialRows from "./CustomerFinancialRows";
import CustomerFinancialOutcome from "./CustomerFinancialOutcome";

/** Uses the existing owned detail cache. The mutation result is a last-recorded fallback only. */
export default function CustomerCancellationFinancialResult({ booking }: { booking: BookingDetail }) {
  const query = useCustomerBookingDetailQuery(booking.id);
  const current = query.data ?? booking;
  return <div className="flex flex-col gap-3 mb-6 max-h-[50vh] overflow-y-auto">
    <CustomerFinancialRows rows={presentCancellation(current.cancellationOutcome)} />
    {query.isFetching && <p role="status" className="text-xs text-[#4E5F78]">Refreshing the recorded financial outcome…</p>}
    {query.isError && <p role="status" className="text-xs text-[#4E5F78]">The latest financial outcome could not be loaded. Showing the last recorded information.</p>}
    <CustomerFinancialOutcome booking={current} />
    <p className="text-xs text-[#4E5F78]">Appointment cancellation and financial settlement are separate outcomes.</p>
  </div>;
}
