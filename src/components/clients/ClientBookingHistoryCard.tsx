"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon,
  Calendar01Icon,
  Clock01Icon,
  ArrowDown01Icon,
  Cancel01Icon,
  InformationCircleIcon,
  Tick01Icon,
  Location05Icon,
  Building06Icon,
  SentIcon,
  Route01Icon,
  Home03Icon,
  Layers01Icon,
  PinIcon,
  Car04Icon
} from "@hugeicons/core-free-icons";

import type { BookingDetail } from "@/lib/api/bookings";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  bookingClientBadge,
  formatBookingDate,
  formatBookingMoney,
  formatBookingTimeRange,
} from "@/lib/bookings/format";
import { useAvailabilityQuery } from "@/lib/availability/hooks";

interface ClientBookingHistoryCardProps {
  /** The real Booking, exactly as returned by GET /businesses/:id/bookings/:id — every value
   * shown below is read from this, never a mock/hardcoded per-booking special case. */
  booking: BookingDetail;
  businessId: string;

  showClientDetails?: boolean;
  showDateTimeDetails?: boolean;
  showSummaryDetails?: boolean;
  showNotesDetails?: boolean;
  showFooterActions?: boolean;
  onCompleteBooking?: () => void;
  /** Fires with a real, chosen ISO `startAt` — the caller is responsible for calling
   * bookingsApi.rescheduleByOwner (never computed/validated here). */
  onReschedule?: (startAtIso: string) => void;
  isReschedulePending?: boolean;
  onWaiveFeeClick?: () => void;
  onCancelNoShowClick?: () => void;
  onCancelBooking?: () => void;
}

const TONE_BADGE_CLASSNAMES: Record<string, string> = {
  info: "bg-[#E6F1FB] text-[#3760B7]",
  success: "bg-[#E1F5EE] text-[#2F8068]",
  warning: "bg-[#FCF4E0] text-[#D97706]",
  danger: "bg-[#FFF0F0] text-[#E42424]",
  neutral: "bg-[#F0F0EE] text-[#5F5E5A]",
};

const formatCountdown = (ms: number): string => {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")} : ${String(seconds).padStart(2, "0")}`;
};

