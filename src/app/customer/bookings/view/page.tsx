"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon, Location05Icon, Calendar01Icon, Clock01Icon, Share05Icon, MapsIcon } from "@hugeicons/core-free-icons";

import { Suspense } from "react";

import RequireCustomer from "@/components/auth/RequireCustomer";
import { useAuthStore } from "@/lib/auth/store";
import { useCustomerBookingDetailQuery, useCancelByCustomerMutation } from "@/lib/bookings/hooks";
import { useBusinessCatalogQuery } from "@/lib/catalog/hooks";
import {
  bookingClientBadge,
  buildBookingDirectionsUrl,
  formatBookingDate,
  formatBookingMoney,
  formatBookingTimeRange,
  formatPackageSessionLabel,
} from "@/lib/bookings/format";
import { toUserMessage } from "@/lib/auth/messages";
import BookingReviewCard from "../BookingReviewCard";
import RescheduleModal from "../RescheduleModal";
import BookingLocationMap from "../BookingLocationMap";
import CustomerFinancialRows from "@/components/bookings/CustomerFinancialRows";
import { BookingStatusBadge, BookingVisitBadge } from "@/components/bookings/BookingBadges";
import CustomerFinancialOutcome from "@/components/bookings/CustomerFinancialOutcome";
import { presentCancellation, presentOnlineSnapshot, presentVenuePayment } from "@/lib/bookings/customer-financial";
import { FirstClassBookingContext } from "@/components/packages/FirstClassPackageIntegration";

