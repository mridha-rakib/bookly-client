"use client";

import React, { useMemo } from "react";
import FinanceSummaryCards from "./FinanceSummaryCards";
import PayoutBreakdownCard from "./PayoutBreakdownCard";
import TransactionHistoryTable from "./TransactionHistoryTable";
import {
  useSuperAdminBusinessPayableQuery,
  useSuperAdminBusinessSummaryQuery,
} from "@/lib/superAdminFinance/hooks";

interface BusinessFinanceTabProps {
  businessId: string;
  businessName?: string;
}

export default function BusinessFinanceTab({ businessId, businessName }: BusinessFinanceTabProps) {
  // The existing Month/Year selects have only one static, non-selectable option each in the
  // current design (no real filter values to choose from) — this tab reads the last 90 days for
  // the period-bound summary, and the always-full accumulated balance for payable/payout.
  const period = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    };
  }, []);

  const summaryQuery = useSuperAdminBusinessSummaryQuery(businessId, period);
  const payableQuery = useSuperAdminBusinessPayableQuery(businessId);

  return (
    <div className="flex flex-col gap-6 w-full font-sans text-gray-900">

      {/* 1. Finance Summary Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full pt-2">
        <h3 className="font-semibold text-lg text-[#111827]">
          Finance summary
        </h3>
        <span className="text-xs text-gray-400">Last 90 days</span>
      </div>

      {/* Finance Summary Metrics 4-Cards Grid */}
      <FinanceSummaryCards
        summary={summaryQuery.data}
        payable={payableQuery.data}
        isLoading={summaryQuery.isLoading || payableQuery.isLoading}
      />

      {/* 2. Payout Breakdown Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full mt-4">
        <h3 className="font-semibold text-lg text-[#111827]">
          Payout Breakdown
        </h3>
        <span className="text-xs text-gray-400">Current pending balance</span>
      </div>

      {/* Payout Breakdown Side-by-Side Cards & Interactive Payments Bar */}
      <PayoutBreakdownCard
        businessId={businessId}
        businessName={businessName ?? payableQuery.data?.businessName ?? "this Business"}
        payable={payableQuery.data}
        isLoading={payableQuery.isLoading}
      />

      {/* 3. Transaction History Section */}
      <TransactionHistoryTable businessId={businessId} />
    </div>
  );
}
