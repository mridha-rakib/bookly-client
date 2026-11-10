"use client";

import React, { useMemo, useState } from "react";
import SuperAdminOverviewBanner from "./SuperAdminOverviewBanner";
import SuperAdminStatsGrid from "./SuperAdminStatsGrid";
import SuperAdminAttentionSection from "./SuperAdminAttentionSection";
import SuperAdminCityCoverage from "../analytics/SuperAdminCityCoverage";
import SuperAdminTopServices from "./SuperAdminTopServices";
import SuperAdminRecentActivity from "./SuperAdminRecentActivity";
import ReportingCityDayFilters, {
  describeCityDay,
  type ReportingCityDay,
} from "../ReportingCityDayFilters";
import {
  describeOverviewPeriod,
  type OverviewPeriodSelection,
  type OverviewPeriodUnit,
  platformToday,
  resolveOverviewPeriod,
} from "@/lib/superAdminDashboard/period";

interface SuperAdminDashboardContentProps {
  setActiveTab?: (tab: string) => void;
}

const FIRST_YEAR = 2025;
const selectClass =
  "bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7]";

/**
 * P1.9 (G5) — every Overview filter either drives the API or is visibly disabled:
 * - Period (this week/month/quarter), Year and All time are one selection, sent to
 *   /super-admin/dashboard/summary and /analytics/top-services as inclusive Cyprus calendar
 *   dates; the API turns them into Europe/Nicosia `[from, to)` boundaries (P2.2.1, E17). They affect only Bookings (created in the
 *   period), No-shows/Cancellations, Platform Revenue and Top services; every other card is
 *   labelled current-state or all-time.
 * - P2.2.4 — City = registered Business city; Day = Cyprus day of week of each metric's own
 *   event timestamp. Both compose with the period on the server; each card states its scope.
 */
export default function SuperAdminDashboardContent({ setActiveTab }: SuperAdminDashboardContentProps) {
  const [selection, setSelection] = useState<OverviewPeriodSelection>({ kind: "ALL_TIME" });
  const period = useMemo(() => resolveOverviewPeriod(selection), [selection]);
  const [cityDay, setCityDay] = useState<ReportingCityDay>({});
  const currentYear = platformToday().year;
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
          <ReportingCityDayFilters value={cityDay} onChange={setCityDay} className={selectClass} />

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
        Period: {describeOverviewPeriod(period)}
        {describeCityDay(cityDay) ? ` · ${describeCityDay(cityDay)}` : ""}. Period and Day apply to
        Bookings, No-shows / Cancellations, Platform Revenue and Top services; City (registered
        Business city) also applies to Businesses and Pending Payouts. Customers and Completed
        Payouts are platform-wide.
      </p>

      {/* 1. Sea Green Recovery Banner */}
      <SuperAdminOverviewBanner />

      {/* 2. Stats Grid */}
      <SuperAdminStatsGrid period={period} filters={cityDay} />

      {/* 3. Needs your attention */}
      <SuperAdminAttentionSection setActiveTab={setActiveTab} />

      {/* 4. Two columns split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full">
        {/* City Coverage table */}
        <SuperAdminCityCoverage />

        {/* Top Services chart */}
        <SuperAdminTopServices period={period} filters={cityDay} />
      </div>

      {/* 5. Recent Activity */}
      <SuperAdminRecentActivity />
    </div>
  );
}
