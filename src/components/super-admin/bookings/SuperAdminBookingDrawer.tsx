"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { BOOKING_STATUS_LABELS, formatBookingMoney, formatBookingDate, formatBookingTimeRange } from "@/lib/bookings/format";
import { useSuperAdminBookingDetailQuery } from "@/lib/superAdminBookings/hooks";

interface SuperAdminBookingDrawerProps {
  bookingId: string | null;
  businessName?: string;
  onClose: () => void;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  UPCOMING: "bg-[#EEF2FF] text-[#4338CA]",
  COMPLETED: "bg-emerald-50 text-[#16A34A]",
  PENDING: "bg-amber-50 text-[#A36116]",
  NO_SHOW_CHARGED: "bg-rose-50 text-[#A31616]",
  NO_SHOW_WAIVED: "bg-gray-50 text-gray-500",
  NO_SHOW_CANCELLED: "bg-gray-50 text-gray-500",
  CANCELLED_BY_CUSTOMER: "bg-rose-50 text-[#A31616]",
  CANCELLED_BY_BUSINESS: "bg-rose-50 text-[#A31616]",
  LATE_CANCELLATION: "bg-amber-50 text-[#A36116]",
};

export default function SuperAdminBookingDrawer({ bookingId, businessName, onClose }: SuperAdminBookingDrawerProps) {
  const isOpen = bookingId !== null;
  const { data: booking } = useSuperAdminBookingDetailQuery(bookingId ?? undefined);

  const customerInitials = booking?.customer.firstName
    ? `${booking.customer.firstName[0]}${booking.customer.lastName?.[0] ?? ""}`.toUpperCase()
    : "—";

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-[100] transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed right-0 top-0 h-screen w-full sm:w-[480px] bg-white shadow-[0px_10px_24px_rgba(0,0,0,0.12)] z-[101] flex flex-col font-sans transition-transform duration-300 ease-in-out transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {isOpen && (
          <>
            <div className="flex items-center justify-between px-5 h-14 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-6">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1 text-[14px] font-normal text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <HugeiconsIcon icon={ArrowLeft02Icon} className="w-4 h-4 text-gray-500 shrink-0" />
                  <span>Close</span>
                </button>
                <span className="font-bold text-base text-[#111827]">
                  Booking #{booking?.reference ?? "…"}
                </span>
              </div>
              {booking && (
                <span
                  className={`px-2.5 py-1 text-[12px] font-semibold rounded-full ${STATUS_BADGE_CLASS[booking.status] ?? "bg-gray-50 text-gray-500"}`}
                >
                  {BOOKING_STATUS_LABELS[booking.status]}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm">
              {!booking && <div className="text-center text-gray-400 py-8">Loading…</div>}

              {booking && (
                <>
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Customer</span>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#EEF2FF] flex items-center justify-center font-bold text-sm text-[#4338CA] shrink-0">
                        {customerInitials}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-[15px] text-[#6366F1]">
                          {booking.customer.firstName} {booking.customer.lastName ?? ""}
                        </span>
                        <span className="text-[13px] text-gray-500">{booking.customer.phone.e164}</span>
                      </div>
                    </div>
                  </div>

                  {businessName && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Business</span>
                      <span className="font-semibold text-[15px] text-[#6366F1]">{businessName}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Session</span>
                    <div className="space-y-2.5 text-[13px]">
                      {booking.serviceLines.map((line, idx) => (
                        <div key={idx} className="flex items-start">
                          <span className="w-28 text-gray-400 shrink-0">Service</span>
                          <span className="font-medium text-[#111827]">
                            {line.name}
                            {line.staffName ? ` — ${line.staffName}` : ""}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-start">
                        <span className="w-28 text-gray-400 shrink-0">Date</span>
                        <span className="font-medium text-[#111827]">
                          {formatBookingDate(booking.schedule.startAt, booking.schedule.timezone)}
                        </span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-28 text-gray-400 shrink-0">Time</span>
                        <span className="font-medium text-[#111827]">{formatBookingTimeRange(booking.schedule)}</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-28 text-gray-400 shrink-0">Fulfilment</span>
                        <span className="font-medium text-[#111827]">
                          {booking.fulfilment.mode === "TRAVEL_TO_CUSTOMER" ? "Mobile visit" : "At business location"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-gray-100 pt-5">
                    <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Payment</span>
                    <div className="space-y-2.5 text-[13px]">
                      <div className="flex items-start">
                        <span className="w-28 text-gray-400 shrink-0">Total</span>
                        <span className="font-medium text-[#111827]">
                          {formatBookingMoney(booking.financials.totalCents)}
                        </span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-28 text-gray-400 shrink-0">Deposit</span>
                        <span className="font-medium text-[#111827]">
                          {booking.financials.depositCents > 0
                            ? formatBookingMoney(booking.financials.depositCents)
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-28 text-gray-400 shrink-0">Platform fee</span>
                        <span className="font-medium text-[#111827]">
                          {booking.financials.platformFeeCents > 0
                            ? formatBookingMoney(booking.financials.platformFeeCents)
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-28 text-gray-400 shrink-0">Source</span>
                        <span className="font-medium text-[#111827]">
                          {booking.source === "MANUAL" ? "Manual (walk-in)" : "Bookly"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {booking.notes && (
                    <div className="flex flex-col gap-2 border-t border-gray-100 pt-5">
                      <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notes</span>
                      <p className="text-[13px] text-gray-700">{booking.notes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
