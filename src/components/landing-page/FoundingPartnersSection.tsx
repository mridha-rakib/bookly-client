"use client";

import React from "react";

import type { FoundingPartnerCard } from "@/lib/api/discovery";
import { useFoundingPartnersQuery } from "@/lib/discovery/hooks";
import Carousel from "@/components/landing-page/Carousel";

/** Public landing "Trusted by local businesses across Cyprus" section — real founding partners
 * only (Business.isFoundingPartner + publicly-visible status, filtered server-side by
 * GET /discovery/founding-partners). No mock/demo businesses. When there are no founding
 * partners the whole section is hidden rather than shown empty or padded with fakes. */

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function FoundingPartnerAvatar({ business }: { business: FoundingPartnerCard }) {
  return (
    <div className="w-[129px] flex flex-col items-center gap-5 text-center select-none shrink-0 font-poppins">
      {business.imageUrl ? (
        // Signed, time-limited storage URL (not a static/known-host asset) — same reason
        // TrustedBusinessCard uses a plain <img>; next/image would need a remotePatterns entry.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={business.imageUrl}
          alt={business.name}
          className="w-[120px] h-[120px] rounded-full object-cover border border-[#E8E6FF]"
          draggable="false"
        />
      ) : (
        // No stored logo — a neutral initials placeholder, never a fabricated logo/photo
        // (same "don't fake an image" pattern as ServiceCard's empty state).
        <div className="w-[120px] h-[120px] rounded-full border border-[#E8E6FF] bg-neutral-100 flex items-center justify-center text-neutral-400 text-2xl font-semibold">
          {initialsOf(business.name)}
        </div>
      )}

      <div className="flex flex-col items-center gap-1 w-full">
        <h4 className="text-[18px] font-medium leading-[26px] text-[#111111] truncate w-full">
          {business.name}
        </h4>
        <span className="text-[16px] font-normal leading-[22px] text-[#5E598B] font-manrope truncate w-full">
          {business.city}
        </span>
        <span className="text-[14px] font-medium leading-[20px] text-[#111111] mt-1 truncate w-full">
          Founding Partner
        </span>
      </div>
    </div>
  );
}

export default function FoundingPartnersSection() {
  const { data, isLoading, isError } = useFoundingPartnersQuery();
  const businesses = data?.businesses ?? [];

  // Honest empty state: no founding partners (or the call failed) → render nothing at all,
  // rather than an empty heading or placeholder cards.
  if (isLoading || isError || businesses.length === 0) {
    return null;
  }

  return (
    <section className="w-full bg-[#FCFCFD] py-12 md:py-[72px] border-y border-neutral-100 mt-[24px]">
      <div className="w-full px-4 md:px-8 xl:px-[68px] flex flex-col items-center justify-center gap-10 md:gap-[80px]">
        <div className="flex flex-col items-center gap-4 text-center max-w-[1312px] w-full">
          <h2 className="text-3xl md:text-[36px] font-medium leading-[36px] md:leading-[48px] text-[#1F2937] tracking-tight">
            Trusted by local businesses across Cyprus
          </h2>
          <p className="text-lg md:text-[24px] font-normal leading-[24px] text-[#757575]">
            Join the businesses already growing with Bookly.
          </p>
        </div>

        <div className="w-full">
          {businesses.length > 5 ? (
            <Carousel gapClass="gap-[40px] md:gap-[80px]">
              {businesses.map((biz) => (
                <FoundingPartnerAvatar key={biz.id} business={biz} />
              ))}
            </Carousel>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 justify-items-center">
              {businesses.map((biz) => (
                <FoundingPartnerAvatar key={biz.id} business={biz} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
