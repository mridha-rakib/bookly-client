"use client";

import React from "react";
import type { SuperAdminBookingTabCounts } from "@/lib/api/superAdminBookings";

export type BookingTabFilter = "All" | "Upcoming" | "Completed" | "Cancelled" | "No-Shows";

interface SuperAdminBookingsTabsProps {
  activeStatusFilter: BookingTabFilter;
  setActiveStatusFilter: (filter: BookingTabFilter) => void;
  counts: SuperAdminBookingTabCounts;
}

export default function SuperAdminBookingsTabs({
  activeStatusFilter,
  setActiveStatusFilter,
  counts,
}: SuperAdminBookingsTabsProps) {
  const tabs: Array<{ key: BookingTabFilter; count: number; color: string }> = [
    { key: "All", count: counts.all, color: "bg-[#6B7280]" },
    { key: "Upcoming", count: counts.upcoming, color: "bg-[#6366F1]" },
    { key: "Completed", count: counts.completed, color: "bg-[#16A34A]" },
    { key: "Cancelled", count: counts.cancelled, color: "bg-[#A31616]" },
    { key: "No-Shows", count: counts.noShow, color: "bg-[#A36116]" },
  ];

  return (
    <div className="flex items-center gap-4 w-full border-b border-[#E5E7EB] pb-px overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = activeStatusFilter === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => setActiveStatusFilter(tab.key)}
            className={`flex items-center gap-2 pb-2.5 px-1.5 text-sm font-medium transition-all duration-150 border-b-2 whitespace-nowrap cursor-pointer bg-transparent border-t-0 border-x-0 ${
              isActive ? "border-[#6366F1] text-[#6366F1]" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>{tab.key}</span>
            <span className={`px-2 py-0.5 text-[11px] font-bold text-white rounded-full ${tab.color}`}>
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
