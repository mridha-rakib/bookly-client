"use client";

import React from "react";

import { formatBookingMoney } from "@/lib/bookings/format";
import type { FinanceSummary } from "@/lib/api/finance";
import type { BusinessPayableSummary } from "@/lib/api/superAdminFinance";

interface FinanceSummaryCardsProps {
  summary?: FinanceSummary;
  payable?: BusinessPayableSummary;
  isLoading?: boolean;
}

export default function FinanceSummaryCards({ summary, payable, isLoading }: FinanceSummaryCardsProps) {
  const amount = (cents: number | undefined) =>
    cents !== undefined ? formatBookingMoney(cents) : isLoading ? "…" : "—";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
      {/* Fees Collected For Business */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-5 flex flex-col gap-1">
        <span className="text-xs font-medium text-[#6B7280]">Fees Collected For Business</span>
        <span className="text-3xl font-bold text-[#195156] mt-1">
          {amount(
            summary ? summary.noShowFees.amountCents + summary.lateCancellationFees.amountCents : undefined,
          )}
        </span>
        <span className="text-[11px] text-[#6B7280] mt-1">
          {summary
            ? `No-show ${formatBookingMoney(summary.noShowFees.amountCents)} · Late cancel ${formatBookingMoney(summary.lateCancellationFees.amountCents)}`
            : "—"}
        </span>
      </div>

      {/* Deposits held for Business (Batch 8 — returning-customer online charges) */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-5 flex flex-col gap-1">
        <span className="text-xs font-medium text-[#6B7280]">Deposits Held For Business</span>
        <span className="text-3xl font-bold text-[#195156] mt-1">{amount(payable?.depositAmountCents)}</span>
        <span className="text-[11px] text-[#6B7280] mt-1">Returning-customer online charges, unpaid</span>
      </div>

      {/* Pending Payout */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-5 flex flex-col gap-1">
        <span className="text-xs font-medium text-[#6B7280]">Pending Payout</span>
        <span className="text-3xl font-bold text-[#195156] mt-1">{amount(payable?.netCents)}</span>
        <span className="text-[11px] text-[#6B7280] mt-1">
          {payable ? `${payable.transactionCount} transaction${payable.transactionCount === 1 ? "" : "s"} — awaiting SEPA` : "—"}
        </span>
      </div>

      {/* Processing fees */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-5 flex flex-col gap-1">
        <span className="text-xs font-medium text-[#6B7280]">Business-borne Processing Fees</span>
        <span className="text-3xl font-bold text-[#195156] mt-1">{amount(payable?.processingFeesCents)}</span>
        <span className="text-[11px] text-[#6B7280] mt-1">Real Stripe fees, pending settlement</span>
      </div>
    </div>
  );
}
