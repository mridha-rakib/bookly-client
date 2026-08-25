"use client";

import React from "react";
import type { SuperAdminCustomerListItem } from "@/lib/api/superAdminCustomers";

interface SuperAdminCustomersTableProps {
  customers: SuperAdminCustomerListItem[];
  onSelectCustomer: (id: string) => void;
  pagination: { page: number; limit: number; total: number };
  onPageChange: (page: number) => void;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-[#16A34A] border border-[#16A34A]/10",
  DORMANT: "bg-amber-50 text-[#A37616] border border-[#A37616]/10",
  SUSPENDED: "bg-rose-50 text-[#E14747] border border-[#E14747]/10",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  DORMANT: "Dormant",
  SUSPENDED: "Suspended",
};

export default function SuperAdminCustomersTable({
  customers,
  onSelectCustomer,
  pagination,
  onPageChange,
}: SuperAdminCustomersTableProps) {
  const getInitials = (item: SuperAdminCustomerListItem) => {
    const name = [item.firstName, item.lastName].filter(Boolean).join(" ") || item.email;
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const from = customers.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-visible w-full">
      <div className="overflow-x-auto lg:overflow-visible w-full min-h-[240px]">
        <table className="w-full text-left font-sans text-xs border-collapse">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-gray-200">
              <th className="p-4 font-semibold text-gray-700 w-1/3">Customer</th>
              <th className="p-4 font-semibold text-gray-700">Registered</th>
              <th className="p-4 font-semibold text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-gray-400">
                  No customers match these filters.
                </td>
              </tr>
            )}
            {customers.map((c) => {
              const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
              return (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 bg-[#EEF2FF] text-[#4338CA]">
                        {getInitials(c)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <button
                          onClick={() => onSelectCustomer(c.id)}
                          className="font-semibold text-sm text-[#111827] hover:text-[#6366F1] hover:underline cursor-pointer truncate text-left bg-transparent border-none p-0"
                        >
                          {name}
                        </button>
                        <span className="text-[11px] text-[#4E5F78] truncate">{c.email}</span>
                        {c.phone && <span className="text-[11px] text-[#4E5F78] truncate">{c.phone.e164}</span>}
                      </div>
                    </div>
                  </td>

                  <td className="p-4 text-gray-900 font-normal">
                    {new Date(c.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>

                  <td className="p-4">
                    <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full ${STATUS_BADGE_CLASS[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 bg-white font-sans text-xs text-gray-500">
        <span>{pagination.total === 0 ? "No results" : `Showing ${from}-${to} of ${pagination.total}`}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page * pagination.limit >= pagination.total}
            className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
