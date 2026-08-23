"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon, ScissorIcon, User02Icon, Calendar03Icon, Location01Icon, MapsIcon, Appointment02Icon } from "@hugeicons/core-free-icons";

import type { BookingDetail } from "@/lib/api/bookings";
import { formatBookingDate, formatBookingMoney, formatBookingTimeRange } from "@/lib/bookings/format";

interface ConfirmedStepProps {
  booking: BookingDetail;
  setBookingStep: (step: null) => void;
}

export default function ConfirmedStep({ booking, setBookingStep }: ConfirmedStepProps) {
  const router = useRouter();
  const primaryLine = booking.serviceLines[0];
  const staffName = primaryLine
    ? [primaryLine.staffName].filter(Boolean).join(" ") || "Assigned professional"
    : "—";
  const location =
    booking.fulfilment.mode === "AT_BUSINESS_LOCATION"
      ? booking.fulfilment.businessLocation
      : booking.fulfilment.travelAddress;

  return (
    <div className="w-full flex flex-col items-center justify-start p-0 gap-8 relative font-manrope max-w-[624px] mx-auto py-12">
      {/* Celebration Header */}
      <div className="flex flex-col items-center gap-3 text-center w-full">
        <div className="w-[76px] h-[76px] flex items-center justify-center p-3.5 rounded-full border-2 border-[#3586B8] shrink-0" style={{ background: "linear-gradient(0deg, rgba(12, 192, 223, 0.2), rgba(12, 192, 223, 0.2)), #2E9DA7" }}>
          <HugeiconsIcon icon={Tick01Icon} size={48} className="text-[#1A5A60] shrink-0" />
        </div>
        <div className="pt-3 pb-0 flex flex-col items-center w-full">
          <h1 className="font-extrabold text-[36px] leading-[40px] text-[#020305] text-center tracking-[-0.9px]">Booking Confirmed!</h1>
        </div>
        <div className="flex flex-col items-center w-full">
          <p className="text-[18px] leading-[28px] font-normal text-[#45474B] text-center">Your appointment has been successfully scheduled.</p>
        </div>
      </div>

      {/* Bento booking summary card */}
      <div className="w-full bg-white border border-[#C6C6CB] rounded-2xl shadow-[0px_2px_4px_rgba(0,0,0,0.05)] flex flex-col items-start pt-2 pb-8">
        <div className="flex flex-col justify-center items-start p-6 relative w-full border-b border-[#F0F0EE]">
          <div className="flex flex-col items-start gap-[2px]">
            <span className="font-semibold text-sm text-[#2E9DA7] leading-[20px] tracking-wider">
              Booking Ref: {booking.reference}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start p-8 gap-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 w-full">
                <div className="w-8 h-8 bg-[#F1EDED] rounded-lg flex items-center justify-center shrink-0 p-2">
                  <HugeiconsIcon icon={ScissorIcon} size={16} className="text-[#4E5F78]" />
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span className="font-medium text-sm text-[#45474B] leading-[20px]">Service</span>
                  <span className="font-bold text-base text-[#020305] leading-[24px]">
                    {primaryLine?.name ?? "—"}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 w-full">
                <div className="w-8 h-8 bg-[#F1EDED] rounded-lg flex items-center justify-center shrink-0 p-2">
                  <HugeiconsIcon icon={User02Icon} size={16} className="text-[#4E5F78]" />
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span className="font-medium text-sm text-[#45474B] leading-[20px]">Professional</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-full overflow-hidden relative border border-neutral-100 bg-neutral-100">
                      <Image src="/image/profile.jpg" alt={staffName} fill className="object-cover" />
                    </div>
                    <span className="font-bold text-base text-[#020305] leading-[24px]">{staffName}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 w-full">
                <div className="w-8 h-8 bg-[#F1EDED] rounded-lg flex items-center justify-center shrink-0 p-2">
                  <HugeiconsIcon icon={Calendar03Icon} size={16} className="text-[#4E5F78]" />
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span className="font-medium text-sm text-[#45474B] leading-[20px]">Date & Time</span>
                  <span className="font-bold text-base text-[#020305] leading-[24px]">
                    {formatBookingDate(booking.schedule.startAt, booking.schedule.timezone)}
                  </span>
                  <span className="font-semibold text-base text-[#0D0D0D] leading-[24px]">
                    {formatBookingTimeRange(booking.schedule)}
                  </span>
                </div>
              </div>

              {location ? (
                <div className="flex items-start gap-3 w-full">
                  <div className="w-8 h-8 bg-[#F1EDED] rounded-lg flex items-center justify-center shrink-0 p-2">
                    <HugeiconsIcon icon={Location01Icon} size={16} className="text-[#4E5F78]" />
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium text-sm text-[#45474B] leading-[20px]">Location</span>
                    <span className="font-bold text-base text-[#020305] leading-[24px]">
                      {location.streetName} {location.streetNumber}
                    </span>
                    <span className="text-sm text-[#45474B] leading-[20px]">
                      {location.area}, {location.city}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="w-full h-[1px] bg-[#C6C6CB]/50 my-2" />

          {/* Price Summary breakdown — real data from the booking's own financial snapshot */}
          <div className="flex flex-col gap-4 w-full">
            <div className="flex justify-between items-center w-full font-manrope">
              <span className="font-medium text-base text-[#45474B] leading-[24px]">Deposit paid</span>
              <span className="font-extrabold text-xl text-[#020305] leading-[28px]">
                {formatBookingMoney(booking.financials.depositCents)}
              </span>
            </div>
            <div className="flex justify-between items-center w-full font-manrope">
              <span className="font-medium text-base text-[#45474B] leading-[24px]">Pay remaining at Venue</span>
              <span className="font-extrabold text-xl text-[#020305] leading-[28px]">
                {formatBookingMoney(booking.financials.balanceDueCents)}
              </span>
            </div>
            <div className="flex justify-between items-center w-full font-manrope pt-2 border-t border-neutral-100">
              <span className="font-medium text-base text-[#45474B] leading-[24px]">Total</span>
              <span className="font-extrabold text-xl text-[#020305] leading-[28px]">
                {formatBookingMoney(booking.financials.totalCents)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions buttons */}
      <div className="flex flex-row justify-center items-center p-0 gap-4 w-full h-[54px]">
        <button
          onClick={() => {
            setBookingStep(null);
            router.push(`/customer/bookings/view?id=${booking.id}`);
          }}
          className="flex-1 flex flex-row justify-center items-center py-3.5 px-6 gap-2 bg-white border border-[#C6C6CB] rounded-lg text-[#020305] font-manrope font-semibold text-base leading-[24px] hover:bg-neutral-50 cursor-pointer h-[54px]"
        >
          <HugeiconsIcon icon={MapsIcon} size={18} className="text-[#020305]" />
          <span>View Booking</span>
        </button>
        <button
          onClick={() => {
            setBookingStep(null);
            router.push(`/customer/bookings`);
          }}
          className="flex-1 flex flex-row justify-center items-center py-3.5 px-6 gap-2 bg-white border border-[#C6C6CB] rounded-lg text-[#020305] font-manrope font-semibold text-base leading-[24px] hover:bg-neutral-50 cursor-pointer h-[54px]"
        >
          <HugeiconsIcon icon={Appointment02Icon} size={18} className="text-[#020305]" />
          <span>My Booking</span>
        </button>
      </div>

      {/* Back Link explorer */}
      <div className="pt-4 flex flex-col items-center w-full h-10">
        <button
          onClick={() => setBookingStep(null)}
          className="flex flex-row items-center p-0 gap-2 cursor-pointer text-[#4E5F78] hover:underline"
        >
          <span>← Back to Explore</span>
        </button>
      </div>
    </div>
  );
}
