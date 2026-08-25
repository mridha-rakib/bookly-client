"use client";

import React, { useMemo, useState } from "react";
import SuperAdminFinanceBanner from "./SuperAdminFinanceBanner";
import SuperAdminFinanceStats from "./SuperAdminFinanceStats";
import SuperAdminFinancePending from "./SuperAdminFinancePending";
import SuperAdminFinanceLog from "./SuperAdminFinanceLog";
import { useSuperAdminPlatformSummaryQuery } from "@/lib/superAdminFinance/hooks";
import { usePromoDiscountedMoneyQuery } from "@/lib/promo/hooks";

interface SuperAdminFinanceProps {
  setActiveTab?: (tab: string) => void;
  setSharedViewingBusinessId?: (id: string | null) => void;
  setSharedViewingBusinessTab?: (tab: string) => void;
}

export default function SuperAdminFinance({
  setActiveTab,
  setSharedViewingBusinessId,
  setSharedViewingBusinessTab
}: SuperAdminFinanceProps) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const handleApplyRange = () => {
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
  };

  const handlePresetLastMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const fromStr = firstDay.toISOString().split("T")[0];
    const toStr = lastDay.toISOString().split("T")[0];
    setFromDate(fromStr);
    setToDate(toStr);
    setAppliedFromDate(fromStr);
    setAppliedToDate(toStr);
  };

  const handlePresetThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const fromStr = firstDay.toISOString().split("T")[0];
    const toStr = now.toISOString().split("T")[0];
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

  // Period-bound cards (Bookly revenue, Collected for businesses) require a bounded [from, to)
  // range (backend rule: max 92 days) — defaults to the last 90 days when no explicit range is
  // applied. The genuinely all-time figures (protected earnings, sent to businesses, pending
  // payouts) are unaffected by this and come back all-time from the backend regardless.
  const period = useMemo(() => {
    const now = new Date();
    const from = appliedFromDate
      ? new Date(appliedFromDate)
      : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const to = appliedToDate ? new Date(new Date(appliedToDate).getTime() + 24 * 60 * 60 * 1000) : now;
    return { from: from.toISOString(), to: to.toISOString() };
  }, [appliedFromDate, appliedToDate]);

  const summaryQuery = useSuperAdminPlatformSummaryQuery(period);
  const discountedMoneyQuery = usePromoDiscountedMoneyQuery(period);

  return (
    <div className="flex flex-col gap-6 w-full pb-12 font-sans">
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
            onClick={handlePresetAllTime}
            className="bg-[#111111] hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors w-full xl:w-auto text-center"
          >
            All time
          </button>
        </div>
      </div>

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
