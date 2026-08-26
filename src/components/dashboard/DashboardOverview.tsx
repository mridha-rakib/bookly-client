"use client";
import Image from "next/image";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

import React, { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon } from "@hugeicons/core-free-icons";
import { useMyBusinessProfileQuery } from "@/lib/business/hooks";
import { useBusinessRatingSummaryQuery } from "@/lib/review/hooks";
import { useCurrentUserQuery } from "@/lib/auth/hooks";
import { buildDashboardSubtitle } from "@/utils/dashboardGreeting";
import { useDashboardOverviewQuery } from "@/lib/dashboardOverview/hooks";
import { formatEuro } from "@/lib/services/format";
import { describeActivity } from "@/utils/dashboardActivity";

export default function DashboardOverview() {
  const [timeFilter, setTimeFilter] = useState("Today");
  const [scheduleFilter, setScheduleFilter] = useState("All");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const businessQuery = useMyBusinessProfileQuery();
  const businessId = businessQuery.data?.primary?.id;
  const ratingSummaryQuery = useBusinessRatingSummaryQuery(businessId);
  const ratingSummary = ratingSummaryQuery.data;
  const currentUserQuery = useCurrentUserQuery();
  const overviewQuery = useDashboardOverviewQuery(businessId);
  const overview = overviewQuery.data;
  const financials = overview?.financials ?? null;

  const scheduleData = useMemo(() => {
    if (!overview) return [];
    if (scheduleFilter === "All") return overview.schedule;
    return overview.schedule.filter((row) => {
      const hour = Number(row.time.split(":")[0]);
      const isPM = hour >= 12;
      return scheduleFilter === "PM" ? isPM : !isPM;
    });
  }, [overview, scheduleFilter]);
  const timelineEvents = overview?.timeline ?? [];
  const activityFeed = useMemo(
    () => (financials?.recentActivity ?? []).map((entry) => ({ id: entry.id, ...describeActivity(entry) })),
    [financials],
  );

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] select-none">
      <DashboardHeader title="Dashboard" subtitle={buildDashboardSubtitle(currentUserQuery.data?.profile?.firstName)} />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

      {/* Time Toggle Buttons Row */}
      <div className="flex justify-end mb-6 mt-4 relative">
        <div className="bg-white border border-[#E2E8F0] p-1 rounded-xl shadow-sm flex items-center gap-1">
          {["Today", "7D", "30D", "Custom"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setTimeFilter(tab);
                if (tab === "Custom") {
                  setShowCustomPicker(prev => !prev);
                } else {
                  setShowCustomPicker(false);
                }
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                timeFilter === tab
                  ? "bg-[#F1F5F9] text-[#0F172A] shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {tab === "Custom" && customStartDate && customEndDate
                ? `Custom (${new Date(customStartDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - ${new Date(customEndDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})})`
                : tab}
            </button>
          ))}
        </div>

        {/* Custom Date Range Picker Dropdown */}
        {showCustomPicker && (
          <div className="absolute right-0 top-11 bg-white border border-[#E2E8F0] rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)] p-4 z-40 w-72 flex flex-col gap-3 font-poppins text-left">
            <span className="text-[11px] font-bold text-[#888780] uppercase tracking-wider">Select Date Range</span>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#5F5E5A] font-medium">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="border border-[#ECEBEF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2E9DA7] text-[#0D0D0D] bg-white cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#5F5E5A] font-medium">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="border border-[#ECEBEF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2E9DA7] text-[#0D0D0D] bg-white cursor-pointer"
              />
            </div>
            {customStartDate && customEndDate && (
              <div className="text-[11px] font-medium text-[#2E9DA7] bg-[#2E9DA7]/10 rounded px-2.5 py-1.5 text-center mt-1">
                Selected: {new Date(customStartDate).toLocaleDateString()} – {new Date(customEndDate).toLocaleDateString()}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  setShowCustomPicker(false);
                  setCustomStartDate("");
                  setCustomEndDate("");
                  setTimeFilter("Today");
                }}
                className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-xs font-semibold hover:bg-neutral-50 cursor-pointer text-[#1C1B1C] text-center"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  if (customStartDate && customEndDate) {
                    setShowCustomPicker(false);
                  }
                }}
                className="flex-1 px-3 py-2 bg-[#2E9DA7] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer text-center"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Metric Strip Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-8">
        {/* Card 1 */}
        <div className="bg-white border border-[#D3D3D3] rounded-xl p-4.5 shadow-sm flex flex-col justify-between h-[96px]">
          <span className="text-[11px] font-normal text-[#888780] font-poppins">Today's bookings</span>
          <div className="flex flex-col mt-0.5">
            <span className="text-3xl font-semibold text-[#1A1A1A] leading-none">
              {overview ? overview.todayBookingsCount : "—"}
            </span>
            <span className="text-xs text-[#757575] mt-1.5 font-poppins">
              {overview ? `${overview.todayRemainingCount} remaining` : ""}
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-[#D3D3D3] rounded-xl p-4.5 shadow-sm flex flex-col justify-between h-[96px]">
          <span className="text-[11px] font-normal text-[#888780] font-poppins">To collect today</span>
          <div className="flex flex-col mt-0.5">
            <span className="text-3xl font-semibold text-[#1D9E75] leading-none">
              {financials ? formatEuro(financials.payAtVenueDueCents) : "—"}
            </span>
            <span className="text-xs text-[#757575] mt-1.5 font-poppins">pay at venue</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-[#D3D3D3] rounded-xl p-4.5 shadow-sm flex flex-col justify-between h-[96px]">
          <span className="text-[11px] font-normal text-[#888780] font-poppins">No-shows this month</span>
          <div className="flex flex-col mt-0.5">
            <span className="text-3xl font-semibold text-[#E24B4A] leading-none">
              {financials ? financials.noShowMonthCount : "—"}
            </span>
            <span className="text-xs text-[#757575] mt-1.5 font-poppins">
              {financials ? `${formatEuro(financials.noShowMonthChargedCents)} charged` : ""}
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white border border-[#D3D3D3] rounded-xl p-4.5 shadow-sm flex flex-col justify-between h-[96px]">
          <span className="text-[11px] font-normal text-[#888780] font-poppins">Monthly revenue</span>
          <div className="flex flex-col mt-0.5">
            <span className="text-3xl font-semibold text-[#1D9E75] leading-none">
              {financials ? formatEuro(financials.monthlyRevenueCents) : "—"}
            </span>
            <span className="text-xs text-transparent mt-1.5 select-none font-poppins">-</span>
          </div>
        </div>

        {/* Card 5 — real */}
        <div className="bg-white border border-[#D3D3D3] rounded-xl p-4.5 shadow-sm flex flex-col justify-between h-[96px]">
          <span className="text-[11px] font-normal text-[#888780] font-poppins">Avg Rating</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-3xl font-semibold text-[#1A1A1A] leading-none">
              {ratingSummary?.averageRating !== null && ratingSummary?.averageRating !== undefined
                ? ratingSummary.averageRating.toFixed(1)
                : "—"}
            </span>
            {ratingSummary?.averageRating !== null && ratingSummary?.averageRating !== undefined && (
              <Image src="/businessDashboard/Metric 5 Star.svg" alt="Stars" className="w-5 h-5 object-contain" width={20} height={20} />
            )}
          </div>
          <div className="flex items-center text-[11px] text-[#757575] mt-0.5 font-poppins whitespace-nowrap select-none">
            <span>
              {ratingSummary
                ? `${ratingSummary.reviewCount} verified review${ratingSummary.reviewCount === 1 ? "" : "s"}`
                : "No reviews yet"}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Schedule & Info Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Area: Today's schedule table */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white border border-[#E8E8E6] rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Clock01Icon} className="w-5 h-5 text-[#888780]" />
                <h2 className="text-sm font-medium text-[#5F5E5A] font-poppins">Today's schedule</h2>
              </div>

              {/* Filter toggle buttons */}
              <div className="bg-[#F7F5F1] p-0.5 rounded-lg flex items-center gap-0.5">
                {["All", "AM", "PM"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setScheduleFilter(tab)}
                    className={`px-3 py-1 text-xs font-normal rounded-md transition-all ${
                      scheduleFilter === tab
                        ? "bg-[#0F1E35] text-white"
                        : "text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Table/List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F5F1] border-b border-[#F7F5F1]">
                    <th className="py-2.5 px-4 text-xs font-semibold text-[#5F5E5A] font-poppins">Time</th>
                    <th className="py-2.5 px-4 text-xs font-semibold text-[#5F5E5A] font-poppins">Name & Service</th>
                    <th className="py-2.5 px-4 text-xs font-semibold text-[#5F5E5A] font-poppins">Total Payment</th>
                    <th className="py-2.5 px-4 text-xs font-semibold text-[#5F5E5A] font-poppins">Platform fee</th>
                    <th className="py-2.5 px-4 text-xs font-semibold text-[#5F5E5A] font-poppins">Remaining fee</th>
                    <th className="py-2.5 px-4 text-xs font-semibold text-[#5F5E5A] font-poppins">Staff</th>
                    <th className="py-2.5 px-4 text-xs font-semibold text-[#5F5E5A] font-poppins">Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {scheduleData.map((row) => (
                    <tr key={row.bookingId} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="py-3 px-4 text-xs text-[#888780] font-poppins">{row.time}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-[#1A1A1A] font-poppins">{row.customerName}</span>
                          <span className="text-[11px] text-[#888780] font-poppins">{row.serviceName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#5F5E5A] font-poppins">{formatEuro(row.totalPaymentCents)}</td>
                      <td className="py-3 px-4 text-xs text-[#5F5E5A] font-poppins">{formatEuro(row.platformFeeCents)}</td>
                      <td className="py-3 px-4 text-xs text-[#5F5E5A] font-poppins">{formatEuro(row.remainingFeeCents)}</td>
                      <td className="py-3 px-4 text-xs text-[#5F5E5A] font-poppins">{row.staffName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 text-[11px] font-medium rounded-full whitespace-nowrap ${
                            row.leadType === "NEW_CUSTOMER"
                              ? "bg-[#E1F5EE] text-[#085041]"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {row.leadType === "NEW_CUSTOMER"
                            ? "New customer"
                            : row.leadType === "MANUAL"
                              ? "Manual"
                              : "Returning"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {overview && scheduleData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 px-4 text-xs text-[#888780] font-poppins text-center">
                        No bookings scheduled today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Full Calendar Link (outside the box) */}
          <div className="mt-4">
            <button className="text-xs font-medium text-[#1D9E75] hover:opacity-85 transition-opacity flex items-center gap-1.5 font-poppins">
              <span>View full calendar</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7M3 12h18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right Area: Today's Schedule Timeline & Activity */}
        <div className="space-y-6">
          {/* Today's Schedule Card */}
          <div className="bg-white border border-[#E8E8E6] rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[#0F1E35] font-poppins mb-4">Today's Schedule</h3>
            <div className="space-y-4">
              {timelineEvents.map((evt) => (
                <div key={evt.bookingId} className="flex gap-4 items-start">
                  <span className="bg-[#111111] text-white text-[10px] font-medium px-2 py-1 rounded w-12 text-center shrink-0">
                    {evt.time}
                  </span>
                  <div className="flex flex-col pl-1">
                    <span className="text-xs font-semibold text-[#111111]">{evt.customerName}</span>
                    <span className="text-[11px] text-neutral-500">{evt.detail}</span>
                    <span className="text-[10px] text-amber-600 font-medium mt-0.5">{evt.durationMin} min</span>
                  </div>
                </div>
              ))}
              {overview && timelineEvents.length === 0 && (
                <span className="text-xs text-[#888780] font-poppins">No bookings scheduled today.</span>
              )}
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="bg-white border border-[#E8E8E6] rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Image src="/businessDashboard/Activity.svg" alt="Activity Trend" className="w-8 h-4 object-contain opacity-95" width={32} height={16} />
              <h3 className="text-sm font-semibold text-[#0F1E35] font-poppins">Recent activity</h3>
            </div>

            <div className="space-y-4">
              {activityFeed.map((act) => (
                <div key={act.id} className="flex gap-3 items-start">
                  <div className={`w-8 h-8 rounded-full ${act.bg} flex items-center justify-center shrink-0`}>
                    <HugeiconsIcon icon={act.icon} className={`w-4 h-4 ${act.color}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-neutral-700 font-poppins leading-normal">{act.text}</span>
                    <span className="text-[10px] text-neutral-400 font-poppins mt-0.5">{act.time}</span>
                  </div>
                </div>
              ))}
              {overview && activityFeed.length === 0 && (
                <span className="text-xs text-[#888780] font-poppins">No recent activity yet.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      </div></main>
  );
}
