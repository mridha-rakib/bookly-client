import React from "react";
import type { BookingDetail } from "@/lib/api/bookings";
import { presentFinancialOutcome } from "@/lib/bookings/customer-financial";
import CustomerFinancialRows from "./CustomerFinancialRows";

export default function CustomerFinancialOutcome({ booking }: { booking: BookingDetail }) {
  return <div className="flex flex-col gap-3 text-sm">
    <CustomerFinancialRows rows={presentFinancialOutcome(booking.financialOutcome)} />
  </div>;
}
