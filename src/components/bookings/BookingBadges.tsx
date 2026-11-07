import { HugeiconsIcon } from "@hugeicons/react";
import { Car04Icon, Location01Icon } from "@hugeicons/core-free-icons";
import type { BookingFulfilmentDto, BookingStatus } from "@/lib/api/bookings";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_TONE, type BookingStatusTone } from "@/lib/bookings/format";

// Shared from the existing Customer appointment card, including its exact palette and icons.
const toneClasses: Record<BookingStatusTone, string> = {
  info: "bg-[#CFE1FE] text-[#091C32]", success: "bg-[#CFFED6] text-[#093213]",
  warning: "bg-[#FEF8CF] text-[#322509]", danger: "bg-red-50 text-red-700", neutral: "bg-[#F1EDED] text-[#45474B]",
};
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`px-2.5 py-0.5 rounded-full font-manrope font-semibold text-xs leading-4 ${toneClasses[BOOKING_STATUS_TONE[status]]}`}>{BOOKING_STATUS_LABELS[status]}</span>;
}
export function BookingVisitBadge({ mode, addressText }: { mode: BookingFulfilmentDto["mode"]; addressText?: string }) {
  return <div className="flex items-center gap-1.5 text-sm text-[#111111] font-manrope">
    <HugeiconsIcon icon={mode === "TRAVEL_TO_CUSTOMER" ? Car04Icon : Location01Icon} className="w-4 h-4 text-[#111111]" />
    <span className="font-normal">{mode === "TRAVEL_TO_CUSTOMER" ? "Traveling to you" : addressText ?? "At business location"}</span>
  </div>;
}
