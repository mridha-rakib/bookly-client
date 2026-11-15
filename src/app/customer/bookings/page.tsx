"use client";

import React, { Suspense, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchBar from "@/components/landing-page/SearchBar";

import RequireCustomer from "@/components/auth/RequireCustomer";
import { useAuthStore } from "@/lib/auth/store";
import { useCustomerBookingsQuery, useCancelByCustomerMutation } from "@/lib/bookings/hooks";
import { CUSTOMER_BOOKING_TAB_STATUSES, type CustomerBookingTab } from "@/lib/bookings/format";
import { toUserMessage } from "@/lib/auth/messages";
import BookingCard from "./BookingCard";
import RescheduleModal from "./RescheduleModal";
import CustomerPackagesList from "../packages/CustomerPackagesList";
import type { BookingDetail } from "@/lib/api/bookings";
import CustomerCancellationFinancialResult from "@/components/bookings/CustomerCancellationFinancialResult";
import BookingPaymentRecovery from "@/components/bookings/BookingPaymentRecovery";

export default function BookingsPage() {
  return (
    <RequireCustomer>
      <Suspense fallback={<div className="min-h-screen bg-[#FDFBF9]" />}>
        <BookingsPageContent />
      </Suspense>
    </RequireCustomer>
  );
}

function BookingsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const logout = useAuthStore((state) => state.logout);
  const isLoggedIn = true;

  const [selectedLanguage, setSelectedLanguage] = useState("ENG");
  const [activeTab, setActiveTab] = useState<CustomerBookingTab>("upcoming");
  const activeView = searchParams.get("view") === "packages" ? "packages" : "appointments";

  const setActiveView = (view: "appointments" | "packages") => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "packages") params.set("view", "packages");
    else params.delete("view");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const bookingsQuery = useCustomerBookingsQuery({
    status: CUSTOMER_BOOKING_TAB_STATUSES[activeTab],
    limit: 50,
  });
  const bookings = bookingsQuery.data?.bookings ?? [];

  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | undefined>(undefined);
  const cancelMutation = useCancelByCustomerMutation();
  const cancelInFlight = useRef(false);
  const financialCustomerId = useAuthStore((state) => state.user?.id);
  const financialEpoch = useAuthStore((state) => state.cacheEpoch);
  const [cancelResult, setCancelResult] = useState<{ booking: BookingDetail; customerId: string | undefined; epoch: number } | undefined>(
    undefined,
  );

  const handleConfirmCancel = async () => {
    if (!cancelBookingId || cancelInFlight.current) return;
    cancelInFlight.current = true;
    setCancelError(undefined);
    const session = useAuthStore.getState();
    try {
      const booking = await cancelMutation.mutateAsync({ bookingId: cancelBookingId });
      if (useAuthStore.getState().user?.id !== session.user?.id || useAuthStore.getState().cacheEpoch !== session.cacheEpoch) return;
      setCancelBookingId(null);
      setCancelResult({ booking, customerId: session.user?.id, epoch: session.cacheEpoch });
    } catch (error) {
      setCancelError(toUserMessage(error));
    } finally {
      cancelInFlight.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden">
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={(val) => {
          if (!val) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <main className="flex-1 w-full px-4 md:px-8 xl:px-[65px] flex flex-col z-10 relative items-center">
        <div className="w-full flex justify-center mb-8 sm:mb-12">
          <SearchBar />
        </div>

        <div className="max-w-[1005px] w-full flex flex-col items-start gap-8 pb-20">
          {/* 1. Prominent My Bookings heading & description */}
          <div className="w-full flex flex-col items-start gap-2">
            <h1 className="font-manrope font-bold text-3xl sm:text-4xl leading-tight tracking-tight text-[#020305]">
              My Bookings
            </h1>
            <p className="text-sm sm:text-base text-[#5F5E5A] font-manrope">
              Manage your upcoming appointments, review past visits, and track your package balances.
            </p>
          </div>

          {/* 2. Compact Booking Request Updates area */}
          <BookingPaymentRecovery serverInbox />

          {/* 3. Appointments / Packages navigation */}
          <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
            <div
              role="tablist"
              aria-label="Booking area"
              className="grid w-full grid-cols-2 rounded-xl bg-[#F1EFEC] p-1 sm:w-auto sm:min-w-[340px] border border-[#E5E5EA]"
            >
              {(["appointments", "packages"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  role="tab"
                  aria-selected={activeView === view}
                  onClick={() => setActiveView(view)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-bold tracking-tight transition-all duration-150 sm:px-6 cursor-pointer ${
                    activeView === view
                      ? "bg-white text-[#020305] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                      : "text-[#5F5E5A] hover:text-[#020305]"
                  }`}
                >
                  {view === "appointments" ? "Appointments" : "Packages"}
                </button>
              ))}
            </div>
          </div>

          {activeView === "appointments" ? (
            <>
              {/* 4. Booking status navigation */}
              <div className="flex w-full items-start gap-6 overflow-x-auto border-b border-[#E2E1E6] sm:gap-8 scrollbar-hide">
                {(["upcoming", "completed", "noshow", "canceled"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex w-auto cursor-pointer flex-col items-center justify-center whitespace-nowrap border-b-2 px-1.5 pb-3 transition-all duration-200 ${
                      activeTab === tab
                        ? "border-[#020305] text-[#020305]"
                        : "border-transparent text-[#5F5E5A] hover:text-[#020305]"
                    }`}
                  >
                    <span className={`flex items-center text-center font-manrope text-sm leading-6 sm:text-base ${activeTab === tab ? "font-bold text-[#020305]" : "font-medium text-[#5F5E5A]"}`}>
                      {tab === "upcoming" ? "Upcoming" : tab === "completed" ? "Completed" : tab === "noshow" ? "No-show" : "Canceled"}
                    </span>
                  </button>
                ))}
              </div>

              {/* 5. Booking list / cards */}
              <div className="mt-2 flex w-full flex-col items-start gap-6">
                {bookingsQuery.isLoading ? (
                  <div className="w-full rounded-2xl border border-[#E2E1E6] bg-white py-20 text-center shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <p className="text-base font-medium text-[#45474B]">Loading your bookings…</p>
                  </div>
                ) : bookingsQuery.isError ? (
                  <div className="w-full rounded-2xl border border-[#E2E1E6] bg-white py-20 text-center shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <p className="text-base font-medium text-[#45474B]">Your bookings could not be loaded right now.</p>
                    <button type="button" disabled={bookingsQuery.isFetching} onClick={() => void bookingsQuery.refetch()} className="mt-3 underline disabled:opacity-50">{bookingsQuery.isFetching ? "Retrying…" : "Retry"}</button>
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
                  <div className="w-full rounded-2xl border border-[#E2E1E6] bg-white py-16 px-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col items-center justify-center gap-2">
                    <p className="text-base font-semibold text-[#020305]">No bookings found in this category</p>
                    <p className="text-sm text-[#5F5E5A] max-w-sm">When you book an appointment, it will appear here with live updates and actions.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <CustomerPackagesList />
          )}
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
              Cancellation and no-show fees, if any, are set by the Business and calculated on discounted service and add-ons, excluding travel.
              We&apos;ll show you the exact result — refund or additional charge — right
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

      {cancelResult && cancelResult.customerId === financialCustomerId && cancelResult.epoch === financialEpoch && (
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

            <CustomerCancellationFinancialResult key={cancelResult.booking.id} booking={cancelResult.booking} />
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
