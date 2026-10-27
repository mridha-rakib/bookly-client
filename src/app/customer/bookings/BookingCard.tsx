"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BarCode01Icon,
  Location01Icon,
  Directions01Icon,
  Calendar03Icon,
  Clock01Icon,
  Car04Icon,
} from "@hugeicons/core-free-icons";

import type { BookingListItem } from "@/lib/api/bookings";
import CustomerFinancialRows from "@/components/bookings/CustomerFinancialRows";
import CustomerFinancialOutcome from "@/components/bookings/CustomerFinancialOutcome";
import { presentCancellation, presentOnlineSnapshot, presentVenuePayment } from "@/lib/bookings/customer-financial";
import { useBusinessCatalogQuery } from "@/lib/catalog/hooks";
import { useCustomerBookingDetailQuery } from "@/lib/bookings/hooks";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  buildBookingDirectionsUrl,
  formatBookingDate,
  formatBookingMoney,
  formatBookingTimeRange,
  formatPackageSessionLabel,
  type BookingStatusTone,
} from "@/lib/bookings/format";

// Mirrors api/src/modules/booking/booking.types.ts MAX_CUSTOMER_RESCHEDULE_COUNT.
const MAX_CUSTOMER_RESCHEDULE_COUNT = 2;

const TONE_CLASSES: Record<BookingStatusTone, string> = {
  info: "bg-[#CFE1FE] text-[#091C32]",
  success: "bg-[#CFFED6] text-[#093213]",
  warning: "bg-[#FEF8CF] text-[#322509]",
  danger: "bg-red-50 text-red-700",
  neutral: "bg-[#F1EDED] text-[#45474B]",
};

interface BookingCardProps {
  booking: BookingListItem;
  onReschedule: (id: string) => void;
  onCancel: (id: string) => void;
}

