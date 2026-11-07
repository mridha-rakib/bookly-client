"use client";

import React, { useMemo, useState } from "react";
import SuperAdminOverviewBanner from "./SuperAdminOverviewBanner";
import SuperAdminStatsGrid from "./SuperAdminStatsGrid";
import SuperAdminAttentionSection from "./SuperAdminAttentionSection";
import SuperAdminCityCoverage from "../analytics/SuperAdminCityCoverage";
import SuperAdminTopServices from "./SuperAdminTopServices";
import SuperAdminRecentActivity from "./SuperAdminRecentActivity";
import {
  describeOverviewPeriod,
  type OverviewPeriodSelection,
  type OverviewPeriodUnit,
  resolveOverviewPeriod,
} from "@/lib/superAdminDashboard/period";

interface SuperAdminDashboardContentProps {
  setActiveTab?: (tab: string) => void;
}

const FIRST_YEAR = 2025;
const selectClass =
  "bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7]";
const disabledSelectClass = `${selectClass} opacity-50 cursor-not-allowed`;

/**
 * P1.9 (G5) — every Overview filter either drives the API or is visibly disabled:
 * - Period (this week/month/quarter), Year and All time are one selection, sent to
 *   /super-admin/dashboard/summary and /analytics/top-services as `[fromDate, toDate)` UTC
 *   instants (the existing analytics period contract). They affect only Bookings (created in the
 *   period), No-shows/Cancellations, Platform Revenue and Top services; every other card is
 *   labelled current-state or all-time.
 * - City and Day are disabled: no approved city dimension (Business city vs service location vs
 *   Customer location) or day-of-week metric contract exists for these figures.
 */
export default function SuperAdminDashboardContent({ setActiveTab }: SuperAdminDashboardContentProps) {
  const [selection, setSelection] = useState<OverviewPeriodSelection>({ kind: "ALL_TIME" });
  const period = useMemo(() => resolveOverviewPeriod(selection), [selection]);
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: Math.max(1, currentYear - FIRST_YEAR + 1) }, (_, i) => currentYear - i);

  return (
    <div className="flex flex-col gap-6 w-full max-w-none pb-12">
      {/* Dashboard Sub-Header Filters Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
        <h2 className="font-sans font-semibold text-2xl text-[#111827] leading-[32px]">
          Dashboard
        </h2>

        {/* Filters buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="City (unavailable)"
            disabled
            value="All"
            title="City filtering needs an approved city definition for these metrics."
            className={disabledSelectClass}
          >
            <option value="All">City</option>
          </select>

          <select
            aria-label="Day (unavailable)"
            disabled
            value="All"
            title="Day-of-week filtering has no defined metric yet."
            className={disabledSelectClass}
          >
            <option value="All">Day</option>
          </select>

          <select
            aria-label="Period"
            value={selection.kind === "CURRENT" ? selection.unit : ""}
            onChange={(e) => {
              if (e.target.value) setSelection({ kind: "CURRENT", unit: e.target.value as OverviewPeriodUnit });
            }}
            className={selectClass}
          >
            <option value="" disabled>Period</option>
            <option value="WEEK">This week</option>
            <option value="MONTH">This month</option>
            <option value="QUARTER">This quarter</option>
          </select>

          <select
            aria-label="Year"
            value={selection.kind === "YEAR" ? String(selection.year) : ""}
            onChange={(e) => {
              if (e.target.value) setSelection({ kind: "YEAR", year: Number(e.target.value) });
            }}
            className={selectClass}
          >
            <option value="" disabled>Year</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>{year}</option>
            ))}
          </select>

          <button
            type="button"
            aria-pressed={selection.kind === "ALL_TIME"}
            onClick={() => setSelection({ kind: "ALL_TIME" })}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-medium transition-all duration-150 ${
              selection.kind === "ALL_TIME"
                ? "bg-[#111111] text-white border border-transparent"
                : "bg-white text-[#314158] border border-[#E2E8F0] hover:bg-gray-50"
            }`}
          >
            All time
          </button>
        </div>
      </div>

      <p className="font-sans text-xs text-gray-500 -mt-3" data-testid="overview-period-note">
        Period: {describeOverviewPeriod(period)}. Applies to Bookings, No-shows / Cancellations,
        Platform Revenue and Top services; other figures are current or all-time. City and Day
        filters are unavailable until their metric definitions are approved.
      </p>

      {/* 1. Sea Green Recovery Banner */}
      <SuperAdminOverviewBanner />

      {/* 2. Stats Grid */}
      <SuperAdminStatsGrid period={period} />

      {/* 3. Needs your attention */}
      <SuperAdminAttentionSection setActiveTab={setActiveTab} />

      {/* 4. Two columns split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full">
        {/* City Coverage table */}
        <SuperAdminCityCoverage />

        {/* Top Services chart */}
        <SuperAdminTopServices period={period} />
      </div>

      {/* 5. Recent Activity */}
      <SuperAdminRecentActivity />
    </div>
  );
}
