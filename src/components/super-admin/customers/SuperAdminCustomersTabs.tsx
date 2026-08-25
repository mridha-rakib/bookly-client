"use client";

import React from "react";
import type { CustomerStatus } from "@/lib/api/superAdminCustomers";

type StatusFilter = "All" | CustomerStatus;

interface SuperAdminCustomersTabsProps {
  activeStatusFilter: StatusFilter;
  setActiveStatusFilter: (filter: StatusFilter) => void;
}

const TAB_LABELS: Record<StatusFilter, string> = {
  All: "All",
  ACTIVE: "Active",
  DORMANT: "Dormant",
  SUSPENDED: "Suspended",
};

export default function SuperAdminCustomersTabs({
  activeStatusFilter,
  setActiveStatusFilter,
}: SuperAdminCustomersTabsProps) {
  const tabs: StatusFilter[] = ["All", "ACTIVE", "DORMANT", "SUSPENDED"];

  return (
    <div className="flex items-center gap-4 w-full border-b border-[#E5E7EB] pb-px overflow-x-auto">
      {tabs.map((filter) => {
        const isActive = activeStatusFilter === filter;
        const badgeColor =
          filter === "ACTIVE"
            ? "bg-[#16A34A]"
            : filter === "DORMANT"
              ? "bg-[#A37616]"
              : filter === "SUSPENDED"
                ? "bg-[#DC2626]"
                : "bg-[#6B7280]";

        return (
          <button
            key={filter}
            onClick={() => setActiveStatusFilter(filter)}
            className={`flex items-center gap-2 pb-2.5 px-1.5 text-sm font-medium transition-all duration-150 border-b-2 whitespace-nowrap cursor-pointer bg-transparent border-t-0 border-x-0 ${
              isActive ? "border-[#6366F1] text-[#6366F1]" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>{TAB_LABELS[filter]}</span>
            <span className={`w-2 h-2 rounded-full ${badgeColor}`} />
          </button>
        );
      })}
    </div>
  );
}
