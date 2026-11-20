"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BarCode01Icon,
  Directions01Icon,
  Calendar03Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";

import type { BookingListItem } from "@/lib/api/bookings";
import CustomerFinancialRows from "@/components/bookings/CustomerFinancialRows";
import { BookingStatusBadge, BookingVisitBadge } from "@/components/bookings/BookingBadges";
import CustomerFinancialOutcome from "@/components/bookings/CustomerFinancialOutcome";
import { presentCancellation, presentOnlineSnapshot, presentVenuePayment } from "@/lib/bookings/customer-financial";
import { useBusinessCatalogQuery } from "@/lib/catalog/hooks";
import { useCustomerBookingDetailQuery } from "@/lib/bookings/hooks";
import {
  buildBookingDirectionsUrl,
  formatBookingDate,
  formatBookingMoney,
  formatBookingTimeRange,
  formatPackageSessionLabel,
} from "@/lib/bookings/format";

// Mirrors api/src/modules/booking/booking.types.ts MAX_CUSTOMER_RESCHEDULE_COUNT.
const MAX_CUSTOMER_RESCHEDULE_COUNT = 2;


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
  // Only an UPCOMING booking can be rescheduled or cancelled; a PENDING one is a no-show under
  // the business's review and the API rejects both actions.
  const canChange = booking.status === "UPCOMING" && !booking.firstClassPackage;

  const businessProfileImg = business?.media?.find((m) => m.role === "PROFILE")?.url;

  return (
    <div className="w-full bg-[#FFFFFF] border border-[#E2E1E6] rounded-2xl shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all flex flex-col p-6 gap-6 font-manrope">
      <div className="flex flex-col md:flex-row gap-6 w-full items-start">
        <div className="w-[88px] h-[88px] border border-[#E2E1E6] rounded-2xl overflow-hidden flex-shrink-0 relative bg-neutral-100 shadow-inner">
          <Image
            src={businessProfileImg || "/image/imgOfService.png"}
            alt={business?.name ?? "Business"}
            fill
            className="object-cover"
            sizes="88px"
          />
        </div>

        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-manrope font-bold text-lg sm:text-xl leading-snug text-[#020305]">{booking.primaryServiceName}</h2>
            {booking.serviceCount > 1 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#F1EFEC] text-[#45474B]">+{booking.serviceCount - 1} more</span>
            )}
            <BookingStatusBadge status={booking.status} />
          </div>

          {booking.packageSessions.map((session, index) => (
            <p
              key={`${session.packageProgressId}-${session.sessionIndex}-${index}`}
              className="text-xs sm:text-sm font-semibold text-[#2E9DA7] font-manrope"
            >
              {formatPackageSessionLabel(session)}
            </p>
          ))}

          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[#1F2937]">
            <HugeiconsIcon icon={BarCode01Icon} className="w-3.5 h-3.5 text-[#1F2937]" />
            <span>Ref: {booking.reference}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-[#111111]">
            <div className="flex items-center gap-1.5 font-bold text-[#020305]">
              <Image src="/Icons/salonNameIcon.svg" className="w-[14px] h-[13px] object-contain" alt="salon" width={24} height={24} />
              <span>{business?.name ?? (catalogQuery.isLoading ? "Loading…" : "—")}</span>
            </div>
            {booking.staffNames.length > 0 && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-[#111827] font-semibold">with {booking.staffNames.join(", ")}</span>
              </>
            )}
          </div>

          {fulfilmentLocation && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {fulfilmentLocation.mode === "TRAVEL_TO_CUSTOMER" ? (
                <BookingVisitBadge mode={fulfilmentLocation.mode} />
              ) : (
                <>
                  <BookingVisitBadge mode={fulfilmentLocation.mode} addressText={`${fulfilmentLocation.address.streetName} ${fulfilmentLocation.address.streetNumber}, ${fulfilmentLocation.address.area}`} />
                  <span className="text-gray-300">•</span>
                  <a
                    href={buildBookingDirectionsUrl({
                      location: fulfilmentLocation.location,
                      addressText: `${fulfilmentLocation.address.streetName} ${fulfilmentLocation.address.streetNumber}, ${fulfilmentLocation.address.area}, ${fulfilmentLocation.address.city}`,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2E9DA7] font-semibold hover:underline flex items-center gap-1 text-xs sm:text-sm"
                  >
                    <HugeiconsIcon icon={Directions01Icon} className="w-3.5 h-3.5 text-[#2E9DA7]" />
                    <span>Get Directions</span>
                  </a>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#020305] bg-[#F7F6F3] px-3 py-1.5 rounded-xl border border-[#EFECE8]">
              <HugeiconsIcon icon={Calendar03Icon} className="w-4 h-4 text-[#45474B]" />
              <span>{formatBookingDate(booking.schedule.startAt, booking.schedule.timezone)}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#020305] bg-[#F7F6F3] px-3 py-1.5 rounded-xl border border-[#EFECE8]">
              <HugeiconsIcon icon={Clock01Icon} className="w-4 h-4 text-[#45474B]" />
              <span>{formatBookingTimeRange(booking.schedule)}</span>
            </div>
          </div>
        </div>

        <div className="w-full md:w-[200px] flex flex-col gap-2.5 flex-shrink-0 pt-1">
          <button
            onClick={() => router.push(`/customer/bookings/view?id=${booking.id}`)}
            className="w-full py-2.5 bg-[#0D0D0D] hover:bg-black text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow-sm text-center"
          >
            View Details
          </button>

          {isTerminal ? (
            <button
              onClick={() => router.push(`/venue?id=${booking.businessId}`)}
              className="w-full py-2.5 border border-[#C6C6CB] rounded-xl text-sm font-semibold transition-colors bg-[#FCF8F8] hover:bg-neutral-100 text-[#020305] cursor-pointer text-center"
            >
              Rebook
            </button>
          ) : (
            <>
              <button
                onClick={() => onReschedule(booking.id)}
                disabled={!canChange}
                className="w-full py-2.5 border border-[#C6C6CB] rounded-xl text-sm font-semibold transition-colors bg-[#FCF8F8] hover:bg-neutral-100 text-[#020305] cursor-pointer text-center disabled:opacity-50"
              >
                Reschedule
              </button>

              <button
                onClick={() => onCancel(booking.id)}
                disabled={!canChange}
                className={`w-full py-2.5 border rounded-xl text-sm font-semibold transition-colors text-center ${
                  !canChange
                    ? "bg-red-50/20 border-red-100 text-red-300 cursor-not-allowed"
                    : "bg-white border-red-200 text-[#BA1A1A] hover:bg-red-50 cursor-pointer"
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
      {booking.status === "PENDING" && (
        <p role="status" className="text-xs text-[#4E5F78] font-poppins">
          The business is reviewing this appointment as a possible no-show, so it can&apos;t be rescheduled or cancelled.
        </p>
      )}
      {canChange && (
        <p className="text-xs text-[#4E5F78] font-poppins">
          {MAX_CUSTOMER_RESCHEDULE_COUNT} free reschedules per booking.
        </p>
      )}
    </div>
  );
}
