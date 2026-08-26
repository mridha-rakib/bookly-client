"use client";

import React, { useRef, useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import CreatePromoDrawer from "./CreatePromoDrawer";
import type { PromoDetail, PromoListItem, PromoScope, PromoType } from "@/lib/api/promo";
import {
  useDeletePromoMutation,
  usePromoDetailQuery,
  usePromoListQuery,
  usePromoRedemptionsQuery,
  useSetPromoStatusMutation,
} from "@/lib/promo/hooks";

interface SuperAdminPromoCodeProps {
  onClientClick?: (customerUserId: string) => void;
}

const scopeLabel: Record<PromoScope, string> = {
  ALL_FIRST_BOOKINGS: "All first bookings",
  ALL_BOOKINGS: "All bookings",
  SELECTED_BUSINESSES: "Select Businesses",
};

const typeLabel = (type: PromoType) => (type === "PERCENTAGE" ? "%" : "Fixed €");

const formatValue = (promo: Pick<PromoListItem, "type" | "value">) =>
  promo.type === "PERCENTAGE" ? `${promo.value}% off` : `€${promo.value} off`;

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const formatDiscountLabel = (row: { promoDiscountCents: number }) =>
  `-€${(row.promoDiscountCents / 100).toFixed(2)}`;

export default function SuperAdminPromoCode({ onClientClick }: SuperAdminPromoCodeProps) {
  const [activeTab, setActiveTab] = useState<"All" | "Active" | "Expired" | "Deactivated">("All");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedPromo, setSelectedPromo] = useState<PromoListItem | null>(null);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number } | null>(null);
  const [usageLogPromoId, setUsageLogPromoId] = useState<string | null>(null);

  const listQuery = usePromoListQuery({ limit: 100 });
  const editingPromoQuery = usePromoDetailQuery(editingPromoId ?? undefined);
  const setStatusMutation = useSetPromoStatusMutation();
  const deleteMutation = useDeletePromoMutation();

  const promoCodes = listQuery.data?.promos ?? [];

  const usageLogPromo = usageLogPromoId ?? promoCodes[0]?.id;
  const redemptionsQuery = usePromoRedemptionsQuery(usageLogPromo, { limit: 20 });

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
        setSelectedPromo(null);
        setDropdownCoords(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleActionClick = (e: React.MouseEvent<HTMLButtonElement>, promo: PromoListItem) => {
    e.stopPropagation();
    if (openDropdownId === promo.id) {
      setOpenDropdownId(null);
      setSelectedPromo(null);
      setDropdownCoords(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const left = Math.max(16, rect.right - 144);
      const spaceBelow = window.innerHeight - rect.bottom;
      let top = rect.bottom + 4;
      if (spaceBelow < 140) {
        top = rect.top - 114;
      }
      setOpenDropdownId(promo.id);
      setSelectedPromo(promo);
      setDropdownCoords({ top, left });
    }
  };

  const handleToggleDeactivate = async (promo: PromoListItem) => {
    const nextStatus = promo.status === "DEACTIVATED" ? "ACTIVE" : "DEACTIVATED";
    await setStatusMutation.mutateAsync({ promoId: promo.id, status: nextStatus });
    setOpenDropdownId(null);
    setSelectedPromo(null);
    setDropdownCoords(null);
  };

  const handleDelete = async (promo: PromoListItem) => {
    await deleteMutation.mutateAsync(promo.id);
    setOpenDropdownId(null);
    setSelectedPromo(null);
    setDropdownCoords(null);
  };

  const handleEditClick = (promo: PromoListItem) => {
    setEditingPromoId(promo.id);
    setIsDrawerOpen(true);
    setOpenDropdownId(null);
    setSelectedPromo(null);
    setDropdownCoords(null);
  };

  const handleCreateClick = () => {
    setEditingPromoId(null);
    setIsDrawerOpen(true);
  };

  const filteredPromoCodes = promoCodes.filter((c) => {
    if (activeTab === "All") return true;
    return c.status.toLowerCase() === activeTab.toLowerCase();
  });

  const getStatusBadge = (status: PromoListItem["status"]) => {
    switch (status) {
      case "ACTIVE":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F4EA] text-[#137333]">Active</span>;
      case "EXPIRED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F1F3F4] text-[#5F6368]">Expired</span>;
      case "DEACTIVATED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FCE8E6] text-[#C5221F]">Deactivated</span>;
    }
  };

  const usageLogs = redemptionsQuery.data?.redemptions ?? [];

  return (
    <div className="flex flex-col gap-6 w-full pb-12 font-sans">
      {/* Title & Create button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
        <h2 className="font-sans font-semibold text-2xl text-[#111827] leading-[32px]">
          Promo Code
        </h2>
        <button
          onClick={handleCreateClick}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111111] hover:bg-[#222222] text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer w-full sm:w-auto"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="w-4 h-4 text-white" />
          <span>Create Promo Code</span>
        </button>
      </div>

      {/* Main Promo Table Section */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden flex flex-col w-full">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 px-6 pt-4 gap-6 overflow-x-auto whitespace-nowrap scrollbar-none">
          {(["All", "Active", "Expired", "Deactivated"] as const).map((tab) => {
            const count =
              tab === "All"
                ? promoCodes.length
                : promoCodes.filter((c) => c.status.toLowerCase() === tab.toLowerCase()).length;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 text-sm font-medium transition-all relative flex items-center gap-2 cursor-pointer ${
                  isActive ? "text-[#2E9DA7] font-semibold" : "text-[#4E5F78]"
                }`}
              >
                <span>{tab}</span>
                {count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? "bg-[#2E9DA7]/20 text-[#195156]" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2E9DA7] rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Promo Codes Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans whitespace-nowrap">Code</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans whitespace-nowrap">Type</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans whitespace-nowrap">Value</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans whitespace-nowrap">Used / Limit</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans whitespace-nowrap">Expires</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans whitespace-nowrap">Scope</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500 font-sans">
                    Loading promo codes...
                  </td>
                </tr>
              )}
              {!listQuery.isLoading &&
                filteredPromoCodes.map((promo) => (
                  <tr
                    key={promo.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setUsageLogPromoId(promo.id)}
                  >
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 font-sans whitespace-nowrap">{promo.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-sans whitespace-nowrap">{typeLabel(promo.type)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 font-sans whitespace-nowrap">
                      {formatValue(promo)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-sans whitespace-nowrap">
                      {promo.redeemedCount} / {promo.totalUsageLimit ?? "∞"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-sans whitespace-nowrap">{formatDate(promo.expiresAt)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-sans whitespace-nowrap">{scopeLabel[promo.scope]}</td>
                    <td className="px-6 py-4 text-sm font-sans whitespace-nowrap">{getStatusBadge(promo.status)}</td>
                    <td className="px-6 py-4 text-sm font-sans text-right relative whitespace-nowrap">
                      <button
                        onClick={(e) => handleActionClick(e, promo)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full hover:bg-gray-50 text-xs font-medium text-gray-700 transition-colors cursor-pointer"
                      >
                        <span>Action</span>
                        <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              {!listQuery.isLoading && filteredPromoCodes.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500 font-sans">
                    No promo codes found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer with simple pagination indicators */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <span className="text-xs text-gray-500 font-sans">
            Showing 1–{filteredPromoCodes.length} of {filteredPromoCodes.length}
          </span>
        </div>
      </div>

      {/* Usage Logs Table Section */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden flex flex-col w-full mt-4">
        <div className="px-6 pt-4 pb-2">
          <h3 className="font-sans font-semibold text-sm text-gray-700">
            Usage log{usageLogPromo ? ` — ${promoCodes.find((p) => p.id === usageLogPromo)?.code ?? ""}` : ""}
          </h3>
          <p className="text-xs text-gray-400 font-sans mt-0.5">Click a promo code row above to view its usage log.</p>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans whitespace-nowrap">Client</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans whitespace-nowrap">Promo Code</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans whitespace-nowrap">Discount</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans whitespace-nowrap">Date & Time</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans whitespace-nowrap">Business</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {redemptionsQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500 font-sans">
                    Loading usage log...
                  </td>
                </tr>
              )}
              {!redemptionsQuery.isLoading &&
                usageLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-sans whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#E5F1F6] flex items-center justify-center text-xs font-semibold text-[#2E9DA7] shrink-0">
                          {log.customerEmail.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span
                            onClick={() => onClientClick && onClientClick(log.customerUserId)}
                            className="font-semibold text-gray-800 hover:text-[#2E9DA7] hover:underline cursor-pointer"
                          >
                            {log.customerEmail}
                          </span>
                          <span className="text-xs text-gray-400 font-normal">
                            {log.isFirstBooking ? "First booking" : "Returning booking"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-sans whitespace-nowrap">
                      <span className="px-2 py-1 bg-blue-50 text-[#1E40AF] text-xs font-medium rounded border border-blue-100 font-mono">
                        {log.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 font-sans whitespace-nowrap">
                      {formatDiscountLabel(log)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-sans whitespace-nowrap">
                      {new Date(log.redeemedAt).toLocaleString("en-GB", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800 font-sans font-medium whitespace-nowrap">{log.businessName}</td>
                  </tr>
                ))}
              {!redemptionsQuery.isLoading && usageLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500 font-sans">
                    No usage yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <span className="text-xs text-gray-500 font-sans">
            Showing 1–{usageLogs.length} of {redemptionsQuery.data?.pagination.total ?? 0}
          </span>
        </div>
      </div>

      {/* Slide-out Drawer */}
      <CreatePromoDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        editingPromo={editingPromoId ? (editingPromoQuery.data as PromoDetail | undefined) ?? null : null}
      />

      {/* Portal Action Dropdown */}
      {openDropdownId && selectedPromo && dropdownCoords && (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-transparent cursor-default"
            onClick={(e) => {
              e.stopPropagation();
              setOpenDropdownId(null);
              setSelectedPromo(null);
              setDropdownCoords(null);
            }}
          />

          <div
            style={{
              position: "fixed",
              top: `${dropdownCoords.top}px`,
              left: `${dropdownCoords.left}px`,
              width: "144px",
            }}
            className="bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] py-1 overflow-hidden font-sans"
          >
            <button
              onClick={() => handleEditClick(selectedPromo)}
              className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Edit
            </button>
            <button
              onClick={() => handleToggleDeactivate(selectedPromo)}
              className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {selectedPromo.status === "DEACTIVATED" ? "Activate" : "Deactivate"}
            </button>
            <button
              onClick={() => handleDelete(selectedPromo)}
              className="w-full text-left px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer border-t border-gray-100"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
