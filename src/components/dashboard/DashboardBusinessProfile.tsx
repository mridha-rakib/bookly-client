"use client";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

import React, { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PencilEdit02Icon,
  Location05Icon,
  Image01Icon
} from "@hugeicons/core-free-icons";

import AddBusinessLinkModal from "@/components/dashboard/AddBusinessLinkModal";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import type { BusinessCard as BusinessCardDto } from "@/lib/api/business";
import { useMyBusinessProfileQuery } from "@/lib/business/hooks";
import { toUserMessage } from "@/lib/auth/messages";

interface BusinessCardProps {
  type: "Primary" | "Secondary";
  title: string;
  rating?: number;
  reviews?: number;
  category?: string;
  subcategories: string[];
  location: string;
  startingPrice?: string;
  image?: string;
  onEdit?: () => void;
  onView?: () => void;
}

// Category may occasionally repeat one of the subcategory labels verbatim; dedupe so
// the same label never renders twice, but every distinct real value is kept and shown —
// the chip row wraps and the card grows to fit them all (see the Tags section below).
const buildDisplayChips = (category: string | undefined, subcategories: string[]): string[] => {
  const seen = new Set<string>();
  const chips: string[] = [];
  for (const value of [category, ...subcategories]) {
    const trimmed = value?.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      chips.push(trimmed);
    }
  }
  return chips;
};

