import Image from "next/image";
import React from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon } from "@hugeicons/core-free-icons";

export interface Recommendation {
  id: string;
  title: string;
  rating: number | null;
  reviews: number;
  categories: string[];
  location?: string;
  distance?: string;
  lastVisited?: string;
  startingPrice: number | null;
  startingPriceSuffix?: string;
  image: string | null;
  travelsToYou?: boolean;
  travelLocations?: string[];
  hasDiamond?: boolean;
  noDeposit?: boolean;
  /** Batch 16 — real Businesses that are no longer publicly visible (e.g. a Favorite whose
   * Business was later SUSPENDED) degrade the card rather than vanish or pretend to be bookable. */
  isAvailable?: boolean;
}

interface ServiceCardProps {
  rec: Recommendation;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onBookNow?: (id: string) => void;
  hasDiamond?: boolean;
  noDeposit?: boolean;
  travelsToYou?: boolean;
  className?: string;
}

export default function ServiceCard({
  rec,
  isFavorite,
  onToggleFavorite,
  onBookNow,
  hasDiamond = rec.hasDiamond,
  noDeposit = rec.noDeposit,
  travelsToYou = rec.travelsToYou,
  className = "w-full sm:w-[360px] md:w-[406px]",
}: ServiceCardProps) {
  const router = useRouter();
  const isAvailable = rec.isAvailable ?? true;
  return (
    <div
      onClick={() => {
        if (isAvailable) router.push(`/venue?id=${rec.id}`);
      }}
      className={`${className} h-full bg-white border border-[#E8E6FF] rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col group font-poppins shrink-0 ${isAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
    >
      {/* Card Image Area */}
      <div className="relative w-full h-[140px] xs:h-[180px] sm:h-[220px] md:h-[241px] p-[4px] bg-transparent overflow-hidden shrink-0">
        {rec.image ? (
          <Image src={rec.image} alt={rec.title} className="w-full h-full rounded-[8px] object-cover group-hover:scale-105 transition-transform duration-300" draggable="false" fill />
        ) : (
          <div className="w-full h-full rounded-[8px] bg-neutral-100 flex items-center justify-center">
            <span className="text-neutral-400 text-xs font-medium">{rec.title}</span>
          </div>
        )}

        {!isAvailable && (
          <div className="absolute top-[10px] sm:top-[14px] left-[10px] sm:left-[14px] px-2.5 py-1 bg-neutral-900/80 text-white text-[9px] sm:text-[10px] font-semibold rounded-full z-10 uppercase tracking-wide">
            No longer available
          </div>
        )}

        {/* Premium Diamond Badge Overlay (Top Left) */}
        {hasDiamond && (
          <div className="absolute top-[8px] sm:top-[12px] left-[8px] sm:left-[12px] w-6 h-6 sm:w-9 sm:h-9 rounded-full bg-[#2E9DA7] flex items-center justify-center shadow-sm z-10">
            <Image src="/Icons/diamond.svg" alt="Premium" className="w-3 h-3 sm:w-4 sm:h-4 object-contain" draggable="false" width={12} height={12} />
          </div>
        )}

        {/* Favorite Heart Icon Overlay */}
        <button
          className="absolute top-[10px] sm:top-[14px] right-[10px] sm:right-[14px] rounded-full backdrop-blur-sm flex items-center justify-center text-[#E49D12] hover:bg-white active:scale-90 transition-all cursor-pointer z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(rec.id);
          }}
        >
          <Image src={isFavorite ? "/Icons/whiteHeart.svg" : "/Icons/whiteHeartwithoutfill.svg"} alt="Heart" className="w-4 h-4 sm:w-[24px] sm:h-[24px]" draggable="false" width={16} height={16} />
        </button>

        {/* No Deposit Needed Badge Overlay (Bottom Left) */}
        {noDeposit && (
          <div className="absolute bottom-[8px] sm:bottom-[12px] left-[8px] sm:left-[12px] px-2 py-0.5 sm:w-[152px] sm:h-[22px] bg-[#2E9DA7] text-white flex items-center justify-center gap-0.5 rounded-full text-[9px] sm:text-xs font-medium shadow-sm z-10 whitespace-nowrap">
            <span>No deposit</span>
            <span className="hidden sm:inline"> needed</span>
            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white shrink-0 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Travels to You Badge Overlay (Bottom Right) */}
        {travelsToYou && (
          <div className="absolute bottom-[8px] sm:bottom-[11px] right-[8px] sm:right-[11px] px-2 py-0.5 sm:w-[130px] sm:h-[24px] bg-[#2E9DA7] text-white flex items-center justify-center gap-1 sm:gap-1.5 rounded-full text-[9px] sm:text-xs font-medium shadow-sm z-10 whitespace-nowrap">
            <Image src="/Icons/van.svg" alt="Van" className="w-3 h-2.5 sm:w-4 sm:h-3.5 object-contain inline-block" draggable="false" width={12} height={8} />
            <span>Travels to you</span>
          </div>
        )}
      </div>

      {/* Card Details Area */}
      <div className="px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-[20px] flex-1 flex flex-col gap-3 sm:gap-[16px]">
        {/* Title & Star Rating */}
        <div className="flex justify-between items-start gap-2 sm:gap-4">
          <h3 className="text-xs sm:text-sm md:text-base font-semibold leading-tight text-[#1C1B1C] line-clamp-2">
            {rec.title}
          </h3>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <Image src="/Icons/star.svg" alt="star" className="w-[12px] h-[12px] sm:w-[16px] sm:h-[16px]" draggable="false" width={24} height={24} />
            {rec.rating !== null ? (
              <>
                <span className="text-[10px] sm:text-xs font-semibold text-[#1C1B1C]">{rec.rating}</span>
                <span className="text-[9px] sm:text-xs font-medium text-[#757575]">({rec.reviews})</span>
              </>
            ) : (
              <span className="text-[9px] sm:text-xs font-medium text-[#757575]">New</span>
            )}
          </div>
        </div>

        {/* Categories/Tags */}
        <div className="flex flex-wrap gap-1 sm:gap-2">
          {rec.categories.map((cat, i) => (
            <span
              key={i}
              className="text-[8px] sm:text-[10px] font-semibold text-[#4E5F78] border border-[#4E5F78] px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full uppercase tracking-wider"
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Location details */}
        {travelsToYou ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-[4px] sm:gap-[8px] flex-nowrap w-full overflow-hidden">
              <div className="flex items-center gap-[4px] sm:gap-[8px] shrink-0">
                <Image src="/Icons/colorfulVan.svg" alt="Van" className="w-[12px] h-[12px] sm:w-[16px] sm:h-[16px] object-contain" draggable="false" width={24} height={24} />
                <span className="font-poppins font-medium text-[10px] sm:text-[12px] leading-[16px] sm:leading-[20px] tracking-[0.01em] text-[#2E9DA7] block">
                  Travels to you
                </span>
              </div>
              {rec.travelLocations?.map((loc, i) => (
                <span
                  key={i}
                  className="text-[10px] sm:text-[12px] font-normal leading-[16px] sm:leading-[20px] text-[#757575] bg-white border border-neutral-100 px-[6px] py-[1px] sm:px-[8px] sm:py-[2px] rounded-[99px] shrink-0"
                >
                  {loc}
                </span>
              ))}
            </div>
            {rec.lastVisited && (
              <span className="text-[9px] sm:text-[11px] text-[#757575] font-medium pl-4 sm:pl-6">{rec.lastVisited}</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-[#757575] font-medium">
              <HugeiconsIcon icon={Location01Icon} size={12} className="sm:hidden" />
              <HugeiconsIcon icon={Location01Icon} size={16} className="hidden sm:inline" />
              <span>{rec.location}</span>
              {rec.distance && (
                <>
                  <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-neutral-300 mx-0.5 sm:mx-1"></span>
                  <span>{rec.distance}</span>
                </>
              )}
            </div>
            {rec.lastVisited && (
              <span className="text-[9px] sm:text-[11px] text-[#757575] font-medium pl-4 sm:pl-5">{rec.lastVisited}</span>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-neutral-100 pt-3 sm:pt-4 mt-auto flex justify-between items-center gap-2 sm:gap-4">
          <div className="flex flex-col">
            <span className="text-[8px] sm:text-[10px] font-semibold text-[#757575] uppercase tracking-wider">Starting Price</span>
            <span className="text-sm sm:text-lg md:text-xl font-bold text-[#1C1B1C]">
              {rec.startingPrice !== null ? (
                <>
                  ${rec.startingPrice}
                  {rec.startingPriceSuffix}
                </>
              ) : (
                "Price on request"
              )}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isAvailable) onBookNow?.(rec.id);
            }}
            disabled={!isAvailable}
            className="bg-[#131313] hover:bg-black text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-semibold tracking-wide transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
}
