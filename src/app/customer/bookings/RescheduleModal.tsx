"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location05Icon, Calendar01Icon, Tick01Icon } from "@hugeicons/core-free-icons";

import { useCustomerBookingDetailQuery, useRescheduleByCustomerMutation } from "@/lib/bookings/hooks";
import { useBusinessCatalogQuery, useServiceAvailabilityQuery } from "@/lib/catalog/hooks";
import type { AvailabilitySlot } from "@/lib/api/catalog";
import { formatBookingDate, formatBookingMoney, formatBookingTimeRange } from "@/lib/bookings/format";
import { toUserMessage } from "@/lib/auth/messages";
import TimeStep from "../../venue/components/TimeStep";

// Mirrors api/src/modules/booking/booking.types.ts MAX_CUSTOMER_RESCHEDULE_COUNT.
const MAX_CUSTOMER_RESCHEDULE_COUNT = 2;

interface RescheduleModalProps {
  bookingId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function RescheduleModal({ bookingId, onClose, onSaved }: RescheduleModalProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const detailQuery = useCustomerBookingDetailQuery(bookingId);
  const detail = detailQuery.data;
  const primaryLine = detail?.serviceLines[0];

  const catalogQuery = useBusinessCatalogQuery(detail?.businessId);
  const business = catalogQuery.data?.business;

  const [visibleMonthOverride, setVisibleMonthOverride] = useState<Date | undefined>(undefined);
  const defaultMonth = detail
    ? new Date(new Date(detail.schedule.startAt).getFullYear(), new Date(detail.schedule.startAt).getMonth(), 1)
    : new Date();
  const visibleMonth = visibleMonthOverride ?? defaultMonth;

  const [selectedDateIso, setSelectedDateIso] = useState<string | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const fromDate = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const toDateObj = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const toDate = `${toDateObj.getFullYear()}-${String(toDateObj.getMonth() + 1).padStart(2, "0")}-${String(toDateObj.getDate()).padStart(2, "0")}`;

  const availabilityQuery = useServiceAvailabilityQuery(
    detail?.businessId,
    primaryLine?.serviceId,
    detail ? { fromDate, toDate, staffMembershipId: primaryLine?.staffMembershipId } : undefined,
  );

  const rescheduleMutation = useRescheduleByCustomerMutation();

  const remaining = detail ? MAX_CUSTOMER_RESCHEDULE_COUNT - detail.customerRescheduleCount : undefined;
  const limitReached = remaining !== undefined && remaining <= 0;

  const handleSave = async () => {
    if (!selectedSlot) return;
    setError(undefined);
    try {
      await rescheduleMutation.mutateAsync({ bookingId, startAt: selectedSlot.startAt });
      onSaved();
    } catch (err) {
      setError(toUserMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex justify-center items-start overflow-y-auto z-50 sm:p-4 p-0 md:py-10">
      <div className="w-full max-w-[794px] bg-[#FFFFFF] sm:rounded-xl rounded-none border-x-0 sm:border-x border-y sm:border-y border-[#C6C6CB] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] p-6 md:p-10 flex flex-col gap-6 relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl cursor-pointer z-10"
        >
          ✕
        </button>

        <div className="w-full text-center pb-2">
          <h1 className="font-poppins font-medium text-3xl leading-[40px] text-[#111111]">Reschedule booking</h1>
        </div>

        {detailQuery.isLoading ? (
          <p className="text-center text-sm text-[#4E5F78]">Loading booking…</p>
        ) : !detail ? (
          <p className="text-center text-sm text-[#4E5F78]">
            This booking could not be found. It may not exist, or it may not belong to your account.
          </p>
        ) : (
          <>
            <div className="flex flex-row items-start gap-4 w-full">
              <div className="w-[80px] h-[80px] rounded-lg overflow-hidden border border-[#C6C6CB] flex-shrink-0 relative bg-neutral-100">
                <Image src="/image/imgOfService.png" alt={business?.name ?? "Business"} fill className="object-cover" />
              </div>

              <div className="flex-1 flex flex-col gap-1 font-poppins">
                <h2 className="font-semibold text-lg text-black leading-tight">{business?.name ?? "—"}</h2>

                {remaining !== undefined && (
                  <span className="text-xs font-medium text-[#4E5F78]">
                    {limitReached ? "No reschedules remaining for this booking" : `${remaining} reschedule${remaining === 1 ? "" : "s"} remaining`}
                  </span>
                )}

                {business && business.visitType !== "TRAVEL_TO_CUSTOMER" && (
                  <div className="flex items-center gap-1 text-xs text-[#4E5F78] font-medium">
                    <HugeiconsIcon icon={Location05Icon} className="w-3.5 h-3.5 text-[#4E5F78]" />
                    <span>
                      {business.address.streetName} {business.address.streetNumber}, {business.address.area}
                    </span>
                  </div>
                )}

                <div className="text-xs text-[#3A97D1] font-semibold">Booking ID: {detail.reference}</div>
              </div>
            </div>

            <hr className="border-t border-[#EBEBEB] w-full" />

            <div className="flex flex-col gap-3 w-full font-poppins">
              <h3 className="text-[#111111] font-semibold text-base">{primaryLine?.name ?? "—"}</h3>

              <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
                <HugeiconsIcon icon={Calendar01Icon} className="w-4 h-4 text-gray-500" />
                <span className="line-through text-gray-500">
                  {formatBookingDate(detail.schedule.startAt, detail.schedule.timezone)} • {formatBookingTimeRange(detail.schedule)}
                </span>
                {selectedSlot && (
                  <>
                    <span className="text-gray-500">→</span>
                    <span className="text-[#1F8900] font-semibold">
                      {selectedDateIso} •{" "}
                      {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: detail.schedule.timezone }).format(
                        new Date(selectedSlot.startAt),
                      )}
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2 mt-1">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-[#111111]">Deposit already paid</span>
                  <span className="text-gray-500">{formatBookingMoney(detail.financials.depositCents)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-[#111111]">Balance due at venue</span>
                  <span className="text-[#111111] font-semibold">{formatBookingMoney(detail.financials.balanceDueCents)}</span>
                </div>

                <div className="flex items-center gap-2 bg-[#E5F5EF] border border-[#2A6D16]/10 rounded-xl p-3.5 mt-1 text-[#2A6D16] text-xs font-semibold">
                  <div className="w-4 h-4 rounded-full border border-[#2A6D16] flex items-center justify-center flex-shrink-0">
                    <HugeiconsIcon icon={Tick01Icon} className="w-2.5 h-2.5 text-[#2A6D16]" />
                  </div>
                  <span>Rescheduling is free — your existing deposit carries forward to your new appointment.</span>
                </div>
              </div>
            </div>

            {limitReached ? (
              <p className="text-sm text-red-600 font-medium text-center">
                This booking has already been rescheduled the maximum number of times.
              </p>
            ) : (
              <TimeStep
                timezone={detail.schedule.timezone}
                visibleMonth={visibleMonth}
                onPrevMonth={() => setVisibleMonthOverride(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                onNextMonth={() => setVisibleMonthOverride(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                availability={availabilityQuery.data}
                isLoading={availabilityQuery.isLoading}
                selectedDateIso={selectedDateIso}
                onSelectDate={(dateIso) => {
                  setSelectedDateIso(dateIso);
                  setSelectedSlot(undefined);
                }}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
              />
            )}

            {error ? <p className="text-sm text-red-600 font-medium text-center">{error}</p> : null}

            <div className="flex gap-4 justify-end font-poppins mt-2">
              <button
                onClick={onClose}
                className="py-2 px-6 border border-[#C6C6CB] rounded-lg text-xs font-semibold text-[#020305] hover:bg-neutral-50 transition-colors bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!selectedSlot || limitReached || rescheduleMutation.isPending}
                className="py-2 px-6 rounded-lg text-xs font-semibold bg-[#67B2C5] text-white hover:bg-[#57a1b4] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {rescheduleMutation.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
