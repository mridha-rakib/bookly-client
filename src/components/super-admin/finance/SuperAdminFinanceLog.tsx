"use client";

import React, { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon, ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";

import { formatBookingMoney } from "@/lib/bookings/format";
import type { PlatformTransactionRow, PlatformTransactionType } from "@/lib/api/superAdminFinance";
import {
  useSuperAdminPlatformPayoutHistoryQuery,
  useSuperAdminPlatformTransactionsQuery,
} from "@/lib/superAdminFinance/hooks";

type TabType = "No-show & late cancel" | "Activation fees" | "Refunds issued" | "SEPA sent";

const TAB_TYPES: Record<Exclude<TabType, "SEPA sent">, PlatformTransactionType[]> = {
  "No-show & late cancel": ["NO_SHOW_FEE", "CANCELLATION_FEE"],
  "Activation fees": ["PLATFORM_FEE"],
  "Refunds issued": ["REFUND"],
};

const feeTypeLabel: Record<PlatformTransactionType, string> = {
  NO_SHOW_FEE: "No-show fee",
  CANCELLATION_FEE: "Late-cancellation fee",
  PLATFORM_FEE: "Activation fee",
  REFUND: "Refund",
};

const badgeLabel: Record<PlatformTransactionRow["owner"], string> = {
  BOOKLY: "Bookly gets",
  BUSINESS: "Business gets",
  CUSTOMER: "Customer gets",
};

const rowStatusLabel = (row: PlatformTransactionRow): string => {
  if (row.status === "WAIVED") return "Waived";
  if (row.status === "FAILED") return "Failed";
  if (row.status === "PENDING") return "Pending";
  if (row.type === "REFUND") return "Refunded";
  if (row.type === "PLATFORM_FEE") return "Settled";
  return row.payoutId ? "Payout sent" : "Pending payout";
};

const statusBadgeStyle = (label: string): string => {
  switch (label) {
    case "Pending payout":
    case "Pending":
      return "bg-amber-50 text-amber-600 border border-amber-200";
    case "Payout sent":
    case "Settled":
      return "bg-emerald-50 text-emerald-600 border border-emerald-200";
    case "Refunded":
      return "bg-gray-50 text-gray-500 border border-gray-200";
    case "Waived":
      return "bg-gray-50 text-gray-400 border border-gray-200";
    case "Failed":
      return "bg-rose-50 text-rose-600 border border-rose-200";
    default:
      return "bg-gray-50 text-gray-400";
  }
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso),
  );