export default function ClientBookingHistoryCard({
  booking,
  businessId,
  showClientDetails = true,
  showDateTimeDetails = true,
  showSummaryDetails = true,
  showNotesDetails = true,
  showFooterActions = false,
  onCompleteBooking,
  onReschedule,
  isReschedulePending = false,
  onWaiveFeeClick,
  onCancelNoShowClick,
  onCancelBooking,
}: ClientBookingHistoryCardProps) {
  const [showSummary, setShowSummary] = useState(true);
  const [showMarkedNoShow, setShowMarkedNoShow] = useState(true);
  const [isRescheduling, setIsRescheduling] = useState(false);

  const status = booking.status;
  const tone = BOOKING_STATUS_TONE[status];
  const clientName = [booking.customer.firstName, booking.customer.lastName].filter(Boolean).join(" ");
  const badge = bookingClientBadge(booking.source, booking.financials.platformFeeCents);
  const isManual = booking.source === "MANUAL";
  const primaryLine = booking.serviceLines[0];
  const staffNames = Array.from(
    new Set(booking.serviceLines.map((line) => line.staffName).filter((n): n is string => Boolean(n))),
  );
  const travelAddress = booking.fulfilment.mode === "TRAVEL_TO_CUSTOMER" ? booking.fulfilment.travelAddress : undefined;

  // --- Live no-show countdown, derived from the backend's own authoritative deadline ---------
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "PENDING" || !booking.noShowDeadlineAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status, booking.noShowDeadlineAt]);
  const deadlineMs = booking.noShowDeadlineAt ? new Date(booking.noShowDeadlineAt).getTime() : undefined;
  const remainingMs = deadlineMs !== undefined ? deadlineMs - now : undefined;

  const additionalChargeCents = booking.cancellationOutcome?.additionalChargeCents ?? 0;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* 1. MAIN CARD: Client details and Booking Header */}
      <div className="bg-white border border-neutral-200/60 rounded-2xl overflow-hidden shadow-sm flex flex-col w-full">
        {/* Header bar */}
        <div className="relative bg-[#F4F2EC] border-b border-[#EDD4D2] px-6 py-3.5 flex items-center justify-between select-none">
          <span className="font-poppins text-xs font-normal text-[#73726D] tracking-[0.075em] uppercase">
            {booking.reference}
          </span>
          <span className={`inline-block px-3 py-1 text-[11px] font-semibold rounded-full select-none uppercase tracking-wider ${TONE_BADGE_CLASSNAMES[tone]}`}>
            {BOOKING_STATUS_LABELS[status]}
          </span>
        </div>

        {/* Client details row */}
        {showClientDetails && (
          <div className="p-6 flex flex-col gap-4">
            <span className="font-poppins text-[10px] font-medium tracking-[0.075em] uppercase text-[#73726D]">
              Client
            </span>
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-neutral-100 shrink-0 relative bg-[#E1F5EE] flex items-center justify-center">
                  <span className="font-poppins font-semibold text-lg text-[#5F5E5A]">
                    {clientName.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-poppins font-semibold text-lg text-[#111111]">{clientName}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.045em] select-none ${
                      badge === "Manual" ? "bg-[#F5F4EE] text-[#5F5E5A]" : badge === "New" ? "bg-[#3A97D1] text-white" : "bg-[#E1F5EE] text-[#2F8068]"
                    }`}>
                      {badge}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#5F5E5A] font-poppins">
                    <div className="flex items-center gap-1">
                      <HugeiconsIcon icon={Mail01Icon} className="w-4 h-4 text-neutral-400" />
                      <span>{booking.customer.email}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Image src="/Icons/phone.svg" alt="Phone" className="w-4 h-4 object-contain filter opacity-60" width={16} height={16} />
                      <span>{booking.customer.phone.e164}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. DATE & TIME CARD */}
      {showDateTimeDetails && (
        <div className="bg-white border border-neutral-200/60 rounded-2xl p-6 shadow-sm flex flex-col gap-5 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[#F5F4EE] rounded-xl flex items-center justify-center shrink-0">
                <HugeiconsIcon icon={Calendar01Icon} className="w-5 h-5 text-neutral-600" />
              </div>
              <div className="flex flex-col">
                <span className="font-poppins text-[10px] text-neutral-400 uppercase tracking-wider">Date</span>
                <span className="font-poppins text-base font-semibold text-[#111111] mt-0.5">
                  {formatBookingDate(booking.schedule.startAt, booking.schedule.timezone)}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[#F5F4EE] rounded-xl flex items-center justify-center shrink-0">
                <HugeiconsIcon icon={Clock01Icon} className="w-5 h-5 text-neutral-600" />
              </div>
              <div className="flex flex-col">
                <span className="font-poppins text-[10px] text-neutral-400 uppercase tracking-wider">Time</span>
                <span className="font-poppins text-base font-semibold text-[#111111] mt-0.5">
                  {formatBookingTimeRange(booking.schedule)}
                </span>
              </div>
            </div>
          </div>
          {staffNames.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-neutral-400 font-poppins ml-1">
              <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center text-[10px] font-bold text-neutral-600 shrink-0">
                {staffNames[0]?.charAt(0)}
              </div>
              <span>
                with {staffNames.join(", ")}
                {booking.customerRescheduleCount > 0 && ` • Reschedule ${booking.customerRescheduleCount} of 2`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 2.5 ADDRESS GRID CARD */}
      {travelAddress && (
        <div className="bg-white border border-neutral-200/60 rounded-2xl p-6 flex flex-col gap-5 w-full shadow-sm">
          <span className="font-poppins text-xs font-normal text-[#73726D] tracking-[0.075em] uppercase">
            Address
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 font-poppins">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-[#73726D] uppercase tracking-wider">City</span>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                <HugeiconsIcon icon={Location05Icon} className="w-5 h-5 text-neutral-500 shrink-0" />
                <span>{travelAddress.city}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-[#73726D] uppercase tracking-wider">Property Type</span>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                <HugeiconsIcon icon={Building06Icon} className="w-5 h-5 text-neutral-500 shrink-0" />
                <span>{travelAddress.propertyType}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-[#73726D] uppercase tracking-wider">Area/Neighbourhood</span>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                <HugeiconsIcon icon={SentIcon} className="w-5 h-5 text-neutral-500 shrink-0" />
                <span>{travelAddress.area}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-[#73726D] uppercase tracking-wider">Street Name</span>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                <HugeiconsIcon icon={Route01Icon} className="w-5 h-5 text-neutral-500 shrink-0" />
                <span>{travelAddress.streetName}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 font-poppins mt-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-[#73726D] uppercase tracking-wider">Street Number</span>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                <HugeiconsIcon icon={Home03Icon} className="w-5 h-5 text-neutral-500 shrink-0" />
                <span>{travelAddress.streetNumber}</span>
              </div>
            </div>
            {travelAddress.floorUnit && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-[#73726D] uppercase tracking-wider">Floor/Unit</span>
                <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                  <HugeiconsIcon icon={Layers01Icon} className="w-5 h-5 text-neutral-500 shrink-0" />
                  <span>{travelAddress.floorUnit}</span>
                </div>
              </div>
            )}
            {travelAddress.aptRoom && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-[#73726D] uppercase tracking-wider">Apt/Room No.</span>
                <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                  <HugeiconsIcon icon={PinIcon} className="w-5 h-5 text-neutral-500 shrink-0" />
                  <span>{travelAddress.aptRoom}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. STATUS LOG EXPLANATION — driven entirely by real cancellationOutcome/completionPayment
          fields, never a hardcoded per-booking-id special case. */}
      {status === "NO_SHOW_WAIVED" ? (
        <StatusNote>
          The no-show was waived. This booking is considered cancelled — no charge was made to the
          customer&apos;s card.
        </StatusNote>
      ) : status === "CANCELLED_BY_BUSINESS" ? (
        <StatusNote>
          {booking.cancellationOutcome?.refundOwedCents
            ? `This booking was cancelled by the business. ${formatBookingMoney(booking.cancellationOutcome.refundOwedCents)} has been refunded to the customer (settlement: ${(booking.cancellationOutcome.settlementStatus ?? "PENDING").toLowerCase()}).`
            : "This booking was cancelled by the business. No deposit was held, so no refund was due."}
        </StatusNote>
      ) : status === "LATE_CANCELLATION" ? (
        <StatusNote>
          This booking was cancelled by the customer outside the free cancellation window
          {booking.cancellationOutcome?.feePercentage !== undefined && ` — a ${booking.cancellationOutcome.feePercentage}% late-cancellation fee applied`}.{" "}
          {additionalChargeCents > 0
            ? `${formatBookingMoney(additionalChargeCents)} was charged (settlement: ${(booking.cancellationOutcome?.settlementStatus ?? "PENDING").toLowerCase()}).`
            : "The already-collected deposit fully covered the fee — no additional charge was made."}
        </StatusNote>
      ) : status === "CANCELLED_BY_CUSTOMER" ? (
        <StatusNote>
          This booking was cancelled by the customer within the free cancellation window. No fee
          was charged.
        </StatusNote>
      ) : status === "NO_SHOW_CANCELLED" ? (
        <StatusNote>
          The no-show was cancelled/resolved by the business — this booking is considered
          resolved with no charge to the customer.
        </StatusNote>
      ) : status === "NO_SHOW_CHARGED" ? (
        <StatusNote>
          The 90-minute resolution window passed with no response. The no-show fee was charged to
          the customer&apos;s saved card.
        </StatusNote>
      ) : null}

      {/* 4. MARKED AS NO-SHOW ACCORDION */}
      {status === "PENDING" && (
        <div className="flex flex-col border border-neutral-200/60 bg-white rounded-2xl overflow-hidden shadow-sm w-full">
          <div
            onClick={() => setShowMarkedNoShow(!showMarkedNoShow)}
            className="bg-[#F4F2EC] px-6 py-3.5 flex items-center justify-between cursor-pointer select-none text-[11px] text-[#73726D] tracking-wider uppercase font-semibold font-poppins"
          >
            <span>Marked as No-show</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className={`w-4 h-4 text-neutral-600 transition-transform duration-200 ${showMarkedNoShow ? "rotate-180" : ""}`}
            />
          </div>

          {showMarkedNoShow && (
            <div className="p-6 flex flex-col gap-5 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#FEE6E6] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 min-h-[118px]">
                  <span className="text-xs text-[#000000] font-inter">Marked at</span>
                  <span className="text-sm font-semibold text-[#111111] font-poppins">
                    {booking.noShowStartedAt ? formatBookingDate(booking.noShowStartedAt, booking.schedule.timezone) : "—"}
                  </span>
                </div>
                <div className="bg-[#FEE6E6] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 min-h-[118px]">
                  <span className="text-2xl font-bold text-[#000000] font-inter">
                    {remainingMs !== undefined ? formatCountdown(remainingMs) : "—"}
                  </span>
                  <span className="text-xs text-[#000000] text-center font-inter px-2 leading-relaxed">
                    Customer will be charged automatically when the timer reaches zero.
                  </span>
                </div>
              </div>

              <div className="bg-[#F5F4EE] border border-neutral-200/50 rounded-xl p-4 flex items-center justify-between font-poppins text-sm text-[#1C1B1C] mt-2">
                <span className="font-medium">No-show fee (outstanding)</span>
                <span className="font-bold text-base">{formatBookingMoney(additionalChargeCents)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <button
                  onClick={onWaiveFeeClick}
                  className="h-[44px] rounded-lg bg-[#E24B4A] hover:bg-[#D34140] text-white text-xs font-semibold font-poppins shadow-sm cursor-pointer"
                >
                  Waive fee &amp; cancel timer
                </button>
                <button
                  onClick={onCancelNoShowClick}
                  className="h-[44px] rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-[#1C1B1C] text-xs font-semibold font-poppins shadow-sm cursor-pointer"
                >
                  Cancel No-show
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. BOOKING SUMMARY COLLAPSIBLE CARD */}
      {showSummaryDetails && (
        <div className="flex flex-col border border-neutral-200/60 bg-white rounded-2xl overflow-hidden shadow-sm w-full">
          <div
            onClick={() => setShowSummary(!showSummary)}
            className="bg-[#F4F2EC] px-6 py-3.5 flex items-center justify-between cursor-pointer select-none text-[11px] text-[#73726D] tracking-wider uppercase font-semibold font-poppins"
          >
            <span>Booking Summary</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className={`w-4 h-4 text-neutral-600 transition-transform duration-200 ${showSummary ? "rotate-180" : ""}`}
            />
          </div>

          {showSummary && (
            <div className="p-4 flex flex-col gap-6 bg-white">
              <div className="flex flex-col gap-6">
                {booking.serviceLines.map((line) => (
                  <div key={line.serviceId} className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <span className="font-poppins font-medium text-sm text-[#1C1B1C]">{line.name}</span>
                      {line.addons.length > 0 && (
                        <span className="text-xs text-[#4E5F78] font-poppins mt-0.5">
                          {line.addons.map((a) => a.name).join(" • ")}
                        </span>
                      )}
                    </div>
                    <span className="font-poppins font-semibold text-sm text-[#1C1B1C]">
                      {formatBookingMoney(line.amountCents)}
                    </span>
                  </div>
                ))}

                {booking.financials.travelFeeCents > 0 && (
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Car04Icon} className="w-5 h-5 text-neutral-600 shrink-0" />
                        <span className="font-poppins font-medium text-sm text-[#1C1B1C]">Travel fee</span>
                      </div>
                    </div>
                    <span className="font-poppins font-semibold text-sm text-[#1C1B1C]">
                      {formatBookingMoney(booking.financials.travelFeeCents)}
                    </span>
                  </div>
                )}

                <div className="border-t border-[#757575]/20 w-full" />

                <div className="flex justify-between items-center text-sm font-semibold font-poppins text-[#1C1B1C] px-2">
                  <span>Total</span>
                  <span>{formatBookingMoney(booking.financials.totalCents)}</span>
                </div>

                <div className="bg-[#F5F4EE] rounded-xl p-4 flex flex-col gap-5">
                  <div className="flex justify-between items-center font-poppins text-sm text-[#1C1B1C]">
                    <span>{isManual ? "Amount" : "Deposited"}</span>
                    <span className="font-semibold text-2xl">
                      {isManual ? formatBookingMoney(booking.financials.totalCents) : formatBookingMoney(booking.financials.depositCents)}
                    </span>
                  </div>
                  {!isManual && (
                    <>
                      <div className="border-t border-[#757575]/20 w-full" />
                      <div className="flex justify-between items-center font-poppins text-[#1C1B1C]">
                        <span className="text-sm font-medium">Remaining balance due at appointment</span>
                        <span className="font-semibold text-2xl text-[#1C1B1C]">
                          {formatBookingMoney(booking.financials.balanceDueCents)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {booking.completionPayment && (
                <div className="flex justify-between items-center bg-[#EEF5F0] rounded-xl px-4 py-3 text-sm font-semibold text-[#297A5E] font-poppins mt-2">
                  <span>{booking.completionPayment.paid ? "Paid at venue" : "Not paid at venue"}</span>
                  <span>{booking.completionPayment.amountCents !== undefined ? formatBookingMoney(booking.completionPayment.amountCents) : "—"}</span>
                </div>
              )}

              {booking.cancellationOutcome && booking.cancellationOutcome.cancellationFeeCents > 0 && (
                <div className="flex flex-col gap-2 bg-[#EEF5F0] rounded-xl px-4 py-3 text-sm font-semibold font-poppins mt-2">
                  <div className="flex justify-between items-center text-[#297A5E]">
                    <span>Cancellation fee{booking.cancellationOutcome.feePercentage !== undefined ? ` (${booking.cancellationOutcome.feePercentage}%)` : ""}</span>
                    <span>{formatBookingMoney(booking.cancellationOutcome.cancellationFeeCents)}</span>
                  </div>
                  {booking.cancellationOutcome.depositAppliedCents > 0 && (
                    <>
                      <div className="border-t border-[#297A5E]/15 my-1.5" />
                      <div className="flex justify-between items-center text-[#1C1B1C]">
                        <span>Applied from deposit already collected</span>
                        <span>{formatBookingMoney(booking.cancellationOutcome.depositAppliedCents)}</span>
                      </div>
                    </>
                  )}
                  {additionalChargeCents > 0 && (
                    <div className="flex justify-between items-center text-[#1C1B1C]">
                      <span>Additional amount charged</span>
                      <span>{formatBookingMoney(additionalChargeCents)}</span>
                    </div>
                  )}
                </div>
              )}

              {status === "NO_SHOW_CHARGED" && (
                <div className="flex items-center gap-2 bg-[#F5F4EE] rounded-xl p-3 text-[11px] text-[#73726D] font-poppins">
                  <HugeiconsIcon icon={InformationCircleIcon} className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span>Appears in payouts &amp; Finance end of month</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. NOTES CARD */}
      {showNotesDetails && booking.notes && (
        <div className="flex flex-col gap-4 w-full">
          <div className="bg-white border border-neutral-200/60 rounded-2xl p-6 flex flex-col gap-2 w-full">
            <span className="font-poppins text-[10px] uppercase font-semibold text-[#73726D] tracking-[0.06em]">
              CLIENT LEFT NOTES
            </span>
            <div className="border-l-4 border-[#B4B3AF] bg-[#F5F4EE] p-4 rounded-r-lg text-xs font-medium text-[#111111] leading-relaxed">
              {booking.notes}
            </div>
          </div>
        </div>
      )}

      {showFooterActions && (status === "UPCOMING" || status === "PENDING") && (
        <div className="flex justify-end gap-3 mt-4 w-full select-none">
          {status === "UPCOMING" && (
            <button
              onClick={onCancelBooking}
              className="h-[40px] px-6 rounded-lg border border-[#D44343] text-[#D44343] hover:bg-[#FFF0F0] text-xs font-semibold font-poppins shadow-sm"
            >
              Cancel Booking
            </button>
          )}
          <button
            onClick={() => setIsRescheduling(true)}
            className="h-[40px] px-6 rounded-lg bg-[#111111] hover:bg-neutral-800 text-white text-xs font-semibold font-poppins shadow-sm"
          >
            Reschedule
          </button>
          {status === "UPCOMING" && (
            <button
              onClick={onCompleteBooking}
              className="h-[40px] px-6 rounded-lg bg-[#12B76A] hover:bg-[#0F9F5C] text-white text-xs font-semibold font-poppins shadow-sm"
            >
              Complete Booking
            </button>
          )}
        </div>
      )}

      {/* RESCHEDULE MODAL — real availability, real slots */}
      {isRescheduling && primaryLine && (
        <RescheduleModal
          businessId={businessId}
          serviceId={primaryLine.serviceId}
          staffMembershipId={primaryLine.staffMembershipId}
          currentSchedule={booking.schedule}
          currentServiceName={primaryLine.name}
          notes={booking.notes}
          isPending={isReschedulePending}
          onClose={() => setIsRescheduling(false)}
          onConfirm={(startAtIso) => {
            onReschedule?.(startAtIso);
            setIsRescheduling(false);
          }}
        />
      )}
    </div>
  );
}

const StatusNote = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white border border-neutral-200/60 rounded-2xl p-6 flex flex-col gap-3 w-full shadow-sm">
    <span className="font-poppins text-xs font-normal text-[#73726D] tracking-[0.075em] uppercase">
      Status
    </span>
    <div className="border-l-4 border-[#B4B3AF] bg-[#F5F4EE] p-4 rounded-r-lg text-sm font-medium text-[#111111] leading-relaxed">
      {children}
    </div>
  </div>
);

interface RescheduleModalProps {
  businessId: string;
  serviceId: string;
  staffMembershipId: string;
  currentSchedule: { startAt: string; endAt: string; timezone: string };
  currentServiceName: string;
  notes?: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (startAtIso: string) => void;
}

/** Real availability-driven reschedule (Batch 6) — replaces the previous static/hardcoded
 * calendar. Queries GET /businesses/:id/services/:id/availability for the visible month and
 * renders only genuinely open days/slots; never fabricates a slot. */
function RescheduleModal({
  businessId,
  serviceId,
  staffMembershipId,
  currentSchedule,
  currentServiceName,
  notes,
  isPending,
  onClose,
  onConfirm,
}: RescheduleModalProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const monthStart = new Date(viewYear, viewMonth, 1);
  const monthEnd = new Date(viewYear, viewMonth + 1, 0);
  const fromDate = monthStart.toISOString().slice(0, 10);
  const toDate = monthEnd.toISOString().slice(0, 10);

  const availabilityQuery = useAvailabilityQuery(businessId, serviceId, {
    fromDate,
    toDate,
    staffMembershipId,
  });

  const dayByDate = new Map((availabilityQuery.data?.days ?? []).map((d) => [d.date, d]));
  const selectedDay = selectedDate ? dayByDate.get(selectedDate) : undefined;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const firstDayOffset = (() => {
    const day = monthStart.getDay();
    return day === 0 ? 6 : day - 1;
  })();
  const daysInMonth = monthEnd.getDate();

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center overflow-y-auto p-4 font-poppins">
      <div className="bg-white rounded-2xl p-8 max-w-[700px] w-full relative shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <h2 className="text-2xl font-semibold text-[#111111]">Reschedule booking</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col gap-4 bg-white">
          <span className="text-sm font-semibold text-[#111111]">{currentServiceName}</span>
          <div className="flex items-center gap-3 text-sm text-[#111111]">
            <HugeiconsIcon icon={Calendar01Icon} className="w-5 h-5 text-neutral-600" />
            <span className="line-through text-neutral-400">{formatBookingDate(currentSchedule.startAt, currentSchedule.timezone)} · {formatBookingTimeRange(currentSchedule)}</span>
            {selectedSlot && (
              <>
                <span className="text-neutral-400">→</span>
                <span className="text-[#1F8900] font-medium">{formatBookingDate(selectedSlot, currentSchedule.timezone)} · {formatBookingTimeRange({ startAt: selectedSlot, endAt: selectedSlot, timezone: currentSchedule.timezone }).split("–")[0]}</span>
              </>
            )}
          </div>

          <div className="bg-[#E5F5EF] text-[#2A6D16] rounded-xl p-3 flex items-start gap-3 mt-1">
            <div className="w-5 h-5 rounded-full border border-[#2A6D16] flex items-center justify-center shrink-0 mt-0.5">
              <HugeiconsIcon icon={Tick01Icon} className="w-3.5 h-3.5 text-[#2A6D16]" />
            </div>
            <span className="text-[13px] font-medium leading-relaxed">
              Rescheduling moves the whole appointment. It does not count against the customer&apos;s own reschedule quota when done by the business.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-800">{monthNames[viewMonth]} {viewYear}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else { setViewMonth((m) => m - 1); }
                  setSelectedDate(null);
                  setSelectedSlot(null);
                }}
                className="p-1 hover:bg-neutral-50 rounded text-neutral-600"
              >
                &lt;
              </button>
              <button
                onClick={() => {
                  if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else { setViewMonth((m) => m + 1); }
                  setSelectedDate(null);
                  setSelectedSlot(null);
                }}
                className="p-1 hover:bg-neutral-50 rounded text-neutral-600"
              >
                &gt;
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#111111] bg-white border border-neutral-100 rounded-xl p-4">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={i} className="py-2 text-[#73726D] font-medium">{d}</div>
            ))}
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="py-2" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const day = dayByDate.get(dateStr);
              const hasSlots = Boolean(day?.isOpen && day.slots.length > 0);
              const isSelected = selectedDate === dateStr;
              return (
                <button
                  key={d}
                  disabled={!hasSlots}
                  onClick={() => { setSelectedDate(dateStr); setSelectedSlot(null); }}
                  className={`py-2 rounded-full w-8 h-8 mx-auto flex items-center justify-center transition-all ${
                    isSelected ? "bg-[#111111] text-white" : hasSlots ? "text-[#111111] hover:bg-neutral-100" : "text-neutral-300 cursor-not-allowed"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <span className="text-xs font-semibold tracking-wider text-neutral-400 uppercase">
            {selectedDate ? `Available times — ${selectedDate}` : "Select a day with availability"}
          </span>
          {availabilityQuery.isLoading ? (
            <span className="text-xs text-neutral-400">Loading availability…</span>
          ) : selectedDay && selectedDay.slots.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {selectedDay.slots.map((slot) => (
                <button
                  key={slot.startAt}
                  onClick={() => setSelectedSlot(slot.startAt)}
                  className={`h-9 rounded-lg border text-xs font-semibold transition-all ${
                    selectedSlot === slot.startAt ? "bg-[#111111] text-white border-[#111111]" : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {formatBookingTimeRange({ startAt: slot.startAt, endAt: slot.startAt, timezone: currentSchedule.timezone }).split("–")[0]}
                </button>
              ))}
            </div>
          ) : selectedDate ? (
            <span className="text-xs text-neutral-400">No available slots on this day.</span>
          ) : null}
        </div>

        {notes && (
          <div className="bg-white border border-neutral-200/60 rounded-2xl p-6 flex flex-col gap-2 w-full mt-2">
            <span className="font-poppins text-[10px] uppercase font-semibold text-[#73726D] tracking-[0.06em]">
              Customer Notes
            </span>
            <div className="border-l-4 border-[#B4B3AF] bg-[#F5F4EE] p-4 rounded-r-lg text-xs font-medium text-[#111111] leading-relaxed">
              {notes}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4 mt-2">
          <button
            onClick={onClose}
            className="h-10 px-6 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-xs font-semibold text-[#111111]"
          >
            Cancel
          </button>
          <button
            disabled={!selectedSlot || isPending}
            onClick={() => selectedSlot && onConfirm(selectedSlot)}
            className="h-10 px-6 rounded-lg bg-[#59B1CC] hover:bg-[#4ea0b8] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
