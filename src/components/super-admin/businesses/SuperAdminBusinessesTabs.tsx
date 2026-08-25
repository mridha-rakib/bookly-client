"use client";

import React from "react";
import type { BusinessStatus } from "@/lib/api/superAdminBusiness";

type StatusFilter = "All" | BusinessStatus;

interface SuperAdminBusinessesTabsProps {
  activeStatusFilter: StatusFilter;
  setActiveStatusFilter: (filter: StatusFilter) => void;
  counts: Record<BusinessStatus, number> & { ALL: number };
}

const TAB_LABELS: Record<StatusFilter, string> = {
  All: "All",
  APPROVED: "Approved",
  PENDING: "Pending",
  WARNING: "Warning",
  SUSPENDED: "Suspended",
};

export default function SuperAdminBusinessesTabs({
  activeStatusFilter,
  setActiveStatusFilter,
  counts,
}: SuperAdminBusinessesTabsProps) {
  const tabs: StatusFilter[] = ["All", "APPROVED", "PENDING", "WARNING", "SUSPENDED"];

  return (
    <div className="flex items-center gap-4 w-full border-b border-[#E5E7EB] pb-px overflow-x-auto">
      {tabs.map((filter) => {
        const isActive = activeStatusFilter === filter;
        const badgeBg =
          filter === "APPROVED"
            ? "bg-[#16A34A]"
            : filter === "PENDING"
              ? "bg-[#D97706]"
              : filter === "WARNING"
                ? "bg-[#DC2626]"
                : "bg-[#6B7280]";
        const count = filter === "All" ? counts.ALL : counts[filter];

        return (
          <button
            key={filter}
            onClick={() => setActiveStatusFilter(filter)}
            className={`flex items-center gap-2 pb-2.5 px-1.5 text-sm font-medium transition-all duration-150 border-b-2 whitespace-nowrap cursor-pointer bg-transparent border-t-0 border-x-0 ${
              isActive
                ? "border-[#6366F1] text-[#6366F1]"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>{TAB_LABELS[filter]}</span>
            <span className={`px-2 py-0.5 text-[11px] font-bold text-white rounded-full ${badgeBg}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
