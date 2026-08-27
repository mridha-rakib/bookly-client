"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Clock01Icon,
  UserGroup03Icon as UsersIcon,
  Car04Icon,
  AlertCircleIcon,
  UserBlock01Icon as NoShowIcon,
  Link02Icon
} from "@hugeicons/core-free-icons";

import type { Service } from "@/lib/api/services";
import {
  formatAssignedStaffSummary,
  formatCitiesSummary,
  formatDiscount,
  formatServiceDuration,
  formatServiceMinMax,
  formatServicePrice
} from "@/lib/services/format";

const EditDotsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

interface ServiceCardProps {
  service: Service;
  /** Business-wide Cancellation & No-show policy percentage. Undefined while loading, on
   * error, or when the business has not configured a policy yet — never a fabricated default. */
  noShowPercentage?: number;
  /** Count of currently-active Add-ons assigned to this Service. Undefined/0 hides the row. */
  addonCount?: number;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onToggleActive: () => void;
  isMutating?: boolean;
}

export default function ServiceCard({
  service,
  noShowPercentage,
  addonCount,
  onView,
  onEdit,
  onArchive,
  onToggleActive,
  isMutating
}: ServiceCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const price = formatServicePrice(service);
  const duration = formatServiceDuration(service);
  const minMax = formatServiceMinMax(service);
  const staffSummary = formatAssignedStaffSummary(service.assignedStaff);
  const citiesSummary = formatCitiesSummary(service.servedCities);
  const discount = formatDiscount(service);
  const isDraft = service.status === "DRAFT";
  const isActive = service.status === "ACTIVE";
  const title = service.isPackageDeal ? service.name : service.name;
  const subtitle = service.serviceCategoryName;

  return (
    <div className="bg-white border border-[#F5F5F4] rounded-2xl p-6 flex flex-col justify-between shadow-sm min-h-[456px]">
      <div>
        {/* Card Header */}
        <div className="flex justify-between items-start border-b border-neutral-100 pb-3 mb-4">
          <div className="flex flex-col">
            <h3 className="font-semibold text-lg text-[#1C1917] leading-7">{title}</h3>
            <span className="text-xs font-light text-[#757575] mt-0.5">{subtitle}</span>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="w-8 h-8 rounded-full hover:bg-neutral-50 flex items-center justify-center text-neutral-400 cursor-pointer"
            >
              <EditDotsIcon />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 bg-white border border-[#EFEFED] rounded-lg shadow-lg w-28 py-1.5 z-50 text-xs font-poppins font-medium text-[#111111]">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onView();
                    }}
                    className="px-4 py-2 hover:bg-neutral-50 w-full text-left cursor-pointer"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                    className="px-4 py-2 hover:bg-neutral-50 w-full text-left cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onArchive();
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

        {/* Price row */}
        <div className="flex items-baseline gap-1 mb-6">
          <span className="text-2xl font-bold text-[#1C1917] tracking-tight">{price.amount}</span>
          {price.suffix && <span className="text-xs text-[#757575] font-normal">{price.suffix}</span>}
        </div>

        {/* Detail Rows */}
        <div className="flex flex-col gap-3">
          {duration && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 text-neutral-500">
                <HugeiconsIcon icon={Clock01Icon} className="w-4 h-4" />
                <span>Duration</span>
              </div>
              <span className="font-medium text-[#111111]">{duration}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3 text-neutral-500">
              <HugeiconsIcon icon={UsersIcon} className="w-4 h-4" />
              <span>Staff</span>
            </div>
            <div className="flex items-center gap-1 font-medium text-[#111111]">
              <span>{staffSummary.primary}</span>
              {staffSummary.suffix && (
                <>
                  <span className="w-1 h-1 bg-neutral-400 rounded-full" />
                  <span>{staffSummary.suffix}</span>
                </>
              )}
            </div>
          </div>

          {minMax && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 text-neutral-500">
                <HugeiconsIcon icon={UsersIcon} className="w-4 h-4" />
                <span>Min/Max</span>
              </div>
              <span className="font-medium text-[#111111]">{minMax}</span>
            </div>
          )}

          {citiesSummary.primary && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 text-neutral-500">
                <HugeiconsIcon icon={Car04Icon} className="w-4 h-4" />
                <span>Travel to</span>
              </div>
              <div className="flex items-center gap-1 font-medium text-[#111111]">
                <span>{citiesSummary.primary}</span>
                {citiesSummary.suffix && (
                  <>
                    <span className="w-1 h-1 bg-neutral-400 rounded-full" />
                    <span>{citiesSummary.suffix}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {addonCount !== undefined && addonCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 text-neutral-500">
                <HugeiconsIcon icon={Link02Icon} className="w-4 h-4" />
                <span>Add-ons</span>
              </div>
              <span className="font-medium text-[#111111]">
                {addonCount} add-on{addonCount === 1 ? "" : "s"}
              </span>
            </div>
          )}

          {service.sessionExpiryAlert.enabled && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 text-neutral-500">
                <HugeiconsIcon icon={AlertCircleIcon} className="w-4 h-4" />
                <span>Expiry alert</span>
              </div>
              <span className="font-medium text-[#111111]">
                {service.sessionExpiryAlert.minutesBeforeSessionEnds} min before
              </span>
            </div>
          )}

          {noShowPercentage !== undefined && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 text-neutral-500">
                <HugeiconsIcon icon={NoShowIcon} className="w-4 h-4" />
                <span>No-show</span>
              </div>
              <span className="font-medium text-[#111111]">{noShowPercentage}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Badges block */}
      <div className="flex gap-2 mt-5 mb-4 shrink-0">
        {service.isFeatured && (
          <span className="bg-[#E9F2FF] text-[#2D47C8] text-xs font-normal px-2.5 py-1 rounded-full">
            Featured
          </span>
        )}
        {discount && (
          <span className="bg-[#DFFDDF] text-[#176117] text-xs font-normal px-2.5 py-1 rounded-full">
            {discount}
          </span>
        )}
      </div>

      {/* Bottom Row */}
      <div className="border-t border-[#F5F5F4] pt-4 shrink-0">
        <div className="flex justify-between items-center w-full">
          <span className="text-[13px] font-medium text-[#57534D]">
            {isDraft ? "Draft Mode" : isActive ? "Currently Active" : "Currently Inactive"}
          </span>
          <button
            type="button"
            disabled={isMutating || isDraft}
            onClick={onToggleActive}
            className={`w-[36px] h-[20px] rounded-full p-[2px] transition-colors duration-200 focus:outline-none flex items-center ${
              !isDraft && isActive ? "bg-[#8EBAC5]" : "bg-neutral-300"
            } ${isMutating || isDraft ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
          >
            <div
              className={`w-[16px] h-[16px] bg-white rounded-full transition-transform duration-200 ${
                !isDraft && isActive ? "translate-x-[16px]" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
