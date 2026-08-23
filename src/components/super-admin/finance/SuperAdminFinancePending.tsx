"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon, ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";

import { formatBookingMoney } from "@/lib/bookings/format";
import type { BusinessPayableSummary } from "@/lib/api/superAdminFinance";
import { useExecutePayoutMutation, useSuperAdminPendingPayoutsQuery } from "@/lib/superAdminFinance/hooks";

interface SuperAdminFinancePendingProps {
  setActiveTab?: (tab: string) => void;
  setSharedViewingBusinessId?: (id: string | null) => void;
  setSharedViewingBusinessTab?: (tab: string) => void;
}

/** Batch 8 — wired to the real, always-full accumulated pending payable balance (never
 * date-filtered — a period filter here would risk hiding real unpaid money; the parent's
 * date-range picker no longer applies to this component, see the Batch 8 final report). */
export default function SuperAdminFinancePending({
  setActiveTab,
  setSharedViewingBusinessId,
  setSharedViewingBusinessTab,
}: SuperAdminFinancePendingProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<BusinessPayableSummary | null>(null);
  const [providerReference, setProviderReference] = useState("");

  const query = useSuperAdminPendingPayoutsQuery();
  const executeMutation = useExecutePayoutMutation();
  const items = query.data?.items ?? [];

  const handleExportCSV = () => {
    const headers = ["Business", "City", "Category", "Transactions", "No-show €", "Late cancel €", "Deposits €", "Net Amount"];
    const rows = items.map((p) => [
      `"${p.businessName}"`,
      `"${p.city}"`,
      `"${p.category}"`,
      p.transactionCount,
      (p.noShowAmountCents / 100).toFixed(2),
      (p.cancellationAmountCents / 100).toFixed(2),
      (p.depositAmountCents / 100).toFixed(2),
      `"${formatBookingMoney(p.netCents)}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `pending_sepa_payouts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmTransfer = () => {
    if (!selectedPayout) return;
    executeMutation.mutate(
      { businessId: selectedPayout.businessId, providerReference: providerReference || undefined },
      {
        onSuccess: () => {
          setSelectedPayout(null);
          setProviderReference("");
        },
      },
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden w-full flex flex-col font-sans">
      {/* Header Container */}
      <div className="bg-[#F5F5F5] p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-200 w-full">
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <h3 className="font-semibold text-base text-[#111111] leading-tight">
            Pending SEPA payouts - {items.length} businesses
          </h3>
          <p className="text-xs text-gray-500 font-normal">
            Each payout requires individual confirmation before executing
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            disabled={items.length === 0}
            className="flex items-center gap-2 bg-[#111111] hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex-1 sm:flex-initial justify-center"
          >
            <HugeiconsIcon icon={Download01Icon} className="w-4 h-4 text-white" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-700 shrink-0"
          >
            <HugeiconsIcon icon={isCollapsed ? ArrowDown01Icon : ArrowUp01Icon} className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Table/List View */}
      {!isCollapsed && (
        query.isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Loading pending payouts…
          </div>
        ) : query.isError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
            <span className="text-sm font-semibold text-rose-600">Couldn&apos;t load pending payouts</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
            <span className="text-sm font-semibold text-gray-600">No Businesses have a pending balance right now</span>
          </div>
        ) : (
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left font-sans text-xs border-collapse">
            <tbody className="divide-y divide-gray-100">
              {items.map((p) => {
                const initials = p.businessName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();

                return (
                  <tr key={p.businessId} className="hover:bg-gray-50/50 transition-colors">
                    {/* Business Info Column */}
                    <td className="p-4 whitespace-nowrap min-w-[320px]">
                      <div className="flex items-center gap-3">
                        {/* Circle Avatar */}
                        <div className="w-10 h-10 rounded-full bg-[#EEF2FF] flex items-center justify-center font-bold text-sm text-[#4338CA] shrink-0">
                          {initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-[14px] text-gray-900">
                            {p.businessName}
                          </span>
                          <span className="text-xs text-gray-500 font-normal">
                            {p.city} • {p.category} • {p.transactionCount} transaction{p.transactionCount === 1 ? "" : "s"} • No-show {formatBookingMoney(p.noShowAmountCents)} + late cancel {formatBookingMoney(p.cancellationAmountCents)}
                            {p.depositAmountCents > 0 ? ` + deposits ${formatBookingMoney(p.depositAmountCents)}` : ""}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Net Payout Amount Column */}
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-[#D97706]">{formatBookingMoney(p.netCents)}</span>
                        <span className="text-[11px] text-gray-400 font-normal">Net after Stripe fees</span>
                      </div>
                    </td>

                    {/* Action Column */}
                    <td className="p-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSharedViewingBusinessId?.(p.businessId);
                            setSharedViewingBusinessTab?.("Finance");
                            setActiveTab?.("Businesses");
                          }}
                          className="px-4 py-1.5 border border-[#E5E7EB] rounded-lg text-xs font-semibold text-[#111827] hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          View
                        </button>
                        <button
                          onClick={() => setSelectedPayout(p)}
                          className="px-4 py-1.5 border border-[#E5E7EB] rounded-lg text-xs font-semibold text-[#111827] hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          Send SEPA
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )
      )}

      {/* Confirmation Modal */}
      {selectedPayout && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-6 flex flex-col gap-4 font-sans relative">
            <button
              onClick={() => setSelectedPayout(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-900 text-lg focus:outline-none"
            >
              ✕
            </button>

            <h3 className="font-bold text-lg text-gray-900">
              Confirm SEPA Transfer
            </h3>

            <p className="text-sm text-gray-600 leading-relaxed">
              Confirm that you have sent <strong className="text-gray-900">{formatBookingMoney(selectedPayout.netCents)}</strong> to <strong className="text-gray-900">{selectedPayout.businessName}</strong> via your own bank/Stripe transfer.
              <br />
              <span className="text-gray-500 text-xs mt-1 block">Bookly does not hold this Business&apos;s bank details or execute the transfer — this records your own attestation that the transfer was made.</span>
              <span className="text-rose-600 font-semibold text-xs mt-2 block">⚠️ This action is irreversible</span>
            </p>

            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Your bank reference (optional)
              <input
                type="text"
                value={providerReference}
                onChange={(e) => setProviderReference(e.target.value)}
                placeholder="e.g. bank confirmation code"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400"
              />
            </label>

            {executeMutation.isError ? (
              <span className="text-xs text-rose-600">Couldn&apos;t record this payout — please try again.</span>
            ) : null}

            <div className="flex justify-end items-center gap-4 mt-2">
              <button
                onClick={() => setSelectedPayout(null)}
                className="text-sm font-medium text-gray-500 hover:underline hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTransfer}
                disabled={executeMutation.isPending}
                className="bg-[#16A34A] hover:bg-[#15803d] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {executeMutation.isPending ? "Confirming…" : "Confirm Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
