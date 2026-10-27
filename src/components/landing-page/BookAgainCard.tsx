"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Refresh01Icon } from "@hugeicons/core-free-icons";
import type { BookAgainCandidate } from "@/lib/api/bookings";

/** Existing Book Again history-card markup, shared with the landing row. No invented ratings,
 * current prices, availability badges or package-credit authority. */
export default function BookAgainCard({ item, isFav, onToggleFavorite, onRebook }: {
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
            <span className="text-neutral-400 text-xs font-medium px-2 text-center">{item.businessName}</span>
          </div>
        )}

        {/* Favorite Heart Icon Overlay */}
        <button
          className="absolute top-[10px] sm:top-[14px] right-[10px] sm:right-[14px] rounded-full backdrop-blur-sm flex items-center justify-center text-[#E49D12] hover:bg-white active:scale-90 transition-all cursor-pointer z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.businessId);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={isFav ? "/Icons/whiteHeart.svg" : "/Icons/whiteHeartwithoutfill.svg"}
            alt="Heart"
            className="w-4 h-4 sm:w-[24px] sm:h-[24px]"
            draggable="false"
          />
        </button>
      </div>

      {/* Details Section */}
      <div className="px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-[20px] flex-1 flex flex-col gap-2 sm:gap-3">
        <h3 className="text-sm md:text-base font-semibold leading-tight text-[#1C1B1C] line-clamp-2">
          {item.businessName}
        </h3>

        {/* Service & historical price (informational only — never reused as the new price) */}
        <div className="text-xs sm:text-sm font-semibold text-[#1C1B1C]">
          {item.primaryServiceName}
          <span className="text-[#757575] font-normal mx-1">•</span>
          <span className="text-[#757575] font-normal">
            Last paid {(item.originalTotalCents / 100).toFixed(2)} {item.currency}
          </span>
        </div>

        {/* Last Visited */}
        <div className="text-[11px] sm:text-xs font-normal text-[#757575] flex items-center gap-1.5">
          <span>
            Last visited{" "}
            {new Date(item.originalStartAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Rebook Button */}
        <button
          onClick={() => onRebook(item.businessId, item.serviceId)}
          className="w-full mt-3 bg-[#131313] hover:bg-black text-white py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 tracking-wide transition-all active:scale-95 cursor-pointer"
        >
          <HugeiconsIcon icon={Refresh01Icon} size={16} />
          <span>Rebook</span>
        </button>
      </div>
    </div>
  );
}
