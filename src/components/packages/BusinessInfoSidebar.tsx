"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Directions01Icon, Location05Icon } from "@hugeicons/core-free-icons";
import { useBusinessCatalogQuery } from "@/lib/catalog/hooks";
import { buildBookingDirectionsUrl } from "@/lib/bookings/format";

interface BusinessInfoSidebarProps {
  businessId?: string;
  fulfilmentLocation?: {
    streetName?: string;
    streetNumber?: string;
    area?: string;
    city?: string;
    floorUnit?: string;
    aptRoom?: string;
    location?: { lat: number; lng: number };
  };
}

export default function BusinessInfoSidebar({
  businessId,
  fulfilmentLocation,
}: BusinessInfoSidebarProps) {
  const catalogQuery = useBusinessCatalogQuery(businessId);
  const business = catalogQuery.data?.business;

  const profileImg = business?.media?.find((m) => m.role === "PROFILE")?.url;

  // Determine address: prefer snapshot fulfilment location if provided, else business address
  const streetName = fulfilmentLocation?.streetName ?? business?.address?.streetName;
  const streetNumber = fulfilmentLocation?.streetNumber ?? business?.address?.streetNumber;
  const area = fulfilmentLocation?.area ?? business?.address?.area;
  const city = fulfilmentLocation?.city ?? business?.address?.city;
  const floorUnit = fulfilmentLocation?.floorUnit;
  const aptRoom = fulfilmentLocation?.aptRoom;
  const coordinates = fulfilmentLocation?.location ?? business?.location;

  const completeAddress = Boolean(streetName && streetNumber && area && city);
  const mapQuery = completeAddress ? `${streetName} ${streetNumber}, ${area}, ${city}` : "";

  return (
    <aside
      aria-label="Business information"
      className="w-full lg:w-[320px] xl:w-[350px] shrink-0 flex flex-col gap-6"
    >
      <div className="w-full bg-[#FFFFFF] border border-[#E2E1E6] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col gap-5 font-manrope">
        {/* Business Profile Image & Title */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden relative border border-[#E2E1E6] bg-neutral-100 shrink-0 flex items-center justify-center shadow-inner">
            {profileImg ? (
              <Image
                src={profileImg}
                alt={business?.name ?? "Business"}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#F4F3EF] text-[#020305]">
                <Image
                  src="/Icons/salonNameIcon.svg"
                  alt="Salon"
                  width={32}
                  height={32}
                  className="opacity-70"
                />
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#888780]">
              Service Provider
            </span>
            <h2 className="font-manrope font-bold text-xl sm:text-2xl text-[#020305] leading-tight break-words">
              {business?.name ?? (catalogQuery.isLoading ? "Loading business…" : "Business information unavailable")}
            </h2>
            {business?.category && (
              <div className="mt-1">
                <span className="inline-block bg-[#F1EFEC] text-[#45474B] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {business.category}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Live Open / Closed Status Pill */}
        {business?.openStatus && (
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span
              className={`w-2 h-2 rounded-full ${
                business.openStatus.isOpen ? "bg-[#30AE5A]" : "bg-[#888780]"
              }`}
            />
            <span className={business.openStatus.isOpen ? "text-[#1F8900]" : "text-[#5F5E5A]"}>
              {business.openStatus.label}
            </span>
          </div>
        )}

        {/* Short Bio / Description */}
        {business?.briefDescription && (
          <p className="text-xs text-[#5F5E5A] leading-relaxed line-clamp-3">
            {business.briefDescription}
          </p>
        )}

        {/* Business / Service Location Snapshot */}
        <hr className="border-t border-[#EFECE8] w-full" />
        <div className="flex flex-col gap-2 text-xs">
          <span className="font-bold uppercase tracking-wider text-[#888780] text-[10px]">
            Service Provider Location
          </span>
          {completeAddress ? (
            <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#45474B]">
              <HugeiconsIcon icon={Location05Icon} className="w-4 h-4 text-[#45474B] mt-0.5 shrink-0" />
              <div className="flex flex-col">
                <span className="font-semibold text-[#020305]">
                  {streetName} {streetNumber}
                </span>
                <span>
                  {area}, {city}
                </span>
                {floorUnit && <span className="text-xs text-[#5F5E5A]">Floor / unit: {floorUnit}</span>}
                {aptRoom && <span className="text-xs text-[#5F5E5A]">Apartment / room: {aptRoom}</span>}
              </div>
            </div>
          ) : business?.address?.city ? (
            <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#45474B]">
              <HugeiconsIcon icon={Location05Icon} className="w-4 h-4 text-[#45474B] mt-0.5 shrink-0" />
              <span>Servicing {business.address.city} area</span>
            </div>
          ) : (
            <p className="text-xs text-[#5F5E5A]">Address details available on request.</p>
          )}

          {completeAddress && (
            <a
              href={buildBookingDirectionsUrl({ location: coordinates, addressText: mapQuery })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#2E9DA7] hover:underline mt-1"
            >
              <HugeiconsIcon icon={Directions01Icon} className="w-3.5 h-3.5" />
              <span>Get Directions</span>
            </a>
          )}
        </div>

        {/* View Venue Profile CTA Button */}
        {business?.id && (
          <div className="border-t border-[#E2E1E6] pt-4">
            <Link
              href={`/venue?id=${business.id}`}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0D0D0D] hover:bg-black text-white text-xs font-semibold py-2.5 px-4 transition-colors text-center"
            >
              View Venue Profile
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