function BookingViewRoute() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("id") ?? undefined;
  return <BookingViewContent key={bookingId ?? "missing"} bookingId={bookingId} />;
}
function BookingViewContent({ bookingId }: { bookingId?: string }) {

  const logout = useAuthStore((state) => state.logout);
  const isLoggedIn = true;

  const detailQuery = useCustomerBookingDetailQuery(bookingId);
  const booking = detailQuery.data;
  const packageLine = booking?.serviceLines.find((line) => line.packageProgressId);
  const firstClassLine = booking?.serviceLines.find((line) => line.packageItemId);

  const catalogQuery = useBusinessCatalogQuery(booking?.businessId);
  const business = catalogQuery.data?.business;

  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>(undefined);
  const cancelMutation = useCancelByCustomerMutation();

  const isUpcoming = !firstClassLine && (booking?.status === "UPCOMING" || booking?.status === "PENDING");
  const visitMode = booking?.fulfilment?.mode;
  const location = visitMode === "AT_BUSINESS_LOCATION" ? booking?.fulfilment.businessLocation
    : visitMode === "TRAVEL_TO_CUSTOMER" ? booking?.fulfilment.travelAddress : undefined;
  const completeAddress = location && [location.streetName, location.streetNumber, location.area, location.city].every((value) => typeof value === "string" && value.trim().length > 0);
  const mapQuery = completeAddress ? `${location.streetName} ${location.streetNumber}, ${location.area}, ${location.city}` : "";
  const isTravel = visitMode === "TRAVEL_TO_CUSTOMER";

  const handleConfirmCancel = async () => {
    if (!bookingId) return;
    setCancelError(undefined);
    try {
      await cancelMutation.mutateAsync({ bookingId });
      setShowCancelConfirm(false);
    } catch (error) {
      setCancelError(toUserMessage(error));
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFAF9] flex flex-col relative overflow-x-hidden">
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={(val) => {
          if (!val) void logout();
        }}
        selectedLanguage="ENG"
        setSelectedLanguage={() => {}}
      />

      <div className="w-full lg:max-w-none lg:mx-0 lg:pl-[200px] px-4 md:px-0 pt-[22px] flex items-center gap-2 text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
        <Link href="/" className="hover:text-black">Home</Link>
        <span>&gt;</span>
        <Link href="/customer/bookings" className="hover:text-black">My Bookings</Link>
        <span>&gt;</span>
        <span className="text-[#111111] font-bold">View Booking</span>
      </div>

      <main className="flex-1 w-full px-4 md:px-8 py-8 flex justify-center items-start">
        {detailQuery.isLoading ? (
          <p className="text-sm text-[#4E5F78] py-20">Loading your booking…</p>
        ) : detailQuery.isError && !booking ? (
          <section role="alert" className="space-y-4 py-20 text-sm text-[#4E5F78]"><p>Booking details could not be loaded. This booking may be unavailable to your account, or the connection may need retrying.</p>
            <button type="button" className="rounded-lg border border-[#C6C6CB] px-5 py-3 disabled:opacity-50" disabled={detailQuery.isFetching} onClick={() => void detailQuery.refetch()}>Retry booking details</button>
            <Link className="block text-[#2E9DA7] underline" href="/customer/bookings">My Bookings</Link></section>
        ) : !booking ? (
          <p className="text-sm text-[#4E5F78] py-20">
            This booking could not be found. It may not exist, or it may not belong to your account.
          </p>
        ) : (
          <div className="min-w-0 w-full max-w-[1005px] flex flex-col gap-6 pb-20 font-poppins break-words">
            <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">Booking {booking.reference}</h1><BookingStatusBadge status={booking.status} /></div>
            <nav aria-label="Booking navigation" className="flex flex-wrap gap-4 text-sm font-semibold text-[#2E9DA7]"><Link href="/customer/bookings" className="hover:underline">My Bookings</Link><Link href="/customer/packages" className="hover:underline">My Packages</Link></nav>
            {detailQuery.isError && <div role="alert" className="space-y-2 rounded-lg bg-[#F5F4EE] p-4 text-sm"><p>The latest booking details could not be refreshed. Showing the last recorded information.</p><button type="button" disabled={detailQuery.isFetching} className="underline" onClick={() => void detailQuery.refetch()}>Retry booking details</button></div>}
            {firstClassLine?.packageProgressId && <FirstClassBookingContext progressId={firstClassLine.packageProgressId} currentBookingId={booking.id} />}
            {/* CLIENT card */}
            <div className="w-full bg-[#FFFFFF] border border-[#ACAAB4] rounded-xl p-6 flex flex-col gap-4">
              <span className="text-xs font-semibold tracking-wider text-[#888780] uppercase">Client</span>
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-lg text-[#111111]">
                      {[booking.customer.firstName, booking.customer.lastName].filter(Boolean).join(" ")}
                    </span>
                    <span className="bg-[#3A97D1] text-[#FFFFFF] text-[10px] font-bold tracking-widest px-3 py-0.5 rounded-full uppercase">
                      {bookingClientBadge(booking.source, booking.financials.platformFeeCents)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-[#5F5E5A]">
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={Mail01Icon} className="w-4 h-4 text-gray-500" />
                      <span>{booking.customer.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Image src="/Icons/phone.svg" className="w-4 h-4 object-contain" alt="phone" width={16} height={16} />
                      <span>{booking.customer.phone.e164}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Salon Details card */}
            <div className="w-full bg-[#FFFFFF] border border-[#ACAAB4] rounded-xl p-6 flex flex-col gap-6">
              <div className="flex flex-col md:flex-row items-start gap-4 w-full">
                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                  <h2 className="font-semibold text-2xl text-black">{business?.name ?? (catalogQuery.isLoading ? "Loading business…" : "Business information unavailable")}</h2>
                  {completeAddress && (
                    <div className="flex items-center gap-1.5 text-sm text-[#4E5F78] font-medium">
                      <HugeiconsIcon icon={Location05Icon} className="w-4 h-4 text-[#4E5F78]" />
                      <span>
                        {isTravel ? "Your service address" : "Booked business address"}: {location.streetName} {location.streetNumber}, {location.area}, {location.city}
                      </span>
                    </div>
                  )}
                  <div className="text-sm text-[#4E5F78] font-medium mt-1">Booking ID: {booking.reference}</div>
                </div>
              </div>
              {booking.customerRescheduleCount > 0 && <p className="text-sm text-[#4E5F78]">Rescheduled {booking.customerRescheduleCount} {booking.customerRescheduleCount === 1 ? "time" : "times"}. The current appointment time is shown here.</p>}

              <hr className="border-t border-[rgba(17,17,17,0.2)] w-full" />

              <div className="flex flex-col md:flex-row gap-6 w-full">
                <div className="flex items-start gap-3">
                  <HugeiconsIcon icon={Calendar01Icon} className="w-6 h-6 text-gray-500 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Date</span>
                    <span className="text-base font-semibold text-[#111111]">
                      {formatBookingDate(booking.schedule.startAt, booking.schedule.timezone)}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <HugeiconsIcon icon={Clock01Icon} className="w-6 h-6 text-gray-500 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Time</span>
                    <span className="text-base font-semibold text-[#111111]">{formatBookingTimeRange(booking.schedule)}</span>
                    <span className="text-sm text-[#4E5F78]">{booking.schedule.timezone}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* BOOKING SUMMARY card */}
            <div className="w-full bg-[#FFFFFF] border border-[#ACAAB4] rounded-xl p-6 flex flex-col gap-6">
              <span className="text-xs font-semibold tracking-wider text-[#888780] uppercase">Booking Summary</span>

              <div className="flex flex-col gap-4">
                {booking.serviceLines.map((line) => (
                  <div key={line.serviceId} className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-base text-[#1C1B1C]">{line.name}</span>
                        <span className="text-sm text-[#4E5F78]">{line.durationMin} min</span>
                        <span className="text-sm text-[#4E5F78]">Professional: {line.staffName ?? "Information unavailable"}</span>
                        {line.packageName && <span className="text-sm text-[#3760B7]">Package: {line.packageName}</span>}
                        {line.hours !== undefined && <span className="text-sm text-[#4E5F78]">{line.hours} hours</span>}
                        {line.personCount !== undefined && <span className="text-sm text-[#4E5F78]">{line.personCount} participants</span>}
                      </div>
                      <span className="shrink-0 font-semibold text-base text-[#1C1B1C]">
                        {formatBookingMoney(line.amountCents)}
                      </span>
                    </div>

                    {line.addons.map((addon) => (
                      <div
                        key={addon.addonId}
                        className="flex items-center justify-between gap-4 pl-3 text-sm"
                      >
                        <span className="text-[#4E5F78]">Add-on · {addon.name}</span>
                        <span className="shrink-0 font-medium text-[#1C1B1C]">
                          {formatBookingMoney(addon.priceCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}

                {packageLine?.packageProgressId && (
                  <div className="w-full bg-[#F5F4EE] rounded-lg p-4 flex flex-wrap justify-between items-center gap-3 text-sm font-medium">
                    <span className="text-[#1C1B1C]">
                      {firstClassLine ? firstClassLine.packageRole === "PURCHASE" ? "Original initial Package appointment" : firstClassLine.packageRole === "REDEMPTION" ? "Later redeemed Package appointment" : "Package booking"
                        : packageLine.sessionIndex && packageLine.sessionsInPackage
                        ? packageLine.sessionIndex === 1
                          ? `Package purchase — Session ${packageLine.sessionIndex} of ${packageLine.sessionsInPackage}`
                          : formatPackageSessionLabel({
                              sessionIndex: packageLine.sessionIndex,
                              sessionsInPackage: packageLine.sessionsInPackage,
                            })
                        : "Package booking"}
                    </span>
                    <Link
                      href={`/customer/packages/${packageLine.packageProgressId}${firstClassLine ? "?kind=first-class" : ""}`}
                      className="text-[#2E9DA7] font-semibold hover:underline shrink-0"
                    >
                      View package →
                    </Link>
                  </div>
                )}

                <hr className="border-t border-[#757575] w-full my-1" />

                {booking.financials.serviceDiscountCents > 0 ? (
                  <div className="flex items-center justify-between gap-4 text-sm text-[#1F8900]">
                    <span>Service discount</span>
                    <span className="shrink-0 font-semibold">
                      −{formatBookingMoney(booking.financials.serviceDiscountCents)}
                    </span>
                  </div>
                ) : null}

                {booking.financials.promoDiscountCents ? (
                  <div className="flex items-center justify-between gap-4 text-sm text-[#1F8900]">
                    <span>Promo discount{booking.promo ? ` (${booking.promo.code})` : ""}</span>
                    <span className="shrink-0 font-semibold">
                      −{formatBookingMoney(booking.financials.promoDiscountCents)}
                    </span>
                  </div>
                ) : null}

                {booking.financials.travelFeeCents > 0 ? (
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-[#4E5F78]">Travel fee</span>
                    <span className="shrink-0 font-semibold text-[#1C1B1C]">
                      {formatBookingMoney(booking.financials.travelFeeCents)}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-base text-[#1C1B1C]">
                    {firstClassLine?.packageRole === "REDEMPTION" ? "Independent session amount" : firstClassLine ? "Total appointment amount" : packageLine ? "Total purchase amount" : "Total appointment amount"}
                  </span>
                  <span className="shrink-0 font-bold text-lg text-[#1C1B1C]">
                    {formatBookingMoney(booking.financials.totalCents)}
                  </span>
                </div>

                <CustomerFinancialRows rows={[presentOnlineSnapshot(booking), ...presentVenuePayment(booking)]}
                  rowClassName="w-full bg-[#F5F4EE] rounded-lg p-4 flex justify-between items-center gap-3 text-sm font-medium" />
                <p className="text-xs text-[#4E5F78]">Historical booking amounts are not a current net provider balance.</p>
                <CustomerFinancialOutcome booking={booking} />
              </div>
            </div>

            {/* WHERE TO GO card */}
              <div className="w-full bg-[#FFFFFF] border border-[#ACAAB4] rounded-xl p-6 flex flex-col gap-4">
                <h2 className="font-semibold text-lg text-[#111111]">{isTravel ? "Professional visits your location" : visitMode === "AT_BUSINESS_LOCATION" ? "Visit the business" : "Appointment location unavailable"}</h2>
                {(visitMode === "AT_BUSINESS_LOCATION" || isTravel) && <><BookingVisitBadge mode={visitMode} /><p className="text-sm text-[#4E5F78]">{isTravel ? "Your appointment will take place at your selected address." : "Your appointment will take place at the business location."}</p></>}

                {completeAddress && location ? <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-2.5">
                    <HugeiconsIcon icon={Location05Icon} className="w-5 h-5 text-[#111111] mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-[#111111]">
                        {location.streetName} {location.streetNumber}
                      </span>
                      <span className="text-sm text-gray-500">
                        {location.area}, {location.city}
                      </span>
                      {location.floorUnit && <span className="text-sm text-gray-500">Floor / unit: {location.floorUnit}</span>}
                      {location.aptRoom && <span className="text-sm text-gray-500">Apartment / room: {location.aptRoom}</span>}
                      {isTravel && booking.fulfilment.travelAddress?.propertyType && <span className="text-sm text-gray-500">Property type: {booking.fulfilment.travelAddress.propertyType}</span>}
                      {isTravel && booking.fulfilment.travelAddress?.additionalDirections && <p className="text-sm text-gray-500">Additional directions: {booking.fulfilment.travelAddress.additionalDirections}</p>}
                    </div>
                  </div>

                  <a
                    href={buildBookingDirectionsUrl({ location: location?.location, addressText: mapQuery })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[#2E9DA7] font-semibold hover:underline"
                  >
                    <HugeiconsIcon icon={Share05Icon} className="w-4 h-4 text-[#2E9DA7]" />
                    <span>Open in maps</span>
                  </a>

                  {showMap ? (
                    <BookingLocationMap coordinates={location?.location} address={mapQuery} />
                  ) : (
                    <button type="button"
                      onClick={() => setShowMap(true)}
                      className="w-full h-44 bg-[#F5F4EE] rounded-lg flex flex-col justify-center items-center gap-2 border border-[#ACAAB4] cursor-pointer hover:bg-neutral-100 transition-colors"
                    >
                      <HugeiconsIcon icon={MapsIcon} className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-400 font-semibold uppercase tracking-wider">Map preview</span>
                    </button>
                  )}
                </div> : <p role="status" className="text-sm text-[#4E5F78]">The booked service address is unavailable. Contact the business to confirm the appointment location.</p>}
              </div>

            {/* CANCELLATION OUTCOME card — real result only, never a pre-action estimate */}
            {booking.cancellationOutcome && (
              <div className="w-full bg-[#FFFFFF] border border-[#ACAAB4] rounded-xl p-6 flex flex-col gap-3">
                <span className="text-xs font-semibold tracking-wider text-[#888780] uppercase">Cancellation outcome</span>
                <CustomerFinancialRows rows={presentCancellation(booking.cancellationOutcome)} />
              </div>
            )}

            {/* NOTES card */}
            {booking.notes && (
              <div className="w-full bg-[#FFFFFF] border border-[#ACAAB4] rounded-xl p-6 flex flex-col gap-4">
                <span className="text-xs font-semibold tracking-wider text-[#888780] uppercase">Notes for your appointment</span>
                <div className="bg-[#F5F4EE] p-4 rounded-lg flex flex-col gap-1.5 text-sm text-[#111111] font-medium leading-relaxed">
                  <span>{booking.notes}</span>
                </div>
              </div>
            )}

            {/* REVIEW card (Batch 14) — renders nothing unless the server confirms this booking
                is genuinely COMPLETED + BOOKLY_MANAGED. */}
            {bookingId && (
              <BookingReviewCard
                bookingId={bookingId}
                bookingSource={booking.source}
                bookingStatus={booking.status}
              />
            )}

            {isUpcoming && (
              <div className="flex gap-4 justify-end mt-4">
                <button
                  onClick={() => {
                    setShowCancelConfirm(true);
                    setCancelError(undefined);
                  }}
                  className="py-2.5 px-6 rounded-lg text-sm font-semibold bg-[#BA1A1A] text-white hover:bg-red-800 transition-colors cursor-pointer"
                >
                  {packageLine ? "Cancel session" : "Cancel"}
                </button>
                <button
                  onClick={() => setIsRescheduleOpen(true)}
                  className="py-2.5 px-6 border border-[#C6C6CB] rounded-lg text-sm font-semibold text-[#111111] hover:bg-neutral-100 transition-colors bg-white cursor-pointer"
                >
                  {packageLine ? "Reschedule session" : "Reschedule"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />

      {isRescheduleOpen && bookingId && (
        <RescheduleModal bookingId={bookingId} onClose={() => setIsRescheduleOpen(false)} onSaved={() => setIsRescheduleOpen(false)} />
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-manrope">
          <div className="bg-white rounded-[24px] shadow-2xl p-8 max-w-[480px] w-full flex flex-col items-center select-none text-center">
            <h2 className="font-bold text-[32px] leading-10 text-[#020305] mb-2">
              {packageLine ? "Cancel this package session?" : "Cancel your booking?"}
            </h2>
            <p className="text-sm text-[#4E5F78] leading-6 mb-8 px-2">
              {packageLine
                ? "This cancels only this appointment, not your whole package. Depending on the existing cancellation policy, the session may be restored or forfeited. We’ll show the exact result after you confirm."
                : `Cancellation and no-show fees, if any, are set by ${business?.name ?? "the Business"} and calculated on discounted service and add-ons, excluding travel. We’ll show you the exact result right after you confirm.`}
            </p>
            {cancelError ? <p className="text-sm text-red-600 font-medium mb-4">{cancelError}</p> : null}
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 w-full">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelMutation.isPending}
                className="w-full sm:flex-1 py-3 sm:py-3.5 border border-[#C6C6CB] rounded-full text-sm sm:text-base font-semibold text-[#020305] hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelMutation.isPending}
                className="w-full sm:flex-1 py-3 sm:py-3.5 bg-[#0D0D0D] hover:bg-black text-white rounded-full text-sm sm:text-base font-semibold transition-colors disabled:opacity-50"
              >
                {cancelMutation.isPending ? "Cancelling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookingViewPage() {
  return (
    <RequireCustomer>
      <Suspense fallback={<div>Loading...</div>}>
          <BookingViewRoute />
      </Suspense>
    </RequireCustomer>
  );
}
