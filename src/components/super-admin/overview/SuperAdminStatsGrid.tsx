"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SaveMoneyDollarIcon, Store01Icon, UserGroup03Icon, Calendar01Icon } from "@hugeicons/core-free-icons";
import { formatBookingMoney } from "@/lib/bookings/format";
import { useSuperAdminDashboardSummaryQuery } from "@/lib/superAdminDashboard/hooks";
import { useSuperAdminPendingPayoutsQuery } from "@/lib/superAdminFinance/hooks";

/** Batch 11 — every number here comes straight from GET /super-admin/dashboard/summary (one
 * server-side aggregation) or the existing pending-payouts primitive the Finance tab already
 * uses — never a metric requiring undefined semantics (rating, returning-customer rate,
 * no-show rate — none of those are computed anywhere in this codebase yet). */
export default function SuperAdminStatsGrid() {
  const { data: summary, isLoading } = useSuperAdminDashboardSummaryQuery();
  const { data: pendingPayouts } = useSuperAdminPendingPayoutsQuery();

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 min-h-[120px] animate-pulse" />
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: "Total Businesses",
      value: summary.businesses.total.toLocaleString(),
      sub: `Approved: ${summary.businesses.APPROVED} · Pending: ${summary.businesses.PENDING}`,
      icon: Store01Icon,
    },
    {
      title: "Total Customers",
      value: summary.customers.total.toLocaleString(),
      sub: "Platform-wide, all statuses",
      icon: UserGroup03Icon,
    },
    {
      title: "Total Bookings",
      value: summary.bookings.total.toLocaleString(),
      sub: `Upcoming: ${summary.bookings.UPCOMING} · Completed: ${summary.bookings.COMPLETED}`,
      icon: Calendar01Icon,
    },
    {
      title: "Pending Payouts",
      value: formatBookingMoney(summary.pendingBusinessPayableCents),
      sub: pendingPayouts ? `${pendingPayouts.businessCount} Business awaiting payout` : "—",
      icon: SaveMoneyDollarIcon,
    },
  ];

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="bg-white rounded-xl p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-2 min-h-[120px]"
          >
            <div className="flex justify-between items-center w-full">
              <span className="font-sans font-medium text-[13px] text-gray-500 leading-4">{stat.title}</span>
              <HugeiconsIcon icon={stat.icon} className="w-5 h-5 text-gray-400" />
            </div>
            <span className="font-sans font-bold text-[32px] leading-[35px] text-[#195156]">{stat.value}</span>
            <span className="font-sans font-normal text-xs text-gray-400 mt-auto leading-4">{stat.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
        <div className="bg-white rounded-xl p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-2 min-h-[120px]">
          <span className="font-sans font-medium text-[13px] text-gray-500 leading-4">Platform Revenue</span>
          <span className="font-sans font-bold text-[32px] leading-[35px] text-[#195156]">
            {formatBookingMoney(summary.platformRevenueCents)}
          </span>
          <span className="font-sans font-normal text-xs text-gray-400 mt-auto leading-4">
            All time · platform fees, net of processing costs
          </span>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-2 min-h-[120px]">
          <span className="font-sans font-medium text-[13px] text-gray-500 leading-4">No-shows / Cancellations</span>
          <span className="font-sans font-bold text-[32px] leading-[35px] text-[#195156]">
            {(
              summary.bookings.NO_SHOW_CHARGED +
              summary.bookings.NO_SHOW_WAIVED +
              summary.bookings.NO_SHOW_CANCELLED
            ).toLocaleString()}{" "}
            /{" "}
            {(
              summary.bookings.CANCELLED_BY_CUSTOMER +
              summary.bookings.CANCELLED_BY_BUSINESS +
              summary.bookings.LATE_CANCELLATION
            ).toLocaleString()}
          </span>
          <span className="font-sans font-normal text-xs text-gray-400 mt-auto leading-4">All time · platform-wide</span>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-2 min-h-[120px]">
          <span className="font-sans font-medium text-[13px] text-gray-500 leading-4">Completed Payouts</span>
          <span className="font-sans font-bold text-[32px] leading-[35px] text-[#195156]">
            {formatBookingMoney(summary.completedPayoutsAllTimeCents)}
          </span>
          <span className="font-sans font-normal text-xs text-gray-400 mt-auto leading-4">
            All time · already sent to Businesses
          </span>
        </div>
      </div>
    </div>
  );
}
