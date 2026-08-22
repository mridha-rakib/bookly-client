"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon as DownloadIcon } from "@hugeicons/core-free-icons";

import { usePayoutHistoryQuery } from "@/lib/finance/hooks";
import { formatBookingMoney } from "@/lib/bookings/format";
import type { FinancePayoutHistoryItem } from "@/lib/api/finance";

const PAGE_SIZE = 20;

const formatPeriod = (fromIso: string) => {
  const from = new Date(fromIso);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(from);
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

const statusBadgeClass: Record<FinancePayoutHistoryItem["status"], string> = {
  PENDING: "bg-[#F3E7C4] text-[#93723D]",
  PAID: "bg-[#D9EEE5] text-[#4D9A7A]",
};

const statusLabel: Record<FinancePayoutHistoryItem["status"], string> = {
  PENDING: "Pending",
  PAID: "Paid",
};

interface PayoutsHistoryProps {
  businessId: string;
}

export default function PayoutsHistory({ businessId }: PayoutsHistoryProps) {
  const [page, setPage] = useState(1);
  const query = usePayoutHistoryQuery(businessId, { page, limit: PAGE_SIZE });
  const items = query.data?.payouts ?? [];
  const total = query.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExportCSV = () => {
    const headers = ["PERIOD", "GROSS COLLECTED", "PROCESSING FEES", "NET PAYOUT", "PAID DATE", "STATUS"];
    const rows = items.map((item) => [
      formatPeriod(item.periodStart),
      formatBookingMoney(item.grossBusinessOwnedCents),
      `-${formatBookingMoney(item.processingFeesCents)}`,
      formatBookingMoney(item.netPayoutCents),
      item.paidAt ? formatDate(item.paidAt) : "—",
      statusLabel[item.status],
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "payout_history.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full bg-white border border-[#E1DED6] rounded-[16px] overflow-hidden flex flex-col shadow-sm">

      {/* Card Header */}
      <div className="box-sizing-border-box flex flex-row justify-between items-center px-5 py-4 border-b border-[#E8E5DE] w-full">
        <div className="flex flex-col">
          <h3 className="font-poppins font-semibold text-[18px] leading-[27px] tracking-[-0.36px] text-[#4B4D47]">
            Payout history
          </h3>
          <span className="font-poppins font-medium text-xs leading-[18px] text-[#686B64]">
            Money already paid out to you, by settlement period
          </span>
        </div>

        {/* Export CSV button */}
        <button
          onClick={handleExportCSV}
          disabled={items.length === 0}
          className="box-sizing-border-box flex flex-row align-center items-center px-4 py-1 gap-2 bg-white border border-[#DEDBD3] hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0px_1px_0px_rgba(0,0,0,0.03)] rounded-[12px] h-[32px] text-[13px] font-medium text-[#4F504B] cursor-pointer transition-all"
        >
          <HugeiconsIcon icon={DownloadIcon} className="w-4 h-4 text-[#4F504B]" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Table Element */}
      {query.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <span className="font-poppins text-sm text-neutral-400">Loading payout history…</span>
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
          <span className="font-poppins text-sm font-semibold text-[#BA1A1A]">Couldn&apos;t load payout history</span>
          <span className="font-poppins text-xs text-[#ABAAA6]">Please try again in a moment.</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
          <span className="font-poppins text-sm font-semibold text-[#5F5E5A]">No payouts yet</span>
          <span className="font-poppins text-xs text-[#ABAAA6] max-w-sm">
            Once a settlement period closes and a payout is issued, it will appear here.
          </span>
        </div>
      ) : (
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-[#EFEEE9] text-[11px] font-medium text-[#797A73] tracking-[0.66px] uppercase border-b border-[#ECE9E2]">
              <th className="py-3 px-4">PERIOD</th>
              <th className="py-3 px-4">GROSS COLLECTED</th>
              <th className="py-3 px-4">PROCESSING FEES</th>
              <th className="py-3 px-4">NET PAYOUT</th>
              <th className="py-3 px-4">PAID DATE</th>
              <th className="py-3 px-4">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ECE9E2] text-xs font-poppins text-[#4B4D47]">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-neutral-50/50">
                <td className="py-3.5 px-4 font-medium">{formatPeriod(item.periodStart)}</td>
                <td className="py-3.5 px-4">{formatBookingMoney(item.grossBusinessOwnedCents)}</td>
                <td className="py-3.5 px-4 text-[#BD5148] font-medium">-{formatBookingMoney(item.processingFeesCents)}</td>
                <td className="py-3.5 px-4 text-[#3D9E77] font-semibold">{formatBookingMoney(item.netPayoutCents)}</td>
                <td className="py-3.5 px-4 text-[#4B4D47] font-medium">{item.paidAt ? formatDate(item.paidAt) : "—"}</td>
                <td className="py-3.5 px-4">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadgeClass[item.status]}`}>
                    {statusLabel[item.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex flex-row items-center justify-between px-5 py-3 border-t border-[#E8E5DE] text-xs font-poppins text-[#686B64]">
          <span>Page {page} of {totalPages} · {total} total</span>
          <div className="flex flex-row gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded-[8px] border border-[#DEDBD3] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded-[8px] border border-[#DEDBD3] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
}
