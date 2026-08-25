"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Car04Icon } from "@hugeicons/core-free-icons";
import type { SuperAdminBusinessListItem } from "@/lib/api/superAdminBusiness";

interface SuperAdminBusinessesTableProps {
  businesses: SuperAdminBusinessListItem[];
  onView: (id: string) => void;
  onApprove: (id: string) => void;
  onSuspend: (id: string) => void;
  isMutating: boolean;
  pagination: { page: number; limit: number; total: number };
  onPageChange: (page: number) => void;
}

export default function SuperAdminBusinessesTable({
  businesses,
  onView,
  onApprove,
  onSuspend,
  isMutating,
  pagination,
  onPageChange,
}: SuperAdminBusinessesTableProps) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number } | null>(null);

  const handleActionClick = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (openDropdownId === id) {
      setOpenDropdownId(null);
      setDropdownCoords(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const left = rect.right - 112;
      const spaceBelow = window.innerHeight - rect.bottom;
      let top = rect.bottom + 4;
      if (spaceBelow < 120) {
        top = rect.top - 70;
      }
      setOpenDropdownId(id);
      setDropdownCoords({ top, left });
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-50 text-emerald-600";
      case "PENDING":
        return "bg-amber-50 text-amber-600";
      case "WARNING":
        return "bg-rose-50 text-rose-600";
      case "SUSPENDED":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-gray-50 text-gray-500";
    }
  };

  const getStatusLabel = (status: string) =>
    status.charAt(0) + status.slice(1).toLowerCase();

  const getAvatarInitials = (name: string) =>
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

  const from = businesses.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-visible w-full">
      <div className="overflow-x-auto lg:overflow-visible w-full min-h-[240px]">
        <table className="w-full text-left font-sans text-xs border-collapse">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-gray-200">
              <th className="p-4 font-semibold text-gray-700 w-1/4">Business</th>
              <th className="p-4 font-semibold text-gray-700">City</th>
              <th className="p-4 font-semibold text-gray-700">Status</th>
              <th className="p-4 font-semibold text-gray-700 text-center">Bookings</th>
              <th className="p-4 font-semibold text-gray-700 text-center">Rating</th>
              <th className="p-4 font-semibold text-gray-700">Member Since</th>
              <th className="p-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {businesses.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400">
                  No businesses match these filters.
                </td>
              </tr>
            )}
            {businesses.map((b) => {
              return (
                <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 bg-[#EEF2FF] text-[#4338CA]">
                        {getAvatarInitials(b.name)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm text-[#111827] truncate">{b.name}</span>
                        <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280] font-sans">
                          <span>{b.category}</span>
                          {b.visitType === "TRAVEL_TO_CUSTOMER" && (
                            <>
                              <span className="w-[3px] h-[3px] rounded-full bg-[#6B7280]" />
                              <HugeiconsIcon icon={Car04Icon} className="w-4 h-4 text-[#4E5F78] shrink-0" />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="p-4 text-gray-900 font-normal">{b.city}</td>

                  <td className="p-4">
                    <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full ${getStatusBadgeClass(b.status)}`}>
                      {getStatusLabel(b.status)}
                    </span>
                  </td>

                  <td className="p-4 text-center text-gray-900 font-normal">
                    {b.bookingsCount.toLocaleString()}
                  </td>

                  <td className="p-4 text-center text-gray-400">—</td>

                  <td className="p-4 text-gray-500 font-normal">
                    {new Date(b.memberSince).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>

                  <td className="p-4 relative overflow-visible">
                    <button
                      onClick={(e) => handleActionClick(e, b.id)}
                      disabled={isMutating}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-[#111827] rounded-full text-xs font-semibold text-[#111827] hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <span>Action</span>
                      <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5" />
                    </button>

                    {openDropdownId === b.id && (
                      <div
                        className="fixed inset-0 z-[9998] bg-transparent cursor-default"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(null);
                          setDropdownCoords(null);
                        }}
                      />
                    )}

                    {openDropdownId === b.id && dropdownCoords && (
                      <div
                        style={{
                          position: "fixed",
                          top: `${dropdownCoords.top}px`,
                          left: `${dropdownCoords.left}px`,
                          width: "112px",
                        }}
                        className="bg-white border border-gray-100 rounded-lg shadow-lg z-[9999] py-1 font-sans text-xs"
                      >
                        <button
                          onClick={() => {
                            onView(b.id);
                            setOpenDropdownId(null);
                            setDropdownCoords(null);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700"
                        >
                          View
                        </button>
                        {b.status !== "APPROVED" ? (
                          <button
                            onClick={() => {
                              onApprove(b.id);
                              setOpenDropdownId(null);
                              setDropdownCoords(null);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 text-emerald-600 font-semibold"
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              onSuspend(b.id);
                              setOpenDropdownId(null);
                              setDropdownCoords(null);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-rose-50 hover:text-rose-600 text-rose-600 font-semibold"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 bg-white font-sans text-xs text-gray-500">
        <span>
          {pagination.total === 0 ? "No results" : `Showing ${from}-${to} of ${pagination.total}`}
        </span>
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
