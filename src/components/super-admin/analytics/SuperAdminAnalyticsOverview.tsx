"use client";

import React, { useState } from "react";
import type { AnalyticsPeriodParams } from "@/lib/api/superAdminAnalytics";
import { BOOKING_STATUS_LABELS, formatBookingMoney } from "@/lib/bookings/format";
import {
  useSuperAdminBookingAnalyticsQuery,
  useSuperAdminBusinessAnalyticsQuery,
  useSuperAdminCustomerAnalyticsQuery,
} from "@/lib/superAdminAnalytics/hooks";

interface SuperAdminAnalyticsOverviewProps {
  period: AnalyticsPeriodParams;
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: "bg-[#4B9C78]",
  UPCOMING: "bg-[#4E88D7]",
  PENDING: "bg-[#4E88D7]",
  CANCELLED_BY_CUSTOMER: "bg-[#9EA3AE]",
  LATE_CANCELLATION: "bg-[#E4A345]",
  NO_SHOW_CHARGED: "bg-[#D15650]",
  NO_SHOW_WAIVED: "bg-[#F2C981]",
  CANCELLED_BY_BUSINESS: "bg-[#E87975]",
  NO_SHOW_CANCELLED: "bg-[#D2D5DB]",
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function SuperAdminAnalyticsOverview({ period }: SuperAdminAnalyticsOverviewProps) {
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);

  const {
    data: bookingAnalytics,
    isLoading: bookingsLoading,
    isError: bookingsError,
    refetch: refetchBookings,
  } = useSuperAdminBookingAnalyticsQuery(period);
  const { data: businessAnalytics } = useSuperAdminBusinessAnalyticsQuery(period);
  const { data: customerAnalytics } = useSuperAdminCustomerAnalyticsQuery(period);

  if (bookingsError) {
    return (
      <div className="py-8 text-center flex flex-col items-center gap-3">
        <p className="text-sm text-rose-500">Failed to load analytics for this period.</p>
        <button
          onClick={() => void refetchBookings()}
          className="border border-[#111111] text-[#111111] hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (bookingsLoading || !bookingAnalytics) {
    return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;
  }

  const statsRow1 = [
    { label: "Total Bookings", value: bookingAnalytics.totalCount.toLocaleString(), sub: "In selected period" },
    { label: "Bookly Revenue", value: formatBookingMoney(bookingAnalytics.platformRevenueCents), sub: "Platform fees, net" },
    { label: "Customers Registered", value: customerAnalytics ? customerAnalytics.registeredTotal.toLocaleString() : "—", sub: "All time" },
    {
      label: "Active Businesses",
      value: businessAnalytics ? businessAnalytics.statusCounts.APPROVED.toLocaleString() : "—",
      sub: "Currently approved",
    },
  ];

  const statsRow2 = [
    { label: "New Bookings", value: bookingAnalytics.clientTypeSplit.newBooking.toLocaleString(), sub: "Generated a platform fee" },
    { label: "Returning Bookings", value: bookingAnalytics.clientTypeSplit.returning.toLocaleString(), sub: "€0 Bookly fee" },
    { label: "Mobile Bookings", value: bookingAnalytics.fulfilmentSplit.mobile.toLocaleString(), sub: "Travel-to-customer" },
    { label: "Manual Bookings", value: bookingAnalytics.clientTypeSplit.manual.toLocaleString(), sub: "Walk-in, €0 Bookly fee" },
  ];

  const maxMonthCount = Math.max(1, ...bookingAnalytics.monthlySeries.map((m) => m.count));

  const statusSegments = (Object.keys(bookingAnalytics.statusCounts) as Array<keyof typeof bookingAnalytics.statusCounts>)
    .map((status) => ({
      label: BOOKING_STATUS_LABELS[status],
      count: bookingAnalytics.statusCounts[status],
      color: STATUS_COLOR[status] ?? "bg-gray-300",
    }))
    .filter((seg) => seg.count > 0);

  return (
    <div className="flex flex-col gap-6 w-full font-sans">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsRow1.map((item) => (
          <div key={item.label} className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-gray-500">{item.label}</span>
            <span className="text-3xl font-bold text-[#195156]">{item.value}</span>
            <span className="text-xs text-gray-400 font-normal">{item.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsRow2.map((item) => (
          <div key={item.label} className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-gray-500">{item.label}</span>
            <span className="text-3xl font-bold text-[#195156]">{item.value}</span>
            <span className="text-xs text-gray-400 font-normal">{item.sub}</span>
          </div>
        ))}
      </div>

      {/* Monthly Booking Volume Chart */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden flex flex-col w-full">
        <div className="bg-[#F5F5F5] p-4 border-b border-gray-200">
          <h3 className="font-semibold text-base text-[#111111] leading-none">Monthly Booking Volume</h3>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-end justify-between gap-1 sm:gap-2 h-[250px] border-b border-gray-200 pb-2 px-2 overflow-x-auto select-none pt-16">
            {bookingAnalytics.monthlySeries.map((point, idx) => {
              const isSelected = selectedMonthIndex === idx;
              const height = (point.count / maxMonthCount) * 160;

              return (
                <div
                  key={`${point.year}-${point.month}`}
                  onClick={() => setSelectedMonthIndex(isSelected ? null : idx)}
                  className="flex flex-col items-center flex-1 min-w-[38px] group relative cursor-pointer"
                >
                  {isSelected && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] font-semibold py-1.5 px-2.5 rounded-lg shadow-lg z-10 whitespace-nowrap after:content-[''] after:absolute after:top-full after:left-1/2 after:-ml-1 after:border-4 after:border-transparent after:border-t-gray-900 transition-all text-center">
                      {point.count} Bookings
                    </div>
                  )}
                  <div
                    style={{ height: `${Math.max(height, 2)}px` }}
                    className={`w-full rounded-t transition-all duration-200 transform hover:scale-x-105 origin-bottom ${
                      isSelected
                        ? "bg-[#6366F1] shadow-[0px_4px_12px_rgba(99,102,241,0.4)]"
                        : "bg-[#EEF2FF] border border-[#6366F1] hover:bg-[#EEF2FF]/80"
                    }`}
                  />
                  <span className={`text-[11px] mt-2 font-medium transition-colors ${isSelected ? "text-[#6366F1] font-bold" : "text-gray-500"}`}>
                    {MONTH_LABELS[point.month - 1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Booking statuses proportion panel */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden flex flex-col w-full">
        <div className="bg-[#F5F5F5] p-4 border-b border-gray-200">
          <h3 className="font-semibold text-base text-[#111111] leading-none">
            All Booking statuses — {bookingAnalytics.totalCount.toLocaleString()} total bookings in period
          </h3>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {statusSegments.length === 0 ? (
            <p className="text-sm text-gray-400">No bookings in this period.</p>
          ) : (
            <>
              <div className="flex h-5 w-full rounded-md overflow-hidden shrink-0">
                {statusSegments.map((seg) => (
                  <div
                    key={seg.label}
                    className={`${seg.color} h-full transition-opacity hover:opacity-90`}
                    style={{ flexGrow: seg.count }}
                    title={`${seg.label}: ${seg.count}`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 pt-2">
                {statusSegments.map((seg) => (
                  <div key={seg.label} className="flex items-center gap-3 text-[13px] font-medium text-gray-500">
                    <span className={`w-3.5 h-3.5 rounded ${seg.color} shrink-0`} />
                    <span className="truncate flex-1">{seg.label}</span>
                    <span className="font-bold text-gray-900 shrink-0">{seg.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 italic">
        Booking by category is not available: a booking&apos;s service snapshot does not persist a category.
      </p>
    </div>
  );
}
