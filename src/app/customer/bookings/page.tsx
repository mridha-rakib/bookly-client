"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchBar from "@/components/landing-page/SearchBar";

import { useAuthStore } from "@/lib/auth/store";
import { useCustomerBookingsQuery, useCancelByCustomerMutation } from "@/lib/bookings/hooks";
import { CUSTOMER_BOOKING_TAB_STATUSES, formatBookingMoney, type CustomerBookingTab } from "@/lib/bookings/format";
import { toUserMessage } from "@/lib/auth/messages";
import BookingCard from "./BookingCard";
import RescheduleModal from "./RescheduleModal";

export default function BookingsPage() {
  const authUser = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const isLoggedIn = authStatus === "authenticated" && authUser?.role === "CUSTOMER";

  const [selectedLanguage, setSelectedLanguage] = useState("ENG");
  const [activeTab, setActiveTab] = useState<CustomerBookingTab>("upcoming");

  const bookingsQuery = useCustomerBookingsQuery({
    status: CUSTOMER_BOOKING_TAB_STATUSES[activeTab],
    limit: 50,
  });
  const bookings = bookingsQuery.data?.bookings ?? [];

  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | undefined>(undefined);
  const cancelMutation = useCancelByCustomerMutation();
  const [cancelResult, setCancelResult] = useState<{ additionalChargeCents: number; refundOwedCents: number } | undefined>(
    undefined,
  );

  const handleConfirmCancel = async () => {
    if (!cancelBookingId) return;
    setCancelError(undefined);
    try {
      const booking = await cancelMutation.mutateAsync({ bookingId: cancelBookingId });
      setCancelBookingId(null);
      setCancelResult({
        additionalChargeCents: booking.cancellationOutcome?.additionalChargeCents ?? 0,
        refundOwedCents: booking.cancellationOutcome?.refundOwedCents ?? 0,
      });
    } catch (error) {
      setCancelError(toUserMessage(error));
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden">
      <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={() => {}} selectedLanguage={selectedLanguage} setSelectedLanguage={setSelectedLanguage} />

      <main className="flex-1 w-full px-4 md:px-8 xl:px-[65px] flex flex-col z-10 relative items-center">
        <div className="w-full flex justify-center mb-[72px]">
          <SearchBar onSearch={() => {}} />
        </div>

        <div className="max-w-[1005px] w-full flex flex-col items-start gap-8 pb-20">
          <div className="w-full flex flex-col items-start gap-6">
            <h1 className="font-manrope font-bold text-[30px] leading-[36px] tracking-[-0.75px] text-[#020305] flex items-center">
              My Bookings
            </h1>
          </div>

          <div className="flex flex-row items-start p-0 gap-8 w-full border-b border-[#C6C6CB]">
            {(["upcoming", "completed", "noshow", "canceled"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex flex-col justify-center items-center pb-3 border-b-2 cursor-pointer transition-all duration-200 w-auto px-1 whitespace-nowrap ${
                  activeTab === tab
                    ? "border-[#020305] text-[#020305]"
                    : "border-transparent text-[#45474B] hover:text-[#020305]"
                }`}
              >
                <span className={`font-manrope text-base leading-6 flex items-center text-center ${activeTab === tab ? "font-bold" : "font-normal"}`}>
                  {tab === "upcoming" ? "Upcoming" : tab === "completed" ? "Completed" : tab === "noshow" ? "No-show" : "Canceled"}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col items-start gap-6 w-full mt-2">
            {bookingsQuery.isLoading ? (
              <div className="w-full text-center py-20 bg-white border border-[#C6C6CB] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <p className="text-[#45474B] text-lg font-medium">Loading your bookings…</p>
              </div>
            ) : bookingsQuery.isError ? (
              <div className="w-full text-center py-20 bg-white border border-[#C6C6CB] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <p className="text-[#45474B] text-lg font-medium">Your bookings could not be loaded right now.</p>
              </div>
            ) : bookings.length > 0 ? (
              bookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onReschedule={(id) => setRescheduleBookingId(id)}
                  onCancel={(id) => {
                    setCancelBookingId(id);
                    setCancelError(undefined);
                  }}
                />
              ))
            ) : (
              <div className="w-full text-center py-20 bg-white border border-[#C6C6CB] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <p className="text-[#45474B] text-lg font-medium">No bookings found in this category.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {rescheduleBookingId && (
        <RescheduleModal bookingId={rescheduleBookingId} onClose={() => setRescheduleBookingId(null)} onSaved={() => setRescheduleBookingId(null)} />
      )}

      {cancelBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-manrope">
          <div className="bg-white rounded-[24px] shadow-2xl p-8 max-w-[480px] w-full flex flex-col items-center select-none text-center">
            <h2 className="font-bold text-[32px] leading-10 text-[#020305] mb-2">Cancel your booking?</h2>

            <p className="text-sm text-[#4E5F78] leading-6 mb-8 px-2">
              Cancellation and no-show fees, if any, are set by the Business and calculated on the full service
              price, not your deposit. We&apos;ll show you the exact result — refund or additional charge — right
              after you confirm.
            </p>

            {cancelError ? <p className="text-sm text-red-600 font-medium mb-4">{cancelError}</p> : null}

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 w-full">
              <button
                type="button"
                onClick={() => setCancelBookingId(null)}
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

      {cancelResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-manrope">
          <div className="bg-white rounded-[24px] shadow-2xl p-8 max-w-[440px] w-full flex flex-col items-center select-none text-center">
            <div className="w-16 h-16 bg-[#EEFDF4] rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-[#30AE5A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="font-bold text-[28px] leading-9 text-[#020305] mb-2">Cancellation Confirmed</h2>

            <p className="text-sm text-[#4E5F78] leading-6 mb-2 px-2">
              Your booking has been cancelled and the changes are updated in your bookings list.
            </p>

            {cancelResult.additionalChargeCents > 0 ? (
              <p className="text-sm font-semibold text-[#BA1A1A] mb-6">
                A cancellation fee of {formatBookingMoney(cancelResult.additionalChargeCents)} was charged to your saved card.
              </p>
            ) : cancelResult.refundOwedCents > 0 ? (
              <p className="text-sm font-semibold text-[#1F8900] mb-6">
                {formatBookingMoney(cancelResult.refundOwedCents)} will be refunded to your card within 3-5 business days.
              </p>
            ) : (
              <p className="text-sm font-semibold text-[#1F8900] mb-6">No charge applied.</p>
            )}

            <button
              type="button"
              onClick={() => setCancelResult(undefined)}
              className="w-full py-3.5 bg-[#0D0D0D] hover:bg-black text-white rounded-full text-base font-semibold transition-colors cursor-pointer"
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
