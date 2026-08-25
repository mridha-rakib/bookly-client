"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, InformationCircleIcon, Search01Icon } from "@hugeicons/core-free-icons";

import type { PromoDetail, PromoScope, PromoType, PromoWriteInput } from "@/lib/api/promo";
import { useSuperAdminBusinessesQuery } from "@/lib/superAdminBusiness/hooks";
import { useCreatePromoMutation, useUpdatePromoMutation } from "@/lib/promo/hooks";

interface CreatePromoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editingPromo: PromoDetail | null;
}

const toDateInputValue = (iso?: string): string => (iso ? iso.slice(0, 10) : "");

export default function CreatePromoDrawer({ isOpen, onClose, editingPromo }: CreatePromoDrawerProps) {
  const [codeText, setCodeText] = useState("");
  const [discountType, setDiscountType] = useState<PromoType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState<number>(5);
  const [startDate, setStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [totalLimit, setTotalLimit] = useState<string>("100");
  const [perUserLimit, setPerUserLimit] = useState<string>("1");
  const [scope, setScope] = useState<PromoScope>("ALL_FIRST_BOOKINGS");
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>([]);
  const [businessSearch, setBusinessSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useCreatePromoMutation();
  const updateMutation = useUpdatePromoMutation();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const businessesQuery = useSuperAdminBusinessesQuery({
    q: businessSearch || undefined,
    limit: 50,
  });

  // React docs' "adjusting state when a prop changes" pattern (setState during render, guarded
  // by a change marker) — avoids the effect-based cascading-render lint error while still
  // resetting the form's local state whenever the drawer re-opens for a different promo (or a
  // fresh create).
  const resetKey = `${isOpen}:${editingPromo?.id ?? ""}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    if (editingPromo) {
      setCodeText(editingPromo.code);
      setDiscountType(editingPromo.type);
      setDiscountValue(editingPromo.value);
      setStartDate(toDateInputValue(editingPromo.startAt));
      setExpiryDate(toDateInputValue(editingPromo.expiresAt));
      setTotalLimit(editingPromo.totalUsageLimit ? String(editingPromo.totalUsageLimit) : "");
      setPerUserLimit(editingPromo.perUserUsageLimit ? String(editingPromo.perUserUsageLimit) : "");
      setScope(editingPromo.scope);
      setSelectedBusinessIds(editingPromo.businessIds);
    } else {
      setCodeText("");
      setDiscountType("PERCENTAGE");
      setDiscountValue(5);
      setStartDate("");
      setExpiryDate("");
      setTotalLimit("100");
      setPerUserLimit("1");
      setScope("ALL_FIRST_BOOKINGS");
      setSelectedBusinessIds([]);
    }
    setBusinessSearch("");
    setFormError(null);
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/\s/g, "");
    setCodeText(val);
  };

  const toggleBusiness = (businessId: string) => {
    setSelectedBusinessIds((prev) =>
      prev.includes(businessId) ? prev.filter((id) => id !== businessId) : [...prev, businessId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!codeText || !expiryDate) return;
    if (scope === "SELECTED_BUSINESSES" && selectedBusinessIds.length === 0) {
      setFormError("Select at least one business for this scope.");
      return;
    }

    const input: PromoWriteInput = {
      code: codeText,
      type: discountType,
      value: discountValue,
      scope,
      businessIds: scope === "SELECTED_BUSINESSES" ? selectedBusinessIds : [],
      startAt: startDate ? new Date(startDate).toISOString() : undefined,
      expiresAt: new Date(expiryDate).toISOString(),
      totalUsageLimit: totalLimit ? Number(totalLimit) : undefined,
      perUserUsageLimit: perUserLimit ? Number(perUserLimit) : undefined,
    };

    try {
      if (editingPromo) {
        await updateMutation.mutateAsync({ promoId: editingPromo.id, input });
      } else {
        await createMutation.mutateAsync(input);
      }
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save promo code.");
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-[100] transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <div
        className={`fixed right-0 top-0 h-screen w-full sm:w-[480px] bg-white shadow-[0px_10px_24px_rgba(0,0,0,0.12)] z-[101] flex flex-col font-sans transition-transform duration-300 ease-in-out transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 h-[70px] border-b border-gray-200 shrink-0">
          <h3 className="font-sans font-semibold text-lg text-[#111111]">
            {editingPromo ? "Edit Promo Code" : "Create Promo Code"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content Form */}
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 flex flex-col gap-5">
          {/* Code text */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700 font-sans">
              Code text (uppercase, no spaces)
            </label>
            <input
              type="text"
              value={codeText}
              onChange={handleCodeChange}
              placeholder="SUMMER25"
              required
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-sans focus:outline-none focus:border-[#2E9DA7] focus:bg-white transition-all text-[#111111]"
            />
          </div>

          {/* Discount type and value */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700 font-sans">Discount value</label>
            <div className="flex gap-2">
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as PromoType)}
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-sans focus:outline-none focus:border-[#2E9DA7] focus:bg-white text-[#111111]"
              >
                <option value="PERCENTAGE">%</option>
                <option value="FIXED">Fixed €</option>
              </select>
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                min={1}
                max={discountType === "PERCENTAGE" ? 100 : undefined}
                required
                className="flex-grow px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-sans focus:outline-none focus:border-[#2E9DA7] focus:bg-white transition-all text-[#111111]"
              />
            </div>
          </div>

          {/* Start Date & Expiry Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700 font-sans">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-sans focus:outline-none focus:border-[#2E9DA7] focus:bg-white transition-all text-[#111111]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700 font-sans">Expiry date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-sans focus:outline-none focus:border-[#2E9DA7] focus:bg-white transition-all text-[#111111]"
              />
            </div>
          </div>

          {/* Total limit & Per-user limit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700 font-sans">
                Total usage limit (blank = unlimited)
              </label>
              <input
                type="number"
                value={totalLimit}
                onChange={(e) => setTotalLimit(e.target.value)}
                min={1}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-sans focus:outline-none focus:border-[#2E9DA7] focus:bg-white transition-all text-[#111111]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700 font-sans">
                Per-user limit (blank = unlimited)
              </label>
              <input
                type="number"
                value={perUserLimit}
                onChange={(e) => setPerUserLimit(e.target.value)}
                min={1}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-sans focus:outline-none focus:border-[#2E9DA7] focus:bg-white transition-all text-[#111111]"
              />
            </div>
          </div>

          {/* Applicable scope */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700 font-sans">Applicable scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as PromoScope)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-sans focus:outline-none focus:border-[#2E9DA7] focus:bg-white text-[#111111]"
            >
              <option value="ALL_FIRST_BOOKINGS">All first bookings</option>
              <option value="ALL_BOOKINGS">All bookings</option>
              <option value="SELECTED_BUSINESSES">Select Businesses</option>
            </select>
          </div>

          {/* Business selector — only for SELECTED_BUSINESSES scope */}
          {scope === "SELECTED_BUSINESSES" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700 font-sans">
                Businesses ({selectedBusinessIds.length} selected)
              </label>
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                />
                <input
                  type="text"
                  value={businessSearch}
                  onChange={(e) => setBusinessSearch(e.target.value)}
                  placeholder="Search businesses..."
                  className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-sans focus:outline-none focus:border-[#2E9DA7] focus:bg-white transition-all text-[#111111]"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {businessesQuery.isLoading && (
                  <div className="px-3.5 py-3 text-xs text-gray-400 font-sans">Loading businesses...</div>
                )}
                {!businessesQuery.isLoading && businessesQuery.data?.businesses.length === 0 && (
                  <div className="px-3.5 py-3 text-xs text-gray-400 font-sans">No businesses found.</div>
                )}
                {businessesQuery.data?.businesses.map((business) => (
                  <label
                    key={business.id}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBusinessIds.includes(business.id)}
                      onChange={() => toggleBusiness(business.id)}
                      className="rounded border-gray-300 text-[#2E9DA7] focus:ring-[#2E9DA7]"
                    />
                    <span className="text-sm text-gray-800 font-sans">{business.name}</span>
                    <span className="text-xs text-gray-400 font-sans">{business.city}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Important Rules Block */}
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 flex gap-3 text-[#1E40AF]">
            <HugeiconsIcon icon={InformationCircleIcon} className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold font-sans">Important rules:</span>
              <ul className="text-xs font-sans list-disc list-inside space-y-1 opacity-90 leading-normal">
                <li>Discount applies to the online deposit charge only — never the service price</li>
                <li>Bookly funds every promo discount — Businesses always receive their full entitlement</li>
                <li>If a code covers the full deposit, €0 is charged but a card is still saved via Stripe</li>
                <li>Codes are not stackable — one per booking</li>
              </ul>
            </div>
          </div>

          {formError && (
            <div className="text-xs text-red-600 font-sans bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
              {formError}
            </div>
          )}

          {/* Bottom Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-6 mt-auto border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-[#4F46E5] hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-[#2E9DA7] hover:bg-[#25828a] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              {isSaving ? "Saving..." : editingPromo ? "Save Changes" : "Create Code"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
