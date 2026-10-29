"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Refresh01Icon,
  SparklesIcon,
  Calendar03Icon,
  ReceiptTextIcon,
  FavouriteIcon,
} from "@hugeicons/core-free-icons";
import type { BookAgainCandidate } from "@/lib/api/bookings";

function formatLastVisited(startAt?: string): string {
  if (!startAt) return "Last visited recently";
  if (startAt.toLowerCase().startsWith("last visited")) {
    return startAt;
  }
  const date = new Date(startAt);
  if (isNaN(date.getTime())) {
    return `Last visited ${startAt}`;
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Last visited today";
  if (diffDays === 1) return "Last visited yesterday";
  if (diffDays < 7) return `Last visited ${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `Last visited ${diffWeeks} ${diffWeeks === 1 ? "week" : "weeks"} ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `Last visited ${diffMonths} ${diffMonths === 1 ? "month" : "months"} ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `Last visited ${diffYears} ${diffYears === 1 ? "year" : "years"} ago`;
}

/** Existing Book Again history-card markup, shared with the landing row. */
export default function BookAgainCard({
  item,
  isFav,
  onToggleFavorite,
  onRebook,
}: {
  item: BookAgainCandidate;
  isFav: boolean;
  onToggleFavorite: (businessId: string) => void;
  onRebook: (businessId: string, serviceId: string) => void;
}) {
  return (
    <div
      key={item.originalBookingId}
      className="w-full max-w-[360px] md:max-w-[406px] h-full bg-white border border-[#E8E6FF] rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col group font-poppins shrink-0"
    >
      {/* Image Section */}
      <div className="relative w-full h-[140px] xs:h-[180px] sm:h-[220px] md:h-[241px] p-[4px] bg-transparent overflow-hidden shrink-0">
        {item.businessImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.businessImageUrl}
            alt={item.businessName}
            className="w-full h-[132px] xs:h-[172px] sm:h-[212px] md:h-[233px] rounded-[8px] object-cover group-hover:scale-105 transition-transform duration-300"
            draggable="false"
          />
        ) : (
          <div className="w-full h-[132px] xs:h-[172px] sm:h-[212px] md:h-[233px] rounded-[8px] bg-neutral-100 flex items-center justify-center">
            <span className="text-neutral-400 text-xs font-medium px-2 text-center">
              {item.businessName}
            </span>
          </div>
        )}

        {/* Favorite Heart Icon Overlay */}
        <button
          type="button"
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          title={isFav ? "Remove from favorites" : "Add to favorites"}
          className="group/fav absolute top-[8px] sm:top-[12px] right-[8px] sm:right-[12px] w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-white backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.12)] border border-neutral-100/80 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-90 cursor-pointer z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.businessId);
          }}
        >
          <HugeiconsIcon
            icon={FavouriteIcon}
            className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover/fav:scale-105 ${
              isFav
                ? "text-[#DE350B] fill-[#DE350B]"
                : "text-neutral-700 group-hover/fav:text-[#DE350B]"
            }`}
          />
        </button>
      </div>

      {/* Details Section */}
      <div className="px-3.5 pb-3.5 pt-3 sm:px-5 sm:pb-5 sm:pt-4 flex-1 flex flex-col justify-between gap-3">
        <div className="flex flex-col gap-2.5">
          {/* 1. Business Name */}
          <h3
            className="text-sm md:text-base font-semibold leading-tight text-[#1C1B1C] line-clamp-1 group-hover:text-[#2E9DA7] transition-colors"
            title={item.businessName}
          >
            {item.businessName}
          </h3>

          {/* 2. Primary Service with Accent Icon Badge */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-[#2E9DA7]/10 flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={SparklesIcon} size={12} className="text-[#2E9DA7]" />
            </div>
            <span
              className="text-xs sm:text-sm font-medium text-[#1C1B1C] truncate"
              title={item.primaryServiceName}
            >
              {item.primaryServiceName}
            </span>
          </div>

          {/* 3. Price & Visit History Details */}
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1.5 pt-1.5 border-t border-neutral-100 text-[11px] sm:text-xs text-[#757575]">
            {/* Historical Price */}
            <div className="flex items-center gap-1.5 shrink-0">
              <HugeiconsIcon icon={ReceiptTextIcon} size={13} className="text-[#2E9DA7] shrink-0" />
              <span>
                Last paid{" "}
                <span className="font-semibold text-[#1C1B1C]">
                  {(item.originalTotalCents / 100).toFixed(2)} {item.currency}
                </span>
              </span>
            </div>

            <span className="hidden sm:inline text-neutral-300 select-none">•</span>

            {/* Last Visited */}
            <div className="flex items-center gap-1.5 shrink-0">
              <HugeiconsIcon icon={Calendar03Icon} size={13} className="text-[#817469] shrink-0" />
              <span>{formatLastVisited(item.originalStartAt)}</span>
            </div>

          </div>
        </div>

        {/* 4. Rebook Button */}
        <button
          onClick={() => onRebook(item.businessId, item.serviceId)}
          className="w-full mt-1 bg-[#131313] hover:bg-black text-white py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 tracking-wide transition-all active:scale-95 cursor-pointer shadow-sm hover:shadow"
        >
          <HugeiconsIcon icon={Refresh01Icon} size={16} />
          <span>Rebook</span>
        </button>
      </div>
    </div>
  );
}
