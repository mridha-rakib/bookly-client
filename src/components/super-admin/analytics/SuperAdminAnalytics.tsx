"use client";

import React, { useState } from "react";
import SuperAdminAnalyticsOverview from "./SuperAdminAnalyticsOverview";
import SuperAdminBookingsAnalytics from "../bookings/SuperAdminBookingsAnalytics";
import SuperAdminBusinessesAnalytics from "../businesses/SuperAdminBusinessesAnalytics";
import SuperAdminCustomersAnalytics from "../customers/SuperAdminCustomersAnalytics";
import SuperAdminCitiesAnalytics from "./SuperAdminCitiesAnalytics";
import ReportingCityDayFilters, { describeCityDay, type ReportingCityDay } from "../ReportingCityDayFilters";
import {
  PLATFORM_REPORTING_TIMEZONE,
  PLATFORM_REPORTING_TIMEZONE_LABEL,
  platformLastMonth,
  platformMonthToDate,
} from "@/lib/superAdminDashboard/period";

type AnalyticsTab = "Overview" | "Bookings" | "Businesses" | "Customers" | "Cities";

interface SuperAdminAnalyticsProps {
  setActiveTab?: (tab: string) => void;
}

export default function SuperAdminAnalytics({ setActiveTab }: SuperAdminAnalyticsProps) {
  const [activeSubTab, setActiveSubTab] = useState<AnalyticsTab>("Overview");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const handleApplyRange = () => {
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
  };

  // P2.2.1 — presets are Cyprus calendar months (Europe/Nicosia), independent of the browser.
  const handlePresetLastMonth = () => {
    const { fromDate: fromStr, toDate: toStr } = platformLastMonth();
    setFromDate(fromStr);
    setToDate(toStr);
    setAppliedFromDate(fromStr);
    setAppliedToDate(toStr);
  };

  const handlePresetThisMonth = () => {
    const { fromDate: fromStr, toDate: toStr } = platformMonthToDate();
    setFromDate(fromStr);
    setToDate(toStr);
    setAppliedFromDate(fromStr);
    setAppliedToDate(toStr);
  };

  const handlePresetAllTime = () => {
    setFromDate("");
    setToDate("");
    setAppliedFromDate("");
    setAppliedToDate("");
  };

  const subTabs: AnalyticsTab[] = ["Overview", "Bookings", "Businesses", "Customers", "Cities"];

  // Inclusive Cyprus calendar dates; the API converts them to Europe/Nicosia day boundaries.
  // P2.2.4 — City (registered Business city) and Day (Cyprus day of week) join the period, so
  // every period-bound view sends the same contract as the Overview.
  const [cityDay, setCityDay] = useState<ReportingCityDay>({});
  const period = {
    ...(appliedFromDate ? { fromDate: appliedFromDate } : {}),
    ...(appliedToDate ? { toDate: appliedToDate } : {}),
    ...(cityDay.city ? { city: cityDay.city } : {}),
    ...(cityDay.day ? { day: cityDay.day } : {}),
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-12 font-sans">
      {/* Title & Top Filter Row */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 w-full border-b border-gray-100 pb-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-2xl text-[#111827] leading-[32px]">
            Analytics
          </h2>
          <span className="text-sm text-[#4E5F78]">
            Platform-wide performance and growth insights · dates in {PLATFORM_REPORTING_TIMEZONE_LABEL} ({PLATFORM_REPORTING_TIMEZONE})
          </span>
          {(cityDay.city || cityDay.day) && (
            <span className="text-xs text-[#4E5F78]" data-testid="analytics-scope-note">
              Filtered: {describeCityDay(cityDay)}. Bookings, revenue, top services and business
              metrics follow it; customer metrics are platform-wide.
            </span>
          )}
        </div>

        {/* Filters Controls block */}
        <div className="grid grid-cols-1 gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-[0px_2px_8px_rgba(0,0,0,0.03)] w-full xl:flex xl:flex-row xl:items-center xl:w-auto">
          {/* Preset Buttons Group */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
            <button
              onClick={handlePresetLastMonth}
              className="border border-[#111111] text-[#111111] bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors text-center w-full sm:w-auto"
            >
              Last Month
            </button>
            <button
              onClick={handlePresetThisMonth}
              className="border border-[#111111] text-[#111111] bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors text-center w-full sm:w-auto"
            >
              This Month
            </button>
          </div>

          <div className="hidden xl:block w-px h-5 bg-gray-200" />

          {/* Date range inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center w-full xl:flex xl:items-center xl:w-auto">
            <div className="flex items-center gap-2 w-full">
              <span className="text-xs text-gray-500 font-normal w-8 sm:w-auto">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7] cursor-pointer flex-1 xl:flex-initial xl:w-36"
              />
            </div>

            <div className="flex items-center gap-2 w-full">
              <span className="text-xs text-gray-500 font-normal w-8 sm:w-auto">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7] cursor-pointer flex-1 xl:flex-initial xl:w-36"
              />
            </div>

            <button
              onClick={handleApplyRange}
              className="border border-[#111111] text-[#111111] hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors w-full sm:w-auto text-center"
            >
              Apply
            </button>
          </div>

          <div className="hidden xl:block w-px h-5 bg-gray-200" />

          <ReportingCityDayFilters
            value={cityDay}
            onChange={setCityDay}
            className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7]"
          />

          <div className="hidden xl:block w-px h-5 bg-gray-200" />

          <button
            onClick={handlePresetAllTime}
            className="bg-[#111111] hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors w-full xl:w-auto text-center"
          >
            All time
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-4 border-b border-gray-200 pb-px overflow-x-auto bg-transparent">
        {subTabs.map((tab) => {
          const isActive = activeSubTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`pb-2.5 px-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 text-center ${
                isActive
                  ? "border-[#6366F1] text-[#6366F1] font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Active Tab View Content */}
      {activeSubTab === "Overview" && <SuperAdminAnalyticsOverview period={period} />}
      {activeSubTab === "Bookings" && <SuperAdminBookingsAnalytics period={period} />}
      {activeSubTab === "Businesses" && <SuperAdminBusinessesAnalytics period={period} />}
      {activeSubTab === "Customers" && <SuperAdminCustomersAnalytics period={period} />}
      {activeSubTab === "Cities" && <SuperAdminCitiesAnalytics setActiveTab={setActiveTab} period={period} />}
    </div>
  );
}
