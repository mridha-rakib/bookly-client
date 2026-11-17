"use client";

import React from "react";

import { useFinanceBalanceQuery } from "@/lib/finance/hooks";
import { formatBookingMoney } from "@/lib/bookings/format";

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

interface PayoutsBalanceProps {
  businessId: string;
}

/**
 * Finance Gap 01 — the Owner's all-time balance with Bookly: what was earned through Bookly,
 * what Bookly has recorded as paid by external bank transfer, and what is still payable. Same
 * card styling as DashboardPayoutsList's monthly fee cards; deliberately all-time (never
 * month-filtered) and labelled as such.
 */
export default function PayoutsBalance({ businessId }: PayoutsBalanceProps) {
  const query = useFinanceBalanceQuery(businessId);
  const balance = query.data;
  const placeholder = query.isLoading ? "Loading…" : "—";
  const carriedDeductionCents = balance && balance.outstanding.netCents < 0 ? -balance.outstanding.netCents : 0;

  return (
    <div className="pt-[20px] flex flex-col gap-[12px] w-full">
      <div className="flex flex-col md:flex-row items-center gap-[12px] w-full">
        {/* Earned through Bookly */}
        <div className="flex flex-col items-start p-4 bg-[#F1F0EA] rounded-[12px] flex-grow w-full md:w-auto h-[100px]">
          <span className="font-poppins font-semibold text-[10px] leading-[15px] tracking-[0.8px] uppercase text-[#83847E]">
            EARNED THROUGH BOOKLY · ALL TIME
          </span>
          <div className="flex flex-col mt-2">
            <span className="font-poppins font-semibold text-[24px] leading-[24px] tracking-[-0.96px] text-[#43A27E]">
              {balance ? formatBookingMoney(balance.earned.netCents) : "—"}
            </span>
            <span className="font-poppins font-semibold text-[11px] leading-[16px] text-[#73756E] mt-1">
              {balance ? "Deposits and fees, after processing fees and refunds" : placeholder}
            </span>
          </div>
        </div>

        {/* Recorded as paid */}
        <div className="flex flex-col items-start p-4 bg-[#F1F0EA] rounded-[12px] flex-grow w-full md:w-auto h-[100px]">
          <span className="font-poppins font-semibold text-[10px] leading-[15px] tracking-[0.8px] uppercase text-[#83847E]">
            RECORDED AS PAID · ALL TIME
          </span>
          <div className="flex flex-col mt-2">
            <span className="font-poppins font-semibold text-[24px] leading-[24px] tracking-[-0.96px] text-[#4B4D47]">
              {balance ? formatBookingMoney(balance.recordedPaid.amountCents) : "—"}
            </span>
            <span className="font-poppins font-semibold text-[11px] leading-[16px] text-[#73756E] mt-1">
              {balance
                ? balance.recordedPaid.payoutCount === 0
                  ? "No transfers recorded yet"
                  : `${balance.recordedPaid.payoutCount} transfer${balance.recordedPaid.payoutCount === 1 ? "" : "s"} recorded${balance.recordedPaid.lastRecordedAt ? ` · last ${formatDate(balance.recordedPaid.lastRecordedAt)}` : ""}`
                : placeholder}
            </span>
          </div>
        </div>

        {/* Outstanding */}
        <div className="flex flex-col items-start p-4 bg-[#F1F0EA] rounded-[12px] flex-grow w-full md:w-auto h-[100px]">
          <span className="font-poppins font-semibold text-[10px] leading-[15px] tracking-[0.8px] uppercase text-[#83847E]">
            OUTSTANDING · STILL PAYABLE
          </span>
          <div className="flex flex-col mt-2">
            <span className="font-poppins font-semibold text-[24px] leading-[24px] tracking-[-0.96px] text-[#43A27E]">
              {balance ? formatBookingMoney(balance.outstanding.payableCents) : "—"}
            </span>
            <span className="font-poppins font-semibold text-[11px] leading-[16px] text-[#73756E] mt-1">
              {balance
                ? carriedDeductionCents > 0
                  ? `${formatBookingMoney(carriedDeductionCents)} deduction carried to future earnings`
                  : balance.outstanding.payableCents > 0
                    ? "Not yet recorded as paid"
                    : "Nothing outstanding right now"
                : placeholder}
            </span>
          </div>
        </div>
      </div>

      {query.isError ? (
        <div className="w-full py-3 text-center text-xs font-poppins font-semibold text-[#BA1A1A]">
          Couldn&apos;t load your balance. Please try again.
          <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="ml-2 underline disabled:opacity-50">{query.isFetching ? "Retrying…" : "Retry balance"}</button>
        </div>
      ) : null}

      {balance && !balance.reconciled ? (
        <div className="w-full py-2 text-center text-xs font-poppins font-semibold text-[#93723D]">
          Your earned total and recorded payments differ by {formatBookingMoney(Math.abs(balance.reconciliationDifferenceCents))}. Please contact Bookly support so we can review your records.
        </div>
      ) : null}

      <p className="font-poppins font-medium text-xs leading-[18px] text-[#686B64]">
        Bookly&apos;s team sends your outstanding balance by bank transfer and then records it here. &quot;Recorded as paid&quot; is Bookly&apos;s own record of that transfer, not a confirmation from your bank. Payments customers made to you directly are not included.
      </p>
    </div>
  );
}
