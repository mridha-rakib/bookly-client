"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

import { formatBookingMoney } from "@/lib/bookings/format";
import type { BusinessPayableSummary } from "@/lib/api/superAdminFinance";
import { useExecutePayoutMutation } from "@/lib/superAdminFinance/hooks";

interface PayoutBreakdownCardProps {
  businessId: string;
  businessName: string;
  payable?: BusinessPayableSummary;
  isLoading?: boolean;
}

export default function PayoutBreakdownCard({
  businessId,
  businessName,
  payable,
  isLoading,
}: PayoutBreakdownCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const executeMutation = useExecutePayoutMutation();

  const amount = (cents: number | undefined) =>
    cents !== undefined ? formatBookingMoney(cents) : isLoading ? "…" : "—";

  const canPay = Boolean(payable && payable.netCents > 0);

  const handleConfirm = () => {
    if (!payable || payable.netCents <= 0) return;
    executeMutation.mutate(
      { businessId },
      { onSuccess: () => setShowDetails(false) },
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden flex flex-col">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
        {/* Left Column: What I owe the business */}
        <div className="flex flex-col gap-4">
          <h4 className="font-bold text-sm text-[#111111] pb-2 border-b border-gray-150">What I owe the business</h4>
          <div className="flex flex-col">
            <div className="flex justify-between py-2.5 border-b border-gray-100 text-sm">
              <div className="flex flex-col">
                <span className="text-[#1C1B1C]">No-show fees collected</span>
              </div>
              <span className="font-semibold text-[#1C1B1C]">{amount(payable?.noShowAmountCents)}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-gray-100 text-sm">
              <div className="flex flex-col">
                <span className="text-[#1C1B1C]">Late cancellation fees collected</span>
              </div>
              <span className="font-semibold text-[#1C1B1C]">{amount(payable?.cancellationAmountCents)}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-gray-100 text-sm">
              <div className="flex flex-col">
                <span className="text-[#1C1B1C]">Deposits held (returning customers)</span>
              </div>
              <span className="font-semibold text-[#1C1B1C]">{amount(payable?.depositAmountCents)}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-gray-100 text-sm">
              <div className="flex flex-col">
                <span className="text-[#1C1B1C]">Gross to business</span>
                <span className="text-xs text-gray-400">
                  {payable ? `${payable.transactionCount} transaction${payable.transactionCount === 1 ? "" : "s"} total` : "—"}
                </span>
              </div>
              <span className="font-semibold text-[#1C1B1C]">{amount(payable?.grossCents)}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-gray-100 text-sm text-rose-600">
              <div className="flex flex-col">
                <span>Stripe fees</span>
                <span className="text-xs text-[#767676]">Actual — pulled from Stripe API</span>
              </div>
              <span className="font-semibold">-{amount(payable?.processingFeesCents)}</span>
            </div>
            {payable && payable.refundsCents > 0 ? (
              <div className="flex justify-between py-2.5 border-b border-gray-100 text-sm text-rose-600">
                <span>Refunds</span>
                <span className="font-semibold">-{amount(payable.refundsCents)}</span>
              </div>
            ) : null}
            <div className="flex justify-between py-4 text-lg font-bold text-[#1C1B1C] border-t border-gray-100 mt-2">
              <span>Net to send via SEPA</span>
              <span className="text-2xl text-[#2E9DA7]">{amount(payable?.netCents)}</span>
            </div>
          </div>
        </div>

        {/* Right Column: What Bookly earned */}
        <div className="flex flex-col gap-4">
          <h4 className="font-bold text-sm text-[#111111] pb-2 border-b border-[#D3D3D3]">What Bookly earned</h4>
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <span className="text-sm text-gray-500">Not yet available for a single Business</span>
            <span className="text-xs text-gray-400 max-w-xs">
              Bookly&apos;s own activation-fee revenue is currently only reported platform-wide (see the Finance overview tab), not broken down per Business.
            </span>
          </div>
        </div>
      </div>

      {/* Info Banner Description */}
      <div className="mx-6 mb-6 p-4 bg-gray-50 border border-gray-100 rounded-lg flex items-start gap-3">
        <HugeiconsIcon icon={InformationCircleIcon} className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 leading-relaxed">
          Stripe fees vary per transaction based on card origin. Exact amounts are pulled from Stripe&apos;s API per transaction, never estimated. Total shown here is the sum of actual, currently-unpaid fees for this Business.
        </p>
      </div>

      {/* Interactive Green Payments Bar */}
      {!showDetails ? (
        <div className="mx-6 mb-6 flex flex-row justify-center items-center p-2 sm:px-5 gap-2 w-auto h-[72px] bg-[#E5F5EF] rounded-xl flex-none order-1 grow-0 border border-emerald-100">
          <button
            onClick={() => setShowDetails(true)}
            disabled={!canPay}
            className="box-sizing-border-box flex flex-row justify-center items-center px-4 py-1.5 gap-2 w-full md:max-w-[1112px] h-[56px] border border-[#111111] rounded-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 bg-white hover:bg-emerald-50 transition-colors flex-none order-1 grow"
          >
            <span className="font-sans font-medium text-[14px] sm:text-[18px] leading-[20px] text-center text-[#111111] whitespace-nowrap">
              {canPay ? "Send SEPA payout" : "No pending balance to pay out"}
            </span>
          </button>
        </div>
      ) : (
        <div className="mx-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center p-5 gap-4 w-auto bg-[#E5F5EF] rounded-xl flex-none order-1 grow-0 border border-emerald-100 transition-all">
          <div className="flex flex-col justify-center items-start p-0 gap-2 w-full md:max-w-[858px] flex-none order-0 grow">
            <span className="w-full font-sans font-semibold text-2xl text-[#224F42] flex items-center">
              Ready to send {amount(payable?.netCents)} to {businessName}
            </span>
            <p className="w-full font-sans font-normal text-[15.9px] leading-[24px] text-[#39725E] flex items-center">
              {payable?.transactionCount ?? 0} transaction{payable?.transactionCount === 1 ? "" : "s"} pending — net of actual Stripe fees. You are about to mark {amount(payable?.netCents)} as paid to {businessName}. This records your own attestation that you sent this money via your bank/Stripe transfer — Bookly does not execute the transfer. This action is irreversible. Confirm?
            </p>
            {executeMutation.isError ? (
              <span className="text-xs text-rose-600">Couldn&apos;t record this payout — please try again.</span>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
            <button
              onClick={handleConfirm}
              disabled={executeMutation.isPending}
              className="flex flex-row justify-center items-center px-4 py-1.5 gap-2 w-full h-[56px] rounded-lg cursor-pointer disabled:opacity-50 bg-[#16A34A] hover:bg-[#15803d] transition-colors"
            >
              <span className="font-sans font-medium text-[14px] sm:text-[16px] text-center text-white whitespace-nowrap">
                {executeMutation.isPending ? "Confirming…" : "Confirm transfer sent"}
              </span>
            </button>
            <button
              onClick={() => setShowDetails(false)}
              className="flex flex-row justify-center items-center px-4 py-1.5 gap-2 w-full h-[40px] border border-[#111111] rounded-lg cursor-pointer bg-white hover:bg-emerald-50 transition-colors"
            >
              <span className="font-sans font-medium text-[13px] text-center text-[#111111] whitespace-nowrap">
                Cancel
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