export default function BookingCard({ booking, onReschedule, onCancel }: BookingCardProps) {
  const router = useRouter();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Name/image/visit-type display only — the booking's own historical fulfilmentLocation
  // snapshot (never this live query) is the source of truth for address/Directions below.
  const catalogQuery = useBusinessCatalogQuery(booking.businessId);
  const business = catalogQuery.data?.business;
  const fulfilmentLocation = booking.fulfilmentLocation;
  const detailQuery = useCustomerBookingDetailQuery(isDetailOpen ? booking.id : undefined);
  const detail = detailQuery.data;

  const isUpcoming = booking.status === "UPCOMING" || booking.status === "PENDING";
  const isTerminal = !isUpcoming;
  const tone = BOOKING_STATUS_TONE[booking.status];

  return (
    <div className="w-full bg-[#FFFFFF] border border-[#C6C6CB] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col p-6 gap-6">
      <div className="flex flex-col md:flex-row gap-6 w-full items-start">
        <div className="w-[80px] h-[80px] border border-[#C6C6CB] rounded-lg overflow-hidden flex-shrink-0 relative bg-neutral-100">
          <Image src="/image/imgOfService.png" alt={business?.name ?? "Business"} fill className="object-cover" sizes="80px" />
        </div>

        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-manrope font-bold text-lg leading-7 text-[#020305]">{booking.primaryServiceName}</h2>
            {booking.serviceCount > 1 && (
              <span className="text-xs font-medium text-[#45474B]">+{booking.serviceCount - 1} more</span>
            )}
            <span className={`px-2.5 py-0.5 rounded-full font-manrope font-semibold text-xs leading-4 ${TONE_CLASSES[tone]}`}>
              {BOOKING_STATUS_LABELS[booking.status]}
            </span>
          </div>

          {booking.packageSessions.map((session, index) => (
            <p
              key={`${session.packageProgressId}-${session.sessionIndex}-${index}`}
              className="text-sm font-semibold text-[#3760B7] font-manrope"
            >
              {formatPackageSessionLabel(session)}
            </p>
          ))}

          <div className="flex items-center gap-1.5 text-sm text-[#111111] font-manrope">
            <HugeiconsIcon icon={BarCode01Icon} className="w-4 h-4 text-[#141B34]" />
            <span>{booking.reference}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-[#111111] font-manrope">
            <div className="flex items-center gap-1">
              <Image src="/Icons/salonNameIcon.svg" className="w-[13.4px] h-[12px] object-contain" alt="salon" width={24} height={24} />
              <span className="font-normal">{business?.name ?? (catalogQuery.isLoading ? "Loading…" : "—")}</span>
            </div>
            {booking.staffNames.length > 0 && (
              <>
                <span className="text-gray-400">•</span>
                <span className="font-normal">with {booking.staffNames.join(", ")}</span>
              </>
            )}
          </div>

          {fulfilmentLocation && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-[#111111] font-manrope">
              {fulfilmentLocation.mode === "TRAVEL_TO_CUSTOMER" ? (
                <div className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={Car04Icon} className="w-4 h-4 text-[#111111]" />
                  <span className="font-normal">Traveling to you</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <HugeiconsIcon icon={Location01Icon} className="w-4 h-4 text-[#111111]" />
                    <span className="font-normal">
                      {fulfilmentLocation.address.streetName} {fulfilmentLocation.address.streetNumber}, {fulfilmentLocation.address.area}
                    </span>
                  </div>
                  <span className="text-gray-400">•</span>
                  <a
                    href={buildBookingDirectionsUrl({
                      location: fulfilmentLocation.location,
                      addressText: `${fulfilmentLocation.address.streetName} ${fulfilmentLocation.address.streetNumber}, ${fulfilmentLocation.address.area}, ${fulfilmentLocation.address.city}`,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2E9DA7] font-normal hover:underline flex items-center gap-1"
                  >
                    <HugeiconsIcon icon={Directions01Icon} className="w-4 h-4 text-[#2E9DA7]" />
                    <span className="text-[#2E9DA7]">Get Directions</span>
                  </a>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm text-[#111111] font-manrope font-medium">
            <div className="flex items-center gap-1">
              <HugeiconsIcon icon={Calendar03Icon} className="w-4 h-4 text-[#111111]" />
              <span>{formatBookingDate(booking.schedule.startAt, booking.schedule.timezone)}</span>
            </div>
            <span className="text-gray-400">•</span>
            <div className="flex items-center gap-1">
              <HugeiconsIcon icon={Clock01Icon} className="w-4 h-4 text-[#111111]" />
              <span>{formatBookingTimeRange(booking.schedule)}</span>
            </div>
          </div>
        </div>

        <div className="w-full md:w-[209px] flex flex-col gap-3 flex-shrink-0">
          <button
            onClick={() => router.push(`/customer/bookings/view?id=${booking.id}`)}
            className="w-full py-2 bg-[#FCF8F8] border border-[#C6C6CB] rounded-lg text-sm font-medium text-[#020305] hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            View
          </button>

          {isTerminal ? (
            <button
              onClick={() => router.push(`/venue?id=${booking.businessId}`)}
              className="w-full py-2 border rounded-lg text-sm font-medium transition-colors bg-[#8EBAC5] bg-opacity-40 border-[#C6C6CB] text-[#020305] hover:bg-opacity-60 cursor-pointer"
            >
              Rebook
            </button>
          ) : (
            <>
              <button
                onClick={() => onReschedule(booking.id)}
                disabled={booking.firstClassPackage}
                className="w-full py-2 border rounded-lg text-sm font-medium transition-colors bg-[#FCF8F8] border-[#C6C6CB] text-[#020305] hover:bg-neutral-100 cursor-pointer"
              >
                Reschedule
              </button>

              <button
                onClick={() => onCancel(booking.id)}
                disabled={!isUpcoming || booking.firstClassPackage}
                className={`w-full py-2 border rounded-lg text-sm font-medium transition-colors ${
                  !isUpcoming
                    ? "bg-red-50/30 border-red-100/50 text-red-300 cursor-not-allowed"
                    : "bg-[#FCF8F8] border-[rgba(186,26,26,0.2)] text-[#BA1A1A] hover:bg-red-50 cursor-pointer"
                }`}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Payment / outcome details — fetched lazily, real BookingDetail only. */}
      <div className="w-full flex flex-col rounded-lg overflow-hidden border border-[#EBEBEB]">
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer select-none bg-[#FCFAF9] hover:bg-neutral-50 transition-colors"
          onClick={() => setIsDetailOpen((v) => !v)}
        >
          <span className="font-poppins font-medium text-base text-[#1C1B1C]">Payment details</span>
          <span className={`text-xs transform transition-transform duration-200 ${isDetailOpen ? "rotate-180" : ""}`}>▼</span>
        </div>

        {isDetailOpen && (
          <div className="p-4 flex flex-col gap-3 bg-[#FCFAF9] border-t border-[#EBEBEB] text-sm font-poppins">
            {detailQuery.isLoading ? (
              <span className="text-[#4E5F78]">Loading…</span>
            ) : !detail ? (
              <span className="text-[#4E5F78]">Details could not be loaded.</span>
            ) : (
              <>
                <div className="flex justify-between items-center text-[#4E5F78]">
                  <span>Service total</span>
                  <span className="font-manrope font-normal text-[#4E5F78]">
                    {formatBookingMoney(detail.financials.servicesSubtotalCents + detail.financials.addonsSubtotalCents)}
                  </span>
                </div>
                <CustomerFinancialRows rows={[presentOnlineSnapshot(detail), ...presentVenuePayment(detail)]} />
                <p className="text-xs text-[#4E5F78]">Historical booking amounts are not a current net provider balance.</p>
                {detailQuery.isError && <p role="status">The latest financial details could not be refreshed. Showing the last recorded information.</p>}
                {detail.cancellationOutcome && (
                  <>
                    <hr className="border-t border-[#EBEBEB] my-1" />
                    <CustomerFinancialRows rows={presentCancellation(detail.cancellationOutcome)} />
                  </>
                )}
                <CustomerFinancialOutcome booking={detail} />
                <hr className="border-t border-[#B3B3B3] my-1" />
                <p className="text-xs text-[#4E5F78]">
                  Cancellation and no-show fees, if any, are set by {business?.name ?? "the Business"}, not by Bookly, and
                  use discounted service and add-ons, excluding travel.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {booking.firstClassPackage && <p role="status" className="text-sm text-[#5F5E5A]">First-class Package session changes are unavailable. Open View for package details.</p>}
      {isUpcoming && !booking.firstClassPackage && (
        <p className="text-xs text-[#4E5F78] font-poppins">
          {MAX_CUSTOMER_RESCHEDULE_COUNT} free reschedules per booking.
        </p>
      )}
    </div>
  );
}
