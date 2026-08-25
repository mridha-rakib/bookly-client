"use client";

import React from "react";
import type { SuperAdminBookingListItem } from "@/lib/api/superAdminBookings";
import { BOOKING_STATUS_LABELS, bookingClientBadge, formatBookingDate, formatBookingMoney, formatBookingTime } from "@/lib/bookings/format";

interface SuperAdminBookingsTableProps {
  bookings: SuperAdminBookingListItem[];
  onSelectBooking: (bookingId: string, businessName: string) => void;
  pagination: { page: number; limit: number; total: number };
  onPageChange: (page: number) => void;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  UPCOMING: "bg-[#EEF2FF] text-[#4338CA]",
  COMPLETED: "bg-emerald-50 text-[#16A34A]",
  PENDING: "bg-amber-50 text-[#A36116]",
  NO_SHOW_CHARGED: "bg-rose-50 text-[#A31616]",
  NO_SHOW_WAIVED: "bg-gray-50 text-gray-500",
  NO_SHOW_CANCELLED: "bg-gray-50 text-gray-500",
  CANCELLED_BY_CUSTOMER: "bg-rose-50 text-[#A31616]",
  CANCELLED_BY_BUSINESS: "bg-rose-50 text-[#A31616]",
  LATE_CANCELLATION: "bg-amber-50 text-[#A36116]",
};

const CLIENT_BADGE_CLASS: Record<string, string> = {
  New: "bg-[#ECECFC] text-[#6366F1]",
  Manual: "bg-[#FEF6C7] text-[#323232]",
  Returning: "bg-[#E3E3E3] text-[#323232]",
};

export default function SuperAdminBookingsTable({
  bookings,
  onSelectBooking,
  pagination,
  onPageChange,
}: SuperAdminBookingsTableProps) {
  const from = bookings.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-visible w-full">
      <div className="overflow-x-auto lg:overflow-visible w-full min-h-[280px]">
        <table className="w-full text-left font-sans text-xs border-collapse">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-gray-200">
              <th className="p-4 font-semibold text-gray-700 whitespace-nowrap">Booking</th>
              <th className="p-4 font-semibold text-gray-700 whitespace-nowrap">Customer</th>
              <th className="p-4 font-semibold text-gray-700 whitespace-nowrap">Service</th>
              <th className="p-4 font-semibold text-gray-700 whitespace-nowrap">Date/Time</th>
              <th className="p-4 font-semibold text-gray-700 whitespace-nowrap text-center">Amount</th>
              <th className="p-4 font-semibold text-gray-700 whitespace-nowrap">Business</th>
              <th className="p-4 font-semibold text-gray-700 whitespace-nowrap text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bookings.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400">
                  No bookings match these filters.
                </td>
              </tr>
            )}
            {bookings.map((b) => {
              const badge = bookingClientBadge(b.source, b.platformFeeCents);
              return (
                <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-medium text-gray-900 whitespace-nowrap">
                    <button
                      onClick={() => onSelectBooking(b.id, b.businessName)}
                      className="hover:underline hover:text-[#6366F1] font-semibold transition-colors cursor-pointer text-left focus:outline-none"
                    >
                      {b.reference}
                    </button>
                  </td>

                  <td className="p-4 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-semibold text-sm text-[#6366F1]">{b.customerName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CLIENT_BADGE_CLASS[badge]}`}>
                        {badge}
                      </span>
                    </div>
                  </td>

                  <td className="p-4 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-sm text-gray-900">{b.primaryServiceName}</span>
                      {b.serviceCount > 1 && <span className="text-xs text-gray-500">+{b.serviceCount - 1} more</span>}
                      <span className="text-xs text-gray-500">{b.staffNames.join(", ")}</span>
                    </div>
                  </td>

                  <td className="p-4 text-gray-900 font-normal whitespace-nowrap">
                    {formatBookingDate(b.schedule.startAt, b.schedule.timezone)} ·{" "}
                    {formatBookingTime(b.schedule.startAt, b.schedule.timezone)}
                  </td>

                  <td className="p-4 text-center text-gray-900 font-normal whitespace-nowrap">
                    {formatBookingMoney(b.totalCents)}
                  </td>

                  <td className="p-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{b.businessName}</span>
                  </td>

                  <td className="p-4 text-center whitespace-nowrap">
                    <span className={`inline-block px-2.5 py-1 text-[11px] font-semibold rounded-full ${STATUS_BADGE_CLASS[b.status] ?? "bg-gray-50 text-gray-500"}`}>
                      {BOOKING_STATUS_LABELS[b.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 bg-white font-sans text-xs text-gray-500">
        <span>{pagination.total === 0 ? "No results" : `Showing ${from}-${to} of ${pagination.total}`}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page * pagination.limit >= pagination.total}
            className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
