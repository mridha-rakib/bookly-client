"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bookingCalendarSyncApi,
  type BookingCalendarRecoveryInput,
} from "@/lib/api/booking-calendar-sync";
import { bookingKeys } from "@/lib/bookings/hooks";

/** Nested under the Booking detail key, so every existing Booking mutation that refreshes the
 * detail (reschedule, cancellation, completion, no-show) also refreshes its Calendar status. */
export const bookingCalendarSyncKey = (businessId: string, bookingId: string) =>
  [...bookingKeys.detail(businessId, bookingId), "calendarSync"] as const;

export const useBookingCalendarSyncQuery = (
  businessId: string | undefined,
  bookingId: string | undefined,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: bookingCalendarSyncKey(businessId ?? "", bookingId ?? ""),
    queryFn: () => bookingCalendarSyncApi.getStatus(businessId!, bookingId!),
    enabled: Boolean(businessId && bookingId) && (options.enabled ?? true),
  });

export const useBookingCalendarRecoveryMutation = (businessId: string, bookingId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BookingCalendarRecoveryInput) =>
      bookingCalendarSyncApi.recover(businessId, bookingId, input),
    onSuccess: (result) => {
      queryClient.setQueryData(bookingCalendarSyncKey(businessId, bookingId), result.sync);
      void queryClient.invalidateQueries({ queryKey: bookingCalendarSyncKey(businessId, bookingId) });
    },
  });
};
