"use client";
import DashboardHeader from "@/components/dashboard/DashboardHeader";


import React, { useMemo, useState } from "react";
import { useMyBusinessProfileQuery } from "@/lib/business/hooks";
import { useDashboardAnalyticsQuery } from "@/lib/dashboardAnalytics/hooks";
import type {
  DashboardAnalyticsBookingStatus,
  DashboardAnalyticsDayOfWeek,
  DashboardAnalyticsPeriod,
} from "@/lib/api/dashboardAnalytics";
import { formatEuro } from "@/lib/services/format";

interface DashboardAnalyticsProps {
  onBookingStatusClick?: () => void;
}

/** Business-facing label + bar color per real BookingStatus — mirrors the "Bookings by status"
 * panel's original mock copy/colors exactly, just driven by real per-status counts now. Only
 * the 7 "outcome" statuses the backend returns for this panel (UPCOMING/PENDING are excluded
 * there — see api's dashboard-analytics.types.ts). */
const STATUS_PANEL_META: Record<DashboardAnalyticsBookingStatus, { label: string; color: string }> = {
  UPCOMING: { label: "Upcoming", color: "#B7D2C8" },
  PENDING: { label: "Pending resolution", color: "#B7D2C8" },
  COMPLETED: { label: "Completed", color: "#52A47F" },
  CANCELLED_BY_CUSTOMER: { label: "Cancelled by customer", color: "#ECA747" },
  CANCELLED_BY_BUSINESS: { label: "Cancelled by business", color: "#9B6D2E" },
  LATE_CANCELLATION: { label: "Late cancellation", color: "#8572D7" },
  NO_SHOW_CHARGED: { label: "No-show · charged", color: "#C84F49" },
  NO_SHOW_WAIVED: { label: "No-show · waived", color: "#AFE4D3" },
  NO_SHOW_CANCELLED: { label: "No-show · cancelled", color: "#AFE4D3" },
};

const WEEKDAY_LABELS: Record<DashboardAnalyticsDayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

/** None/Low/Medium/High/Busiest — the SAME 5-step legend the original mock heatmap already
 * defined; buckets are computed from each weekday's real count relative to the period's busiest
 * weekday (never a fabricated intensity). */
const heatmapColorFor = (count: number, maxCount: number): string => {
  if (count <= 0 || maxCount <= 0) return "#F4F2ED"; // None
  const ratio = count / maxCount;
  if (ratio <= 0.2) return "#DEEFF2"; // Low
  if (ratio <= 0.45) return "#A7D5DD"; // Medium
  if (ratio <= 0.75) return "#4F95A1"; // High
  return "#0F141A"; // Busiest
};

const formatPercent = (value: number, digits = 0): string => `${(value * 100).toFixed(digits)}%`;

const formatChangePercent = (changePercent: number | null): { text: string; color: string } => {
  if (changePercent === null) {
    return { text: "No comparison available", color: "#3F413D" };
  }
  const rounded = Math.round(changePercent);
  const sign = rounded >= 0 ? "+" : "";
  return { text: `${sign}${rounded}%`, color: rounded >= 0 ? "#4FA17F" : "#B24D45" };
};

