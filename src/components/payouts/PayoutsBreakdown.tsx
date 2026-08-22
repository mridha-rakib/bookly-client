"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon as DownloadIcon } from "@hugeicons/core-free-icons";

import { useFinanceTransactionsQuery } from "@/lib/finance/hooks";
import { formatBookingMoney } from "@/lib/bookings/format";
import type { FinancePeriodParams, FinanceTransactionRow } from "@/lib/api/finance";

const PAGE_SIZE = 20;

const typeLabel: Record<FinanceTransactionRow["type"], string> = {
  NO_SHOW_FEE: "No-show",
  CANCELLATION_FEE: "Late cancel",
};

const typeBadgeClass: Record<FinanceTransactionRow["type"], string> = {
  NO_SHOW_FEE: "bg-[#F7DFDC] text-[#B35A52]",
  CANCELLATION_FEE: "bg-[#F3E7C4] text-[#93723D]",
};

const customerBadgeClass: Record<FinanceTransactionRow["customerType"], string> = {
  RETURNING: "bg-[#D9EEE5] text-[#4D9A7A]",
  FIRST_BOOKING: "bg-[#E8DEF8] text-[#7461B7]",
};

const customerLabel: Record<FinanceTransactionRow["customerType"], string> = {
  RETURNING: "Returning",
  FIRST_BOOKING: "First booking",
};

const statusNote: Record<FinanceTransactionRow["status"], string | undefined> = {
  SUCCEEDED: undefined,
  WAIVED: "Waived — not collected",
  FAILED: "Charge failed — not collected",
  PENDING: "Charge in progress",
};

const formatRowDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(iso));

interface PayoutsBreakdownProps {
  businessId: string;
  period: FinancePeriodParams | undefined;
  periodLabel: string;
}

export default function PayoutsBreakdown({ businessId, period, periodLabel }: PayoutsBreakdownProps) {
  const [page, setPage] = useState(1);
  const query = useFinanceTransactionsQuery(businessId, period, { page, limit: PAGE_SIZE });
  const rows = query.data?.transactions ?? [];
  const total = query.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExportCSV = () => {
    const headers = ["CLIENT", "REFERENCE", "DATE", "TYPE", "CUSTOMER", "FEE CHARGED", "YOUR PAYOUT", "STATUS"];
    const dataRows = rows.map((t) => [
      t.customerName,
      t.bookingReference,
      formatRowDate(t.date),
      typeLabel[t.type],
      customerLabel[t.customerType],
      formatBookingMoney(t.amountCents),
      formatBookingMoney(t.businessOwnedCents),
      t.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...dataRows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `transaction_breakdown_${periodLabel.replace(/\s+/g, "_").toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full bg-white border border-[#E1DED6] rounded-[16px] overflow-hidden flex flex-col shadow-sm">

      {/* Card Header */}
      <div className="box-sizing-border-box flex flex-row justify-between items-center px-5 py-4 border-b border-[#E8E5DE] w-full">
        <div className="flex flex-col">
          <h3 className="font-poppins font-semibold text-[18px] leading-[27px] tracking-[-0.36px] text-[#3F413D]">
            {periodLabel} — transaction breakdown
          </h3>
          <span className="font-poppins font-medium text-xs leading-[18px] text-[#686B64]">
            No-show and cancellation fees collected this month
          </span>
        </div>

        {/* Export CSV button — exports the currently loaded page only */}
        <button
          onClick={handleExportCSV}
          disabled={rows.length === 0}
          className="box-sizing-border-box flex flex-row align-center items-center px-4 py-1 gap-2 bg-white border border-[#DEDBD3] hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0px_1px_0px_rgba(0,0,0,0.03)] rounded-[12px] h-[32px] text-[13px] font-medium text-[#4F504B] cursor-pointer transition-all"
        >
          <HugeiconsIcon icon={DownloadIcon} className="w-4 h-4 text-[#4F504B]" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Table Element */}
      {query.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <span className="font-poppins text-sm text-neutral-400">Loading transactions…</span>
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
          <span className="font-poppins text-sm font-semibold text-[#BA1A1A]">Couldn&apos;t load transactions</span>
          <span className="font-poppins text-xs text-[#ABAAA6]">Please try again in a moment.</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
          <span className="font-poppins text-sm font-semibold text-[#5F5E5A]">No no-show or late-cancellation fees this period</span>
          <span className="font-poppins text-xs text-[#ABAAA6]">Try a different month.</span>
        </div>
      ) : (
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-[#EFEEE9] text-[11px] font-medium text-[#797A73] tracking-[0.66px] uppercase border-b border-[#ECE9E2]">
              <th className="py-3 px-4 w-[140px]">CLIENT</th>
              <th className="py-3 px-4 w-[80px]">DATE</th>
              <th className="py-3 px-4 w-[120px]">TYPE</th>
              <th className="py-3 px-4 w-[140px]">CUSTOMER</th>
              <th className="py-3 px-4 text-right w-[120px]">FEE CHARGED</th>
              <th className="py-3 px-4 text-right w-[200px]">YOUR PAYOUT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ECE9E2] text-xs font-poppins">
            {rows.map((row) => {
              const note = statusNote[row.status];
              const payoutColor = row.status === "SUCCEEDED" ? "text-[#4AAF82]" : "text-neutral-400";
              return (
                <tr key={row.id} className="hover:bg-neutral-50/50">
                  <td className="py-3.5 px-4 font-medium text-[#50524D]">{row.customerName}</td>
                  <td className="py-3.5 px-4 text-[#4B4D47] font-medium">{formatRowDate(row.date)}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full ${typeBadgeClass[row.type]}`}>
                      {typeLabel[row.type]}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full ${customerBadgeClass[row.customerType]}`}>
                      {customerLabel[row.customerType]}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-[#4AAF82]">{formatBookingMoney(row.amountCents)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`font-medium ${payoutColor}`}>{formatBookingMoney(row.businessOwnedCents)}</span>
                      {note ? (
                        <span className="text-[9px] text-[#93723D] mt-0.5 leading-normal">{note}</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
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
