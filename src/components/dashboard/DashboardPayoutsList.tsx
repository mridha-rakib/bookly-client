"use client";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

import React, { useMemo, useState } from "react";

// Modular Subcomponents
import PayoutsBanner from "../payouts/PayoutsBanner";
import PayoutsBreakdown from "../payouts/PayoutsBreakdown";
import PayoutsHistory from "../payouts/PayoutsHistory";

import { useFinanceSummaryQuery } from "@/lib/finance/hooks";
import { formatBookingMoney } from "@/lib/bookings/format";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface DashboardPayoutsListProps {
  /** Undefined for any actor other than the Business Owner (Finance is Owner-only — see
   * api/src/modules/finance/finance.route.ts's own comment); this screen is only ever reached
   * from business-dashboard/page.tsx, which RequireBusinessOwner already gates, so in practice
   * this is only ever undefined for a brief instant while the Owner's business id resolves. */
  businessId?: string;
}

export default function DashboardPayoutsList({ businessId }: DashboardPayoutsListProps) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(String(now.getUTCFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[now.getUTCMonth()]);

  const period = useMemo(() => {
    const year = Number(selectedYear);
    const monthIndex = MONTHS.indexOf(selectedMonth);
    if (monthIndex < 0) return undefined;
    return {
      from: new Date(Date.UTC(year, monthIndex, 1)).toISOString(),
      to: new Date(Date.UTC(year, monthIndex + 1, 1)).toISOString(),
    };
  }, [selectedYear, selectedMonth]);

  const summaryQuery = useFinanceSummaryQuery(businessId, period);
  const summary = summaryQuery.data;

  if (!businessId) {
    return (
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
        <DashboardHeader title="Payouts & Finance" subtitle="Your earnings, fee breakdown, and payout history" />
        <div className="flex-1 flex items-center justify-center py-16 px-6 text-center">
          <span className="font-poppins text-sm font-semibold text-[#5F5E5A]">Finance isn&apos;t available for your account</span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">

      {/* Header Row */}
      <DashboardHeader title="Payouts & Finance" subtitle="Your earnings, fee breakdown, and payout history" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

      {/* Main Content Alignment Wrapper */}
      <div className="pt-[20px] flex flex-col gap-[20px] w-full">

        {/* Protected by Bookly Banner */}
        <PayoutsBanner
          protectedEarnings={
            summary ? formatBookingMoney(summary.protectedEarningsAllTimeCents) : "—"
          }
        />

        {/* Filters Row */}
        <div className="pt-[32px] flex flex-row items-start gap-[12px] w-full h-[48px]">
          <div className="relative flex-grow">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none h-[48px] w-full bg-white border border-[#B7D2C8] rounded-[12px] px-4 font-poppins font-semibold text-[14px] leading-[16px] text-center text-black focus:outline-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23111111' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
                backgroundSize: '16px'
              }}
            >
              <option value={String(now.getUTCFullYear())}>{now.getUTCFullYear()}</option>
              <option value={String(now.getUTCFullYear() - 1)}>{now.getUTCFullYear() - 1}</option>
            </select>
          </div>

          <div className="relative flex-grow">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none h-[48px] w-full bg-white border border-[#B7D2C8] rounded-[12px] px-4 font-poppins font-semibold text-[14px] leading-[16px] text-center text-black focus:outline-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23111111' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
                backgroundSize: '16px'
              }}
            >
              {MONTHS.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 Cards Summary Grid */}
        <div className="pt-[20px] flex flex-col md:flex-row items-center gap-[12px] w-full">
          {/* Card 1 */}
          <div className="flex flex-col items-start p-4 bg-[#F1F0EA] rounded-[12px] flex-grow w-full md:w-auto h-[100px]">
            <span className="font-poppins font-semibold text-[10px] leading-[15px] tracking-[0.8px] uppercase text-[#83847E]">
              NO-SHOW FEES
            </span>
            <div className="flex flex-col mt-2">
              <span className="font-poppins font-semibold text-[24px] leading-[24px] tracking-[-0.96px] text-[#43A27E]">
                {summary ? formatBookingMoney(summary.noShowFees.amountCents) : "—"}
              </span>
              <span className="font-poppins font-semibold text-[11px] leading-[16px] text-[#73756E] mt-1">
                {summary ? `${summary.noShowFees.count} no-show${summary.noShowFees.count === 1 ? "" : "s"} charged` : summaryQuery.isLoading ? "Loading…" : "—"}
              </span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="flex flex-col items-start p-4 bg-[#F1F0EA] rounded-[12px] flex-grow w-full md:w-auto h-[100px]">
            <span className="font-poppins font-semibold text-[10px] leading-[15px] tracking-[0.8px] uppercase text-[#83847E]">
              LATE CANCEL FEES
            </span>
            <div className="flex flex-col mt-2">
              <span className="font-poppins font-semibold text-[24px] leading-[24px] tracking-[-0.96px] text-[#43A27E]">
                {summary ? formatBookingMoney(summary.lateCancellationFees.amountCents) : "—"}
              </span>
              <span className="font-poppins font-semibold text-[11px] leading-[16px] text-[#73756E] mt-1">
                {summary ? `${summary.lateCancellationFees.count} cancellation${summary.lateCancellationFees.count === 1 ? "" : "s"}` : summaryQuery.isLoading ? "Loading…" : "—"}
              </span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="flex flex-col items-start p-4 bg-[#F1F0EA] rounded-[12px] flex-grow w-full md:w-auto h-[100px]">
            <span className="font-poppins font-semibold text-[10px] leading-[15px] tracking-[0.8px] uppercase text-[#83847E]">
              PROCESSING FEES
            </span>
            <div className="flex flex-col mt-2">
              <span className="font-poppins font-semibold text-[24px] leading-[24px] tracking-[-0.96px] text-[#C75A50]">
                {summary && summary.processingFees.amountCents > 0
                  ? `−${formatBookingMoney(summary.processingFees.amountCents)}`
                  : summary
                    ? "€0.00"
                    : "—"}
              </span>
              <span className="font-poppins font-semibold text-[11px] leading-[16px] text-[#73756E] mt-1">
                Passed through at cost
              </span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="flex flex-col items-start p-4 bg-[#F1F0EA] rounded-[12px] flex-grow w-full md:w-auto h-[100px]">
            <span className="font-poppins font-semibold text-[10px] leading-[15px] tracking-[0.8px] uppercase text-[#83847E]">
              YOUR PAYOUT — END OF {selectedMonth.slice(0, 3).toUpperCase()}
            </span>
            <div className="flex flex-col mt-2">
              <span className="font-poppins font-semibold text-[24px] leading-[24px] tracking-[-0.96px] text-[#43A27E]">
                {summary ? formatBookingMoney(summary.netPayoutCents) : "—"}
              </span>
              <span className="font-poppins font-semibold text-[11px] leading-[16px] text-[#73756E] mt-1">
                100% yours, net of processing
              </span>
            </div>
          </div>
        </div>

        {summaryQuery.isError ? (
          <div className="w-full py-3 text-center text-xs font-poppins font-semibold text-[#BA1A1A]">
            Couldn&apos;t load this period&apos;s finance summary. Please try again.
          </div>
        ) : null}

        {/* Section 1: Transaction Breakdown */}
        <div className="pt-[20px] w-full">
          <PayoutsBreakdown businessId={businessId} period={period} periodLabel={`${selectedMonth} ${selectedYear}`} />
        </div>

        {/* Section 2: Payout History */}
        <div className="pt-[20px] w-full">
          <PayoutsHistory businessId={businessId} />
        </div>

      </div>

      </div></main>
  );
}