export default function DashboardAnalytics({ onBookingStatusClick }: DashboardAnalyticsProps) {
  const [period, setPeriod] = useState<DashboardAnalyticsPeriod>("MONTH");

  const businessQuery = useMyBusinessProfileQuery();
  const businessId = businessQuery.data?.primary?.id;
  const analyticsQuery = useDashboardAnalyticsQuery(businessId, period);
  const analytics = analyticsQuery.data;

  const totalBookingsChange = useMemo(
    () => (analytics ? formatChangePercent(analytics.totalBookingsChangePercent) : null),
    [analytics],
  );

  const avgBookingValueChangeInfo = useMemo(() => {
    if (!analytics) return null;
    if (analytics.avgBookingValueChangeCents === null) {
      return { text: "No comparison available", color: "#3F413D" };
    }
    const cents = analytics.avgBookingValueChangeCents;
    const sign = cents >= 0 ? "+" : "-";
    return {
      text: `${sign}${formatEuro(Math.abs(cents))} vs last period`,
      color: cents >= 0 ? "#4FA17F" : "#B24D45",
    };
  }, [analytics]);

  const topServicesMaxCount = useMemo(() => {
    if (!analytics || analytics.topServices.length === 0) return 0;
    return Math.max(...analytics.topServices.map((service) => service.count));
  }, [analytics]);

  const statusRows = useMemo(() => {
    if (!analytics) return [];
    const maxCount = Math.max(...analytics.bookingsByStatus.map((row) => row.count), 0);
    return analytics.bookingsByStatus.map((row) => ({
      ...row,
      maxCount,
      meta: STATUS_PANEL_META[row.status],
    }));
  }, [analytics]);

  const busiestDaysMax = useMemo(() => {
    if (!analytics) return 0;
    return Math.max(...analytics.busiestDays.map((row) => row.count), 0);
  }, [analytics]);

  const isLoading = businessQuery.isLoading || analyticsQuery.isLoading;

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">

      {/* Header Row */}
      <DashboardHeader title="Analytics" subtitle="Performance, revenue, and booking trends" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

      {/* Main Content Alignment Wrapper */}
      <div className="flex flex-col gap-6 w-full">

        {/* Filters Row */}
        <div className="flex flex-row items-center gap-3 w-full h-[48px]">
          <div className="relative flex-grow max-w-[200px]">
            <select
              value={period === "ALL" ? "MONTH" : period}
              onChange={(e) => setPeriod(e.target.value as DashboardAnalyticsPeriod)}
              className="appearance-none h-[48px] w-full bg-white border border-[#B7D2C8] rounded-[12px] px-4 font-poppins font-semibold text-[14px] leading-[16px] text-center text-black focus:outline-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23111111' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
                backgroundSize: '16px'
              }}
            >
              <option value="MONTH">This month</option>
              <option value="YEAR">This year</option>
            </select>
          </div>

          <div className="relative flex-grow max-w-[200px]">
            <select
              disabled
              value="current"
              className="appearance-none h-[48px] w-full bg-[#F1F0EA] border border-[#B7D2C8] rounded-[12px] px-4 font-poppins font-semibold text-[14px] leading-[16px] text-center text-[#5B5D58] focus:outline-none cursor-not-allowed"
            >
              <option value="current">
                {analytics
                  ? new Date(analytics.range.from).toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </option>
            </select>
          </div>

          <button
            onClick={() => setPeriod("ALL")}
            className={`flex flex-row justify-center items-center px-[14px] py-[8px] font-poppins font-semibold text-[14px] leading-[16px] w-[82px] h-[48px] rounded-[12px] transition-colors cursor-pointer shrink-0 ${
              period === "ALL"
                ? "bg-[#111111] hover:bg-black text-[#FFFFFF]"
                : "bg-white border border-[#B7D2C8] text-[#111111] hover:bg-neutral-50"
            }`}
          >
            All time
          </button>
        </div>

        {isLoading || !analytics ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <span className="font-poppins text-sm text-neutral-400">Loading analytics…</span>
          </div>
        ) : (
        <>
        {/* Top Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] w-full mt-2">
          <div className="flex flex-col justify-between p-5 bg-[#F1F0EA] rounded-[14px] h-[129px] w-full">
            <span className="font-poppins font-semibold text-[15px] leading-[22px] tracking-[1.2px] uppercase text-[#61635D]">
              TOTAL BOOKINGS
            </span>
            <div className="flex flex-col mt-1">
              <span className="font-poppins font-semibold text-[32px] leading-[32px] tracking-[-1.44px] text-[#15171C]">
                {analytics.totalBookingsCount}
              </span>
              <span
                className="font-poppins font-semibold text-[14px] leading-[18px] mt-1.5"
                style={{ color: totalBookingsChange?.color ?? "#3F413D" }}
              >
                {totalBookingsChange?.text}
                {analytics.totalBookingsChangePercent !== null &&
                  ` ${period === "YEAR" ? "vs last year" : "vs last month"}`}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between p-5 bg-[#F1F0EA] rounded-[14px] h-[129px] w-full">
            <span className="font-poppins font-semibold text-[15px] leading-[22px] tracking-[1.2px] uppercase text-[#61635D]">
              NEW CUSTOMERS
            </span>
            <div className="flex flex-col mt-1">
              <span className="font-poppins font-semibold text-[32px] leading-[32px] tracking-[-1.44px] text-[#51A482]">
                {analytics.newCustomersCount}
              </span>
              <span className="font-poppins font-semibold text-[14px] leading-[18px] mt-1.5 text-[#3F413D]">
                First time at your business
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between p-5 bg-[#F1F0EA] rounded-[14px] h-[129px] w-full">
            <span className="font-poppins font-semibold text-[15px] leading-[22px] tracking-[1.2px] uppercase text-[#61635D]">
              RETURNING CUSTOMERS
            </span>
            <div className="flex flex-col mt-1">
              <span className="font-poppins font-semibold text-[32px] leading-[32px] tracking-[-1.44px] text-[#51A482]">
                {analytics.returningCustomersCount}
              </span>
              <span className="font-poppins font-semibold text-[14px] leading-[18px] mt-1.5 text-[#3F413D]">
                No cost to you
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] w-full">
          <div className="flex flex-col justify-between p-5 rounded-[14px] h-[146px] w-full bg-[#F1F0EA]">
            <span className="font-poppins font-semibold text-[15px] leading-[22px] tracking-[1.2px] uppercase text-[#61635D]">
              COMPLETION RATE
            </span>
            <div className="flex flex-col mt-1">
              <span className="font-poppins font-semibold text-[30px] leading-[30px] tracking-[-1.35px] text-[#15171C]">
                {formatPercent(analytics.completionRate)}
              </span>
              <span className="font-poppins font-semibold text-[14px] leading-[18px] mt-2 text-[#B24D45]">
                {analytics.noShowCount} no-shows
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between p-5 rounded-[14px] h-[146px] w-full bg-[#F1F0EA]">
            <span className="font-poppins font-semibold text-[15px] leading-[22px] tracking-[1.2px] uppercase text-[#61635D]">
              NO-SHOW RATE
            </span>
            <div className="flex flex-col mt-1">
              <span className="font-poppins font-semibold text-[30px] leading-[30px] tracking-[-1.35px] text-[#A9443F]">
                {formatPercent(analytics.noShowRate, 1)}
              </span>
              <span className="font-poppins font-semibold text-[14px] leading-[18px] mt-2 text-[#B24D45]">
                {analytics.noShowChargedCount} charged automatically
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between p-5 rounded-[14px] h-[146px] w-full bg-[#F1F0EA]">
            <span className="font-poppins font-semibold text-[15px] leading-[22px] tracking-[1.2px] uppercase text-[#61635D]">
              AVG. BOOKING VALUE
            </span>
            <div className="flex flex-col mt-1">
              <span className="font-poppins font-semibold text-[30px] leading-[30px] tracking-[-1.35px] text-[#15171C]">
                {formatEuro(analytics.avgBookingValueCents)}
              </span>
              <span
                className="font-poppins font-semibold text-[14px] leading-[18px] mt-2"
                style={{ color: avgBookingValueChangeInfo?.color ?? "#3F413D" }}
              >
                {avgBookingValueChangeInfo?.text}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between p-5 rounded-[14px] h-[146px] w-full bg-[#DFF2EB] border border-[#B8DED0]">
            <span className="font-poppins font-semibold text-[15px] leading-[22px] tracking-[1.2px] uppercase text-[#61635D]">
              REVENUE RECOVERED
            </span>
            <div className="flex flex-col mt-1">
              <span className="font-poppins font-semibold text-[30px] leading-[30px] tracking-[-1.35px] text-[#2E775F]">
                {formatEuro(analytics.revenueRecoveredCents)}
              </span>
              <span className="font-poppins font-semibold text-[14px] leading-[18px] mt-2 text-[#377B65]">
                No-shows &amp; cancellations · yours
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown Panels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full mt-2">
          {/* Top Services Panel */}
          <div className="bg-white border border-[#E1DED6] rounded-[16px] overflow-hidden flex flex-col h-[330px]">
            <div className="box-sizing-border-box flex flex-col justify-center px-5 py-3.5 bg-[#F1F0EA] border-b border-[#E1DED6] w-full h-[52px]">
              <h3 className="font-poppins font-semibold text-[18px] leading-[27px] tracking-[-0.54px] text-[#282A27]">
                Top services by bookings
              </h3>
            </div>

            <div className="flex flex-col justify-center p-6 gap-3.5 w-full h-[278px] overflow-y-auto">
              {analytics.topServices.length === 0 ? (
                <span className="font-poppins text-sm text-neutral-400">No bookings in this period.</span>
              ) : (
                analytics.topServices.map((service) => {
                  const percentage = topServicesMaxCount > 0 ? (service.count / topServicesMaxCount) * 100 : 0;
                  return (
                    <div key={service.serviceId} className="flex flex-row items-center justify-between w-full gap-4">
                      <span className="w-[140px] text-right font-poppins font-medium text-[16px] leading-[24px] text-[#5B5D58] truncate">
                        {service.name}
                      </span>
                      <div className="flex-1 bg-[#F1F0EA] h-[10px] rounded-full overflow-hidden">
                        <div
                          className="bg-[#0F141A] h-full rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-[34px] text-left font-poppins font-semibold text-[16px] leading-[24px] text-[#31332F]">
                        {service.count}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bookings by Status Panel */}
          <div className="bg-white border border-[#E1DED6] rounded-[16px] overflow-hidden flex flex-col h-[330px]">
            <div
              onClick={() => {
                if (onBookingStatusClick) onBookingStatusClick();
              }}
              className="box-sizing-border-box flex flex-row justify-between items-center px-5 py-3.5 bg-[#F1F0EA] border-b border-[#E1DED6] w-full h-[52px] cursor-pointer hover:bg-neutral-100/50 transition-colors"
            >
              <h3 className="font-poppins font-semibold text-[18px] leading-[27px] tracking-[-0.54px] text-[#282A27]">
                Bookings by status
              </h3>
              <span className="font-poppins font-normal text-[11px] leading-[16px] text-[#1C1B1C] hover:underline">
                Booking State &gt;
              </span>
            </div>

            <div className="flex flex-col justify-center p-6 gap-[8px] w-full h-[278px] overflow-y-auto">
              {statusRows.map((row) => {
                const percentage = row.maxCount > 0 ? (row.count / row.maxCount) * 100 : 0;
                return (
                  <div key={row.status} className="flex flex-row items-center justify-between w-full gap-4 text-xs">
                    <span className="w-[170px] text-right font-poppins font-medium text-[14px] leading-[20px] text-[#5B5D58] truncate">
                      {row.meta.label}
                    </span>
                    <div className="flex-1 bg-[#F1F0EA] h-[10px] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: row.meta.color
                        }}
                      />
                    </div>
                    <span className="w-[34px] text-left font-poppins font-semibold text-[14px] leading-[20px] text-[#31332F]">
                      {row.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Busiest Days Heatmap Panel */}
        <div className="w-full bg-white border border-[#E1DED6] rounded-[16px] overflow-hidden flex flex-col">
          <div className="box-sizing-border-box flex flex-col justify-center px-5 py-3.5 bg-[#F1F0EA] border-b border-[#E1DED6] w-full h-[52px]">
            <h3 className="font-poppins font-semibold text-[18px] leading-[27px] tracking-[-0.54px] text-[#282A27]">
              Busiest days — heatmap · updates with selected period
            </h3>
          </div>

          <div className="p-5 flex flex-col gap-4 w-full">

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-3 text-center">
              {analytics.busiestDays.map((row) => (
                <span key={row.dayOfWeek} className="font-poppins font-medium text-[15px] leading-[22px] text-[#5B5D58]">
                  {WEEKDAY_LABELS[row.dayOfWeek]}
                </span>
              ))}
            </div>

            {/* Grid row — one real cell per weekday for the selected period (never a fabricated
                multi-week grid). */}
            <div className="flex flex-col gap-[6px]">
              <div className="grid grid-cols-7 gap-3 h-[34px]">
                {analytics.busiestDays.map((row) => (
                  <div
                    key={row.dayOfWeek}
                    title={`${WEEKDAY_LABELS[row.dayOfWeek]}: ${row.count} booking${row.count === 1 ? "" : "s"}`}
                    className="w-full h-full rounded-[5px] border border-neutral-100"
                    style={{ backgroundColor: heatmapColorFor(row.count, busiestDaysMax) }}
                  />
                ))}
              </div>
            </div>

            {/* Legend row */}
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm font-medium text-[#5B5D58]">
              {/* None */}
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 bg-[#F4F2ED] border border-[#DEDBD3] rounded-[3px]" />
                <span>None</span>
              </div>
              {/* Low */}
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 bg-[#DEEFF2] rounded-[3px]" />
                <span>Low</span>
              </div>
              {/* Medium */}
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 bg-[#A7D5DD] rounded-[3px]" />
                <span>Medium</span>
              </div>
              {/* High */}
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 bg-[#4F95A1] rounded-[3px]" />
                <span>High</span>
              </div>
              {/* Busiest */}
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 bg-[#0F141A] rounded-[3px]" />
                <span>Busiest</span>
              </div>
            </div>

          </div>
        </div>
        </>
        )}

      </div>

      </div></main>
  );
}
