import type { AvailabilitySlot } from "@/lib/api/availability";
import type { BookingDetail, RescheduleAvailabilityResult } from "@/lib/api/bookings";

export const rescheduleContextKey = (booking: BookingDetail) => JSON.stringify([
  booking.id, booking.businessId, booking.updatedAt, booking.schedule,
  booking.status, booking.customerRescheduleCount, booking.fulfilment,
  booking.serviceLines.map((line) => [line.serviceId, line.staffMembershipId, line.pricingMode,
    line.durationMin, line.hours, line.personCount]),
]);

export const matchesRescheduleContext = (booking: BookingDetail, result: RescheduleAvailabilityResult | undefined) =>
  result?.bookingId === booking.id && result.originalStartAt === booking.schedule.startAt &&
  result.bookingUpdatedAt === booking.updatedAt;

/** The server owns quantities and occupancy. This only verifies selection membership. */
export function isRescheduleSlotCurrent(booking: BookingDetail, result: RescheduleAvailabilityResult | undefined,
  date: string | undefined | null, selected: AvailabilitySlot | undefined | null): boolean {
  return Boolean(selected && matchesRescheduleContext(booking, result) &&
    result?.days.find((day) => day.date === date)?.slots.some((slot) =>
      slot.startAt === selected.startAt && slot.endAt === selected.endAt &&
      slot.eligibleStaffMembershipIds.includes(booking.serviceLines[0]?.staffMembershipId ?? ""),
    ));
}
