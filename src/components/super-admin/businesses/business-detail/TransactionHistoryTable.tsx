"use client";

import React, { useState } from "react";

import { formatBookingMoney } from "@/lib/bookings/format";
import { useSuperAdminBusinessTransactionsQuery } from "@/lib/superAdminFinance/hooks";

interface TransactionHistoryTableProps {
  businessId: string;
}

const typeLabel: Record<string, string> = {
  NO_SHOW_FEE: "No-show fee",
  CANCELLATION_FEE: "Late cancellation fee",
};

const statusStyle: Record<string, string> = {
  SUCCEEDED: "bg-[#D0F1DC] text-[#025420]",
  WAIVED: "bg-gray-100 text-gray-500",
  FAILED: "bg-[#FDE8E8] text-[#9B1C1C]",
  PENDING: "bg-[#E3D5AB] text-[#5C4604]",
};

const statusLabel: Record<string, string> = {
  SUCCEEDED: "Business keeps",
  WAIVED: "Waived",
  FAILED: "Failed",
  PENDING: "Pending",
};

export default function TransactionHistoryTable({ businessId }: TransactionHistoryTableProps) {
  const [transactionType, setTransactionType] = useState<"ALL" | "NO_SHOW_FEE" | "CANCELLATION_FEE">("ALL");
  const [page, setPage] = useState(1);

  const period = React.useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    };
  }, []);

  const query = useSuperAdminBusinessTransactionsQuery(businessId, period, { page, limit: 25 });
  const rows = (query.data?.transactions ?? []).filter(
    (t) => transactionType === "ALL" || t.type === transactionType,
  );
  const total = query.data?.pagination.total ?? 0;

  return (
    <div className="flex flex-col gap-4 w-full mt-4">
      <div className="flex flex-row justify-between items-center gap-4 w-full">
        <h3 className="font-semibold text-base sm:text-lg text-[#111827] whitespace-nowrap">
          Transaction History
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value as typeof transactionType)}
            className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs font-medium text-[#314158] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="NO_SHOW_FEE">No-show fee</option>
            <option value="CANCELLATION_FEE">Late cancellation fee</option>
          </select>
        </div>
      </div>

      {/* Transactions Table List */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="min-w-[700px] md:min-w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-gray-100 text-[#374151] font-semibold">
                <th className="p-4">Date</th>
                <th className="p-4">Type & Booking</th>
                <th className="p-4 text-center">Gross</th>
                <th className="p-4 text-center">Business Amount</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-800">
              {rows.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50/30 transition-colors">
                  <td className="p-4 font-normal text-gray-900">
                    {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(tx.date))}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1.5 items-start">
                      <span className="font-semibold text-[#111827]">{typeLabel[tx.type] ?? tx.type}</span>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <span>{tx.bookingReference}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-400" />
                        <span>{tx.customerName}</span>
                        {tx.customerType === "FIRST_BOOKING" ? (
                          <span className="text-[10px] font-bold text-gray-400 ml-0.5">(NEW)</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center font-medium text-gray-900">{formatBookingMoney(tx.amountCents)}</td>
                  <td className="p-4 text-center font-medium text-gray-900">{formatBookingMoney(tx.businessOwnedCents)}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-semibold ${statusStyle[tx.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {statusLabel[tx.status] ?? tx.status}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 font-medium">
                    {query.isLoading ? "Loading…" : "No transactions in the last 90 days."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        <div className="border-t border-gray-100 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-xs text-gray-500 font-medium">Page {page} · {total} total</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 bg-white"
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 25 >= total}
              className="px-4 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 bg-white"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
