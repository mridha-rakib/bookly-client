"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Link02Icon, Tag01Icon } from "@hugeicons/core-free-icons";

import type { Addon } from "@/lib/api/addons";
import { formatAttachedServicesSummary, formatEuro } from "@/lib/addons/format";

const EditDotsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

interface AddonCardProps {
  addon: Addon;
  onToggleActive: (addon: Addon) => void;
  isMenuOpen?: boolean;
  onMenuClick?: (id: string | null) => void;
  onViewClick?: (addon: Addon) => void;
  onEditClick?: (addon: Addon) => void;
  onDeleteClick?: (addon: Addon) => void;
  isMutating?: boolean;
}

export default function AddonCard({
  addon,
  onToggleActive,
  isMenuOpen = false,
  onMenuClick,
  onViewClick,
  onEditClick,
  onDeleteClick,
  isMutating
}: AddonCardProps) {
  const isDraft = addon.status === "DRAFT";
  const isActive = addon.status === "ACTIVE";
  const { primary: attachedPrimary, suffix: attachedSuffix } = formatAttachedServicesSummary(
    addon.assignedServices
  );

  return (
    <div
      className="box-sizing-border-box bg-white border border-[#F5F5F4] rounded-[16px] p-6 w-[352px] h-[280px] shadow-[0px_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between"
    >
      {/* Top Row: Name + Price */}
      <div className="border-b border-[#757575]/20 pb-6 mb-4 w-full flex justify-between items-start">
        <div className="flex flex-col gap-1.5">
          <h3 className="font-poppins font-medium text-[20px] leading-[28px] text-[#1C1917] select-none">
            {addon.name}
          </h3>
          <span className="font-poppins font-semibold text-[24px] leading-[32px] tracking-[-0.6px] text-[#1C1917] select-none">
            {addon.priceCents !== undefined ? formatEuro(addon.priceCents) : "—"}
          </span>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => onMenuClick?.(addon.id)}
            className="w-8 h-8 rounded-full hover:bg-neutral-50 flex items-center justify-center text-[#A6A09B] cursor-pointer"
          >
            <EditDotsIcon />
          </button>
          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={() => onMenuClick?.(null)}
              />
              <div className="absolute right-0 top-9 bg-white border border-[#EFEFED] rounded-lg shadow-lg w-28 py-1.5 z-50 text-xs font-poppins font-medium text-[#111111] animate-fadeIn">
                <button
                  type="button"
                  onClick={() => {
                    onMenuClick?.(null);
                    onViewClick?.(addon);
                  }}
                  className="px-4 py-2 hover:bg-neutral-50 w-full text-left cursor-pointer"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onMenuClick?.(null);
                    onEditClick?.(addon);
                  }}
                  className="px-4 py-2 hover:bg-neutral-50 w-full text-left cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onMenuClick?.(null);
                    onDeleteClick?.(addon);
                  }}
                  className="px-4 py-2 hover:bg-neutral-50 w-full text-left cursor-pointer text-[#D85A30]"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Middle Row: Details */}
      <div className="flex flex-col gap-3 w-full">
        {/* Attached to */}
        <div className="flex items-center gap-3 w-full">
          <HugeiconsIcon icon={Link02Icon} className="w-4 h-4 text-[#757575] shrink-0" />
          <div className="flex justify-between items-center flex-1">
            <span className="font-poppins font-normal text-sm leading-[20px] text-[#757575]">
              Attached to
            </span>
            <div className="flex items-center gap-1 bg-[#F9EAB9] text-[#824E1B] px-2 py-0.5 rounded-full text-xs font-normal font-poppins">
              <span>{attachedPrimary}</span>
              {attachedSuffix && (
                <>
                  <span className="w-1 h-1 bg-[#824E1B] rounded-full mx-0.5" />
                  <span>{attachedSuffix}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Service Category */}
        <div className="flex items-center gap-3 w-full">
          <HugeiconsIcon icon={Tag01Icon} className="w-4 h-4 text-[#757575] shrink-0" />
          <div className="flex justify-between items-center flex-1">
            <span className="font-poppins font-normal text-sm leading-[20px] text-[#757575]">
              Service category
            </span>
            <span className="font-poppins font-medium text-sm leading-[20px] text-[#111111]">
              {addon.customServiceCategoryName ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Footer Toggle */}
      <div className="border-t border-[#F5F5F4] pt-5 mt-auto flex justify-between items-center w-full">
        <span className="font-poppins font-medium text-sm leading-[20px] text-[#57534D] select-none">
          {isDraft ? "Draft Mode" : "Currently Active"}
        </span>
        <button
          type="button"
          disabled={isMutating}
          onClick={() => !isDraft && onToggleActive(addon)}
          className={`w-[36px] h-[20px] rounded-full p-[2px] transition-colors duration-200 focus:outline-none flex items-center ${
            !isDraft && isActive ? "bg-[#8EBAC5]" : "bg-neutral-300"
          } ${isDraft || isMutating ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
        >
          <div
            className={`w-[16px] h-[16px] bg-white rounded-full transition-transform duration-200 ${
              !isDraft && isActive ? "translate-x-[16px]" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