export default function SuperAdminFinanceLog() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("No-show & late cancel");
  const [page, setPage] = useState(1);

  const period = useMemo(() => {
    const now = new Date();
    const from = appliedFromDate ? new Date(appliedFromDate) : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const to = appliedToDate ? new Date(new Date(appliedToDate).getTime() + 24 * 60 * 60 * 1000) : now;
    return { from: from.toISOString(), to: to.toISOString() };
  }, [appliedFromDate, appliedToDate]);

  const isPayoutsTab = activeTab === "SEPA sent";

  const transactionsQuery = useSuperAdminPlatformTransactionsQuery(
    isPayoutsTab ? undefined : period,
    { page, limit: 20 },
    isPayoutsTab ? undefined : TAB_TYPES[activeTab],
  );
  const payoutsQuery = useSuperAdminPlatformPayoutHistoryQuery({ page, limit: 20 });

  const rows = transactionsQuery.data?.transactions ?? [];
  const payoutRows = payoutsQuery.data?.payouts ?? [];
  const total = isPayoutsTab
    ? (payoutsQuery.data?.pagination.total ?? 0)
    : (transactionsQuery.data?.pagination.total ?? 0);

  const handleApplyFilters = () => {
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setPage(1);
  };

  const handleExportCSV = () => {
    if (isPayoutsTab) {
      const headers = ["Business", "Period start", "Period end", "Gross", "Processing fees", "Net", "Status"];
      const csvRows = payoutRows.map((p) => [
        `"${p.businessName}"`,
        `"${formatDate(p.periodStart)}"`,
        `"${formatDate(p.periodEnd)}"`,
        `"${formatBookingMoney(p.grossBusinessOwnedCents)}"`,
        `"-${formatBookingMoney(p.processingFeesCents)}"`,
        `"${formatBookingMoney(p.netPayoutCents)}"`,
        `"${p.status}"`,
      ]);
      downloadCSV(headers, csvRows, `payout_history_${new Date().toISOString().slice(0, 10)}.csv`);
      return;
    }

    const headers = ["Date", "Business", "Fee Type", "Booking", "Customer", "Badge", "Gross", "Net", "Status"];
    const csvRows = rows.map((t) => [
      `"${formatDate(t.date)}"`,
      `"${t.businessName}"`,
      `"${feeTypeLabel[t.type]}"`,
      `"${t.bookingReference}"`,
      `"${t.customerName}"`,
      `"${badgeLabel[t.owner]}"`,
      `"${formatBookingMoney(t.grossCents)}"`,
      `"${formatBookingMoney(t.netCents)}"`,
      `"${rowStatusLabel(t)}"`,
    ]);
    downloadCSV(headers, csvRows, `transaction_log_${activeTab.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const downloadCSV = (headers: string[], csvRows: string[][], filename: string) => {
    const csvContent = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden w-full flex flex-col font-sans">
      {/* Header Container */}
      <div className="bg-[#F5F5F5] p-5 flex flex-wrap justify-between items-center gap-4 border-b border-gray-200">
        <h3 className="font-semibold text-base text-[#111111]">
          Transaction log
        </h3>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-[#111111] hover:bg-black text-white px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
          >
            <HugeiconsIcon icon={Download01Icon} className="w-4 h-4 text-white" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
          >
            <HugeiconsIcon icon={isCollapsed ? ArrowDown01Icon : ArrowUp01Icon} className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Sub-Filters: Date selectors (ignored for the "SEPA sent" tab — payout history is
              its own always-full list) */}
          {!isPayoutsTab ? (
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="grid grid-cols-1 gap-3 items-center w-full md:flex md:flex-row md:items-center md:gap-4 md:w-auto">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-xs font-normal text-gray-500 w-8 md:w-auto">From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7] cursor-pointer flex-1 md:flex-initial md:w-36"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-xs font-normal text-gray-500 w-8 md:w-auto">To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7] cursor-pointer flex-1 md:flex-initial md:w-36"
                />
              </div>

              <button
                onClick={handleApplyFilters}
                className="bg-white hover:bg-gray-50 border border-[#E2E8F0] text-gray-800 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors w-full md:w-auto text-center"
              >
                Apply
              </button>
            </div>
          </div>
          ) : null}

          {/* Sub-Tabs Navigation */}
          <div className="flex items-center gap-6 px-5 border-b border-gray-100 overflow-x-auto bg-white pt-2.5">
            {(["No-show & late cancel", "Activation fees", "Refunds issued", "SEPA sent"] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setPage(1);
                  }}
                  className={`pb-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                    isActive
                      ? "border-[#6366F1] text-[#6366F1]"
                      : "border-transparent text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Data Grid Table */}
          {isPayoutsTab ? (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left font-sans text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-gray-100 text-gray-700 font-semibold">
                    <th className="p-4 whitespace-nowrap">Business</th>
                    <th className="p-4 whitespace-nowrap">Period</th>
                    <th className="p-4 whitespace-nowrap text-right">Gross</th>
                    <th className="p-4 whitespace-nowrap text-right">Processing fees</th>
                    <th className="p-4 whitespace-nowrap text-right">Net</th>
                    <th className="p-4 whitespace-nowrap text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payoutRows.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 whitespace-nowrap text-gray-900 font-medium">{p.businessName}</td>
                      <td className="p-4 whitespace-nowrap text-gray-500">
                        {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap text-gray-900">
                        {formatBookingMoney(p.grossBusinessOwnedCents)}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap text-rose-600">
                        -{formatBookingMoney(p.processingFeesCents)}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap text-[#D97706] font-semibold">
                        {formatBookingMoney(p.netPayoutCents)}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${statusBadgeStyle(p.status === "PAID" ? "Payout sent" : "Pending")}`}>
                          {p.status === "PAID" ? "Payout sent" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {payoutRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500 font-medium">
                        No payouts have been sent yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left font-sans text-xs border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-gray-100 text-gray-700 font-semibold">
                  <th className="p-4 whitespace-nowrap">Date/Time</th>
                  <th className="p-4 whitespace-nowrap">Business</th>
                  <th className="p-4 whitespace-nowrap">Type & Booking</th>
                  <th className="p-4 whitespace-nowrap text-right">Gross</th>
                  <th className="p-4 whitespace-nowrap text-right">Net</th>
                  <th className="p-4 whitespace-nowrap text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 whitespace-nowrap text-gray-900 font-normal">
                      {formatDate(t.date)}
                    </td>
                    <td className="p-4 whitespace-nowrap text-gray-900 font-medium">
                      {t.businessName}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-gray-900">{feeTypeLabel[t.type]}</span>
                        <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                          <span>{t.bookingReference}</span>
                          <span>•</span>
                          <span>{t.customerName}</span>
                          <span className="px-1.5 py-0.5 bg-[#E2E8F0] text-gray-600 rounded text-[9px] font-semibold">
                            {badgeLabel[t.owner]}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap text-gray-900 font-normal">
                      {formatBookingMoney(t.grossCents)}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap text-[#D97706] font-semibold">
                      {formatBookingMoney(t.netCents)}
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${statusBadgeStyle(rowStatusLabel(t))}`}>
                        {rowStatusLabel(t)}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500 font-medium">
                      {transactionsQuery.isLoading ? "Loading…" : "No transactions recorded under this filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}

          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 bg-white text-xs text-gray-500">
            <span>Page {page} · {total} total</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-[#6366F1] font-semibold hover:underline disabled:opacity-30 disabled:no-underline"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= total}
                className="text-[#6366F1] font-semibold hover:underline disabled:opacity-30 disabled:no-underline"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