export function BusinessCard({
  type,
  title,
  rating,
  reviews,
  category,
  subcategories,
  location,
  startingPrice,
  image,
  onEdit,
  onView
}: BusinessCardProps) {
  const isPrimary = type === "Primary";
  const displayChips = buildDisplayChips(category, subcategories);

  // The image URL is a short-lived presigned object-storage URL. If it fails to load (expired,
  // or the underlying object is missing) fall back to the same honest "No photo yet" state as a
  // business with no media at all — never a broken-image icon, never a fabricated photo. Tracking
  // the URL that failed (not a bare boolean) auto-resets when a fresh/different URL arrives.
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const showImage = Boolean(image) && failedImageUrl !== image;

  return (
    <div className="box-border flex flex-col items-start gap-5 w-[372px] min-h-[507px] rounded-xl bg-white border border-[#E8E6FF] overflow-hidden shadow-sm font-poppins">
      {/* Image Container */}
      <div className="relative w-full h-[233px] shrink-0">
        {showImage ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full rounded-t-xl object-cover"
            draggable="false"
            onError={() => setFailedImageUrl(image ?? null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 w-full h-full rounded-t-xl bg-neutral-100 text-neutral-400">
            <HugeiconsIcon icon={Image01Icon} className="w-8 h-8" />
            <span className="font-poppins text-xs">No photo yet</span>
          </div>
        )}
        {/* Overlay Badge */}
        <div
          className={`absolute flex flex-row justify-center items-center px-3 py-0.5 gap-2.5 h-6 left-3 top-3 rounded-full z-10 shadow-sm ${
            isPrimary
              ? "bg-[#8EBAC5] w-[71px]"
              : "bg-[#E0E0E0] w-[90px]"
          }`}
        >
          <span className="font-poppins font-normal text-xs text-[#111111] leading-5 text-center select-none">
            {type}
          </span>
        </div>
      </div>

      {/* Details Area */}
      <div className="flex flex-col justify-start items-start px-5 pb-5 pt-0 gap-4 w-[372px] min-h-[246px] flex-1">
        {/* Title & Star Rating */}
        <div className="flex flex-row justify-between items-start gap-4 w-[332px] h-16 shrink-0">
          <h3 className="w-[211px] h-16 font-poppins font-medium text-lg text-[#1C1B1C] leading-[32px] line-clamp-2">
            {title}
          </h3>

          {/* Rating */}
          <div className="flex flex-row items-center gap-2 w-[118px] h-5 shrink-0 select-none">
            <div className="flex flex-row items-center gap-1 w-[58px] h-5">
              <span className="text-[20px] text-[#E49D12] select-none leading-none">★</span>
              <span className="w-7 h-5 font-poppins font-medium text-lg text-[#1C1B1C] leading-5">
                {rating !== undefined ? rating.toFixed(1) : "0.0"}
              </span>
            </div>
            <span className="w-[52px] h-5 font-poppins font-medium text-lg text-[#757575] leading-5">
              {`(${reviews ?? 0})`}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-row flex-wrap items-start gap-2 w-full min-w-0 shrink-0 select-none">
          {displayChips.map((chip, i) => (
            <div key={i} className="box-border flex flex-row justify-center items-center px-3 py-0.5 border border-[#4E5F78] rounded-full shrink-0 max-w-full">
              <span className="font-poppins font-medium text-xs text-[#4E5F78] leading-5 uppercase tracking-wider text-center select-none">
                {chip}
              </span>
            </div>
          ))}
        </div>

        {/* Address */}
        <div className="flex flex-col items-start gap-2 h-6 shrink-0 select-none w-full">
          <div className="flex flex-row items-center gap-2 w-full">
            <HugeiconsIcon icon={Location05Icon} className="w-4 h-4 text-neutral-400 shrink-0" />
            <span className="font-poppins font-medium text-base text-[#757575] leading-6 select-none truncate min-w-0 flex-1">
              {location}
            </span>
          </div>
        </div>

        {/* Divider & Action */}
        <div className="box-border flex flex-row justify-between items-center pt-3 gap-2.5 w-[332px] h-[62px] border-t border-[#111111]/20 mt-auto shrink-0">
          {/* Price Frame */}
          <div className="flex flex-col items-start select-none">
            <span className="font-poppins font-medium text-xs text-[#757575] leading-5 tracking-wider uppercase whitespace-nowrap">
              Starting Price
            </span>
            <span className="font-poppins font-medium text-2xl text-[#1C1B1C] leading-[30px]">
              {startingPrice ?? "—"}
            </span>
          </div>

          {/* Button Frame */}
          {isPrimary ? (
            <button
              onClick={onEdit}
              className="flex flex-row justify-center items-center p-3 gap-2 w-[88px] h-12 bg-[#131313] hover:bg-black text-white rounded-xl transition-all select-none"
            >
              <HugeiconsIcon icon={PencilEdit02Icon} className="w-6 h-6 text-white shrink-0" />
              <span className="w-[30px] h-5 font-poppins font-medium text-base text-white leading-5">
                Edit
              </span>
            </button>
          ) : (
            <button
              onClick={onView}
              className="flex flex-row justify-center items-center p-3 gap-2.5 w-[63px] h-11 bg-[#131313] hover:bg-black text-white rounded-xl transition-all select-none"
            >
              <span className="w-[39px] h-5 font-poppins font-medium text-base text-white leading-5">
                View
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface DashboardBusinessProfileProps {
  onEditBusiness?: (businessId: string) => void;
  onViewBusiness?: (businessId: string) => void;
}

// Card DTO only carries {city, area}; street-level detail lives on the detail endpoint.
const toCardLocation = (business: BusinessCardDto): string =>
  [business.address.area, business.address.city].filter(Boolean).join(", ");

export default function DashboardBusinessProfile({
  onEditBusiness,
  onViewBusiness
}: DashboardBusinessProfileProps) {
  const { data, isLoading, isError, error } = useMyBusinessProfileQuery();
  const [isAddBusinessModalOpen, setIsAddBusinessModalOpen] = useState(false);

  useEffect(() => {
    if (isError) {
      toast.error(toUserMessage(error));
    }
  }, [isError, error]);

  const primary = data?.primary ?? null;
  const secondary = data?.secondary ?? [];
  const activeCount = (primary ? 1 : 0) + secondary.length;

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] select-none font-poppins w-full">
      <DashboardHeader
        title="Business Profile"
        subtitle="Public facing information shown on your booking page"
      />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

      {/* Frame 2147240061 Wrapper */}
      <div className="flex flex-col items-start gap-5 w-full">

        {/* Container (Toolbar) */}
        <div className="flex flex-row justify-between items-center w-full h-[37.6px]">

          {/* Active Pill Container */}
          <div className="box-border flex flex-row items-center px-4 py-2 gap-2 w-[102px] h-[38px] bg-white border border-[#F5F5F4] shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] rounded-full">
            {/* Dot */}
            <span className="w-1.5 h-1.5 bg-[#1D9E75] rounded-full shrink-0" />
            {/* Active Text */}
            <span className="w-[56px] h-5 font-poppins font-medium text-sm text-[#1F8900] leading-5 shrink-0 select-none">
              {activeCount} Active
            </span>
          </div>

          {/* Add existing business button */}
          <button
            onClick={() => setIsAddBusinessModalOpen(true)}
            className="flex flex-row items-center px-3.5 py-[7px] gap-1.5 w-[190px] h-[37.6px] bg-[#111111] hover:bg-black text-white rounded-lg transition-colors shadow-sm select-none cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="w-[142px] h-5 font-poppins font-medium text-[13px] text-white text-center leading-5 select-none">
              Add existing business
            </span>
          </button>
        </div>

        {/* Frame 2147240196 (Cards list) */}
        {isLoading ? (
          <div className="flex items-center justify-center w-full py-24">
            <Spinner className="text-[#111111] size-6" />
          </div>
        ) : (
          <div className="flex flex-row flex-wrap items-stretch gap-5 w-full select-none">
            {primary && (
              <BusinessCard
                type="Primary"
                title={primary.name}
                category={primary.category}
                subcategories={primary.subcategories}
                location={toCardLocation(primary)}
                image={primary.profileMedia?.url}
                onEdit={() => onEditBusiness?.(primary.id)}
              />
            )}

            {secondary.map((business) => (
              <BusinessCard
                key={business.id}
                type="Secondary"
                title={business.name}
                category={business.category}
                subcategories={business.subcategories}
                location={toCardLocation(business)}
                image={business.profileMedia?.url}
                onView={() => onViewBusiness?.(business.id)}
              />
            ))}
          </div>
        )}

      </div>

      </div>

      <AddBusinessLinkModal
        isOpen={isAddBusinessModalOpen}
        onClose={() => setIsAddBusinessModalOpen(false)}
      />
      </main>
  );
}
