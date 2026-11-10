"use client";

import {
  describeOverviewPeriod,
  platformLastMonth,
  platformMonthToDate,
  platformRecentDays,
  validatePlatformRange,
} from "@/lib/superAdminDashboard/period";
import React, { useMemo, useState } from "react";
import SuperAdminFinanceBanner from "./SuperAdminFinanceBanner";
import SuperAdminFinanceStats from "./SuperAdminFinanceStats";
import SuperAdminFinancePending from "./SuperAdminFinancePending";
import SuperAdminFinanceLog from "./SuperAdminFinanceLog";
import SuperAdminWithdrawals from "./SuperAdminWithdrawals";
import { useSuperAdminPlatformSummaryQuery } from "@/lib/superAdminFinance/hooks";
import { usePromoDiscountedMoneyQuery } from "@/lib/promo/hooks";

interface SuperAdminFinanceProps {
  setActiveTab?: (tab: string) => void;
  setSharedViewingBusinessId?: (id: string | null) => void;
  setSharedViewingBusinessTab?: (tab: string) => void;
}

const DEFAULT_FINANCE_DAYS = 90;
const FINANCE_MAX_RANGE_DAYS = 92;

export default function SuperAdminFinance({
  setActiveTab,
  setSharedViewingBusinessId,
  setSharedViewingBusinessTab
}: SuperAdminFinanceProps) {
  const [view, setView] = useState<"Overview" | "Withdrawals">("Overview");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  // P2.2.2 (E17) — inclusive Cyprus calendar dates (Europe/Nicosia), never browser-local or UTC
  // arithmetic; the API converts them to the exact `[from, to)` window.
  const [rangeError, setRangeError] = useState<string | null>(null);
  const applyDates = (fromStr: string, toStr: string) => {
    setFromDate(fromStr);
    setToDate(toStr);
    setAppliedFromDate(fromStr);
    setAppliedToDate(toStr);
    setRangeError(null);
  };

  const handleApplyRange = () => {
    const problem = validatePlatformRange(fromDate, toDate, FINANCE_MAX_RANGE_DAYS);
    setRangeError(problem);
    if (!problem) applyDates(fromDate, toDate);
  };

  const handlePresetLastMonth = () => {
    const { fromDate: fromStr, toDate: toStr } = platformLastMonth();
    applyDates(fromStr, toStr);
  };

  const handlePresetThisMonth = () => {
    const { fromDate: fromStr, toDate: toStr } = platformMonthToDate();
    applyDates(fromStr, toStr);
  };

  // The ledger cannot report an unbounded period (92-day cap), so the default is the last 90
  // Cyprus days — labelled as such, never as "All time".
  const handlePresetDefault = () => applyDates("", "");

  // Period-bound cards (Bookly revenue, Collected for businesses, Discounted money) follow this
  // range. Sent to businesses (all time, E16) and Pending payouts (current) are unaffected.
  const period = useMemo(() => {
    const fallback = platformRecentDays(DEFAULT_FINANCE_DAYS);
    return {
      from: appliedFromDate || fallback.fromDate,
      to: appliedToDate || fallback.toDate,
    };
  }, [appliedFromDate, appliedToDate]);

  const summaryQuery = useSuperAdminPlatformSummaryQuery(period);
  const discountedMoneyQuery = usePromoDiscountedMoneyQuery(period);

  const viewSwitch = (
    <div role="tablist" aria-label="Finance sections" className="flex gap-2">
      {(["Overview", "Withdrawals"] as const).map((name) => (
        <button
          key={name}
          type="button"
          role="tab"
          aria-selected={view === name}
          onClick={() => setView(name)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            view === name
              ? "bg-[#111111] text-white"
              : "border border-[#111111] text-[#111111] bg-white hover:bg-gray-50"
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  );

  if (view === "Withdrawals") {
    return (
      <div className="flex flex-col gap-6 w-full pb-12 font-sans">
        <div className="flex flex-col gap-3 border-b border-gray-100 pb-4">
          <h2 className="font-semibold text-2xl text-[#111827] leading-[32px]">Finance</h2>
          {viewSwitch}
        </div>
        <SuperAdminWithdrawals />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-12 font-sans">
      {viewSwitch}
      {/* Title & Top Filter Row */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 w-full border-b border-gray-100 pb-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-2xl text-[#111827] leading-[32px]">
            Finance
          </h2>
          <span className="text-sm text-[#4E5F78]">
            Platform-wide financial overview
          </span>
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

          <button
            onClick={handlePresetDefault}
            className="bg-[#111111] hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors w-full xl:w-auto text-center"
          >
            Last {DEFAULT_FINANCE_DAYS} days
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 -mt-3" data-testid="finance-period-note">
        Period: {describeOverviewPeriod({ fromDate: period.from, toDate: period.to })}. Applies to
        Bookly revenue, Collected for businesses and Discounted money; Sent to businesses is all
        time and Pending payouts is the current balance.
      </p>
      {rangeError && (
        <p role="alert" className="text-xs text-rose-600 -mt-3">{rangeError}</p>
      )}

      {/* Bookly Protection Banner */}
      <SuperAdminFinanceBanner protectedEarningsAllTimeCents={summaryQuery.data?.protectedEarningsAllTimeCents} />

      {/* Cards stats grid */}
      <SuperAdminFinanceStats
        summary={summaryQuery.data}
        isLoading={summaryQuery.isLoading}
        discountedMoney={discountedMoneyQuery.data}
        isDiscountedMoneyLoading={discountedMoneyQuery.isLoading}
      />

      <SuperAdminFinancePending
        setActiveTab={setActiveTab}
        setSharedViewingBusinessId={setSharedViewingBusinessId}
        setSharedViewingBusinessTab={setSharedViewingBusinessTab}
      />

      {/* Transaction Log list */}
      <SuperAdminFinanceLog />
    </div>
  );
}
