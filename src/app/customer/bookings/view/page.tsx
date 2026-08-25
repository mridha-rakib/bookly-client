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
  formatBookingDate,
  formatBookingMoney,
  formatBookingTimeRange,
} from "@/lib/bookings/format";
import { toUserMessage } from "@/lib/auth/messages";
import BookingReviewCard from "../BookingReviewCard";
import RescheduleModal from "../RescheduleModal";

function BookingViewContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("id") ?? undefined;

  const logout = useAuthStore((state) => state.logout);
  const isLoggedIn = true;

  const detailQuery = useCustomerBookingDetailQuery(bookingId);
  const booking = detailQuery.data;

  const catalogQuery = useBusinessCatalogQuery(booking?.businessId);
  const business = catalogQuery.data?.business;

  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>(undefined);
  const cancelMutation = useCancelByCustomerMutation();

  const isUpcoming = booking?.status === "UPCOMING" || booking?.status === "PENDING";
  const location = booking?.fulfilment.mode === "AT_BUSINESS_LOCATION" ? booking.fulfilment.businessLocation : booking?.fulfilment.travelAddress;
  const mapQuery = location ? `${location.streetName} ${location.streetNumber}, ${location.area}, ${location.city}` : "";

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
        ) : !booking ? (
          <p className="text-sm text-[#4E5F78] py-20">
            This booking could not be found. It may not exist, or it may not belong to your account.
          </p>
        ) : (
          <div className="w-full max-w-[1005px] flex flex-col gap-6 pb-20 font-poppins">
            {/* CLIENT card */}
            <div className="w-full bg-[#FFFFFF] border border-[#ACAAB4] rounded-xl p-6 flex flex-col gap-4">
              <span className="text-xs font-semibold tracking-wider text-[#888780] uppercase">Client</span>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-[#C6C6CB] relative flex-shrink-0 bg-neutral-100">
                  <Image src="/image/profile1.png" alt="Client Profile" fill className="object-cover" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
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
                <div className="w-[106px] h-[106px] rounded-lg overflow-hidden border border-[#C6C6CB] flex-shrink-0 relative bg-neutral-100">
                  <Image src="/image/imgOfService.png" alt={business?.name ?? "Business"} fill className="object-cover" />
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <h2 className="font-semibold text-2xl text-black">{business?.name ?? "—"}</h2>
                  {location && (
                    <div className="flex items-center gap-1.5 text-sm text-[#4E5F78] font-medium">
                      <HugeiconsIcon icon={Location05Icon} className="w-4 h-4 text-[#4E5F78]" />
                      <span>
                        {location.streetName} {location.streetNumber}, {location.area}, {location.city}
                      </span>
                    </div>
                  )}
                  <div className="text-sm text-[#4E5F78] font-medium mt-1">Booking ID: {booking.reference}</div>
                </div>
              </div>

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
                  </div>
                </div>
              </div>

              {booking.serviceLines[0]?.staffName && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-[#C6C6CB] relative flex-shrink-0 bg-neutral-100">
                    <Image src="/image/profile.jpg" alt={booking.serviceLines[0].staffName} fill className="object-cover" />
                  </div>
                  <span className="text-sm font-semibold text-gray-500">with {booking.serviceLines[0].staffName}</span>
                </div>
              )}
            </div>

            {/* BOOKING SUMMARY card */}
            <div className="w-full bg-[#FFFFFF] border border-[#ACAAB4] rounded-xl p-6 flex flex-col gap-6">
              <span className="text-xs font-semibold tracking-wider text-[#888780] uppercase">Booking Summary</span>

              <div className="flex flex-col gap-4">
                {booking.serviceLines.map((line) => (
                  <div key={line.serviceId} className="flex justify-between items-start gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-base text-[#1C1B1C]">{line.name}</span>
                      <span className="text-sm text-[#4E5F78]">
                        {line.durationMin} min
                        {line.addons.length > 0 ? ` • ${line.addons.map((a) => a.name).join(" • ")}` : ""}
                      </span>
                    </div>
                    <span className="font-semibold text-base text-[#1C1B1C]">
                      {formatBookingMoney(line.amountCents + line.addons.reduce((sum, a) => sum + a.priceCents, 0))}
                    </span>
                  </div>
                ))}

                <hr className="border-t border-[#757575] w-full my-1" />

                <div className="flex justify-between items-center">
                  <span className="font-semibold text-base text-[#1C1B1C]">Subtotal</span>
                  <span className="font-semibold text-base text-[#1C1B1C]">
                    {formatBookingMoney(booking.financials.servicesSubtotalCents + booking.financials.addonsSubtotalCents)}
                  </span>
                </div>

                <div className="w-full bg-[#F5F4EE] rounded-lg p-4 flex justify-between items-center text-sm font-medium">
                  <span className="text-[#1C1B1C]">
                    {bookingClientBadge(booking.source, booking.financials.platformFeeCents) === "New" ? "Platform fee (charged now)" : "Deposit"}
                  </span>
                  <span className="text-[#1C1B1C] font-semibold">{formatBookingMoney(booking.financials.depositCents)}</span>
                </div>

                <div className="w-full bg-[#F5F4EE] rounded-lg p-4 flex justify-between items-center text-sm font-medium">
                  <span className="text-[#1C1B1C]">Remaining balance due at appointment</span>
                  <span className="text-[#1C1B1C] font-bold text-lg">{formatBookingMoney(booking.financials.balanceDueCents)}</span>
                </div>
              </div>
            </div>

            {/* WHERE TO GO card */}
            {location && (
              <div className="w-full bg-[#FFFFFF] border border-[#ACAAB4] rounded-xl p-6 flex flex-col gap-4">
                <span className="text-xs font-semibold tracking-wider text-[#888780] uppercase">Where to go</span>

                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-2.5">
                    <HugeiconsIcon icon={Location05Icon} className="w-5 h-5 text-[#111111] mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-[#111111]">
                        {location.streetName} {location.streetNumber}
                      </span>
                      <span className="text-sm text-gray-500">
                        {location.area}, {location.city}
                      </span>
                    </div>
                  </div>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[#2E9DA7] font-semibold hover:underline"
                  >
                    <HugeiconsIcon icon={Share05Icon} className="w-4 h-4 text-[#2E9DA7]" />
                    <span>Open in maps</span>
                  </a>

                  {showMap ? (
                    <div className="w-full h-44 rounded-lg overflow-hidden border border-[#ACAAB4]">
                      <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        style={{ border: 0 }}
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => setShowMap(true)}
                      className="w-full h-44 bg-[#F5F4EE] rounded-lg flex flex-col justify-center items-center gap-2 border border-[#ACAAB4] cursor-pointer hover:bg-neutral-100 transition-colors"
                    >
                      <HugeiconsIcon icon={MapsIcon} className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-400 font-semibold uppercase tracking-wider">Map preview</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CANCELLATION OUTCOME card — real result only, never a pre-action estimate */}
            {booking.cancellationOutcome && (
              <div className="w-full bg-[#FFFFFF] border border-[#ACAAB4] rounded-xl p-6 flex flex-col gap-3">
                <span className="text-xs font-semibold tracking-wider text-[#888780] uppercase">Cancellation outcome</span>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#4E5F78]">Fee charged</span>
                  <span className="font-semibold text-[#1C1B1C]">{formatBookingMoney(booking.cancellationOutcome.additionalChargeCents)}</span>
                </div>
                {booking.cancellationOutcome.refundOwedCents > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#1F8900]">Refund</span>
                    <span className="font-semibold text-[#1F8900]">{formatBookingMoney(booking.cancellationOutcome.refundOwedCents)}</span>
                  </div>
                )}
                <span className="text-xs text-gray-500 italic">
                  Settlement: {booking.cancellationOutcome.settlementStatus.toLowerCase()}
                </span>
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
                  Cancel
                </button>
                <button
                  onClick={() => setIsRescheduleOpen(true)}
                  className="py-2.5 px-6 border border-[#C6C6CB] rounded-lg text-sm font-semibold text-[#111111] hover:bg-neutral-100 transition-colors bg-white cursor-pointer"
                >
                  Reschedule
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
            <h2 className="font-bold text-[32px] leading-10 text-[#020305] mb-2">Cancel your booking?</h2>
            <p className="text-sm text-[#4E5F78] leading-6 mb-8 px-2">
              Cancellation and no-show fees, if any, are set by {business?.name ?? "the Business"} and calculated on
              the full service price, not your deposit. We&apos;ll show you the exact result right after you confirm.
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
        <BookingViewContent />
      </Suspense>
    </RequireCustomer>
  );
}
