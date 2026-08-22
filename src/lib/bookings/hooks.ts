"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bookingsApi,
  type BookingDetail,
  type ListBookingsParams,
} from "@/lib/api/bookings";

export const bookingKeys = {
  all: ["bookings"] as const,
  lists: (businessId: string) => [...bookingKeys.all, "list", businessId] as const,
  list: (businessId: string, params: ListBookingsParams) =>
    [...bookingKeys.lists(businessId), params] as const,
  details: (businessId: string) => [...bookingKeys.all, "detail", businessId] as const,
  detail: (businessId: string, bookingId: string) =>
    [...bookingKeys.details(businessId), bookingId] as const,
  calendars: (businessId: string) => [...bookingKeys.all, "calendar", businessId] as const,
  calendar: (businessId: string, fromDate: string, toDate: string) =>
    [...bookingKeys.calendars(businessId), fromDate, toDate] as const,
};

/** Every mutation below touches the SAME Booking's list/detail/calendar rows at once (e.g.
 * completing a booking changes its status everywhere it's shown) — a narrower invalidation risks
 * a stale card surviving in a list/calendar view the mutation didn't directly write to. Mirrors
 * clients/hooks.ts's own invalidateClientCaches rationale. */
const invalidateBookingCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  businessId: string,
) => {
  void queryClient.invalidateQueries({ queryKey: bookingKeys.lists(businessId) });
  void queryClient.invalidateQueries({ queryKey: bookingKeys.calendars(businessId) });
};

export const useBusinessBookingsQuery = (
  businessId: string | undefined,
  params: ListBookingsParams = {},
) =>
  useQuery({
    queryKey: bookingKeys.list(businessId ?? "", params),
    queryFn: () => bookingsApi.listForBusiness(businessId as string, params),
    enabled: Boolean(businessId),
  });

export const useBookingDetailQuery = (
  businessId: string | undefined,
  bookingId: string | undefined,
) =>
  useQuery({
    queryKey: bookingKeys.detail(businessId ?? "", bookingId ?? ""),
    queryFn: () => bookingsApi.getDetailForBusiness(businessId as string, bookingId as string),
    enabled: Boolean(businessId) && Boolean(bookingId),
  });

export const useBusinessCalendarQuery = (
  businessId: string | undefined,
  fromDate: string | undefined,
  toDate: string | undefined,
) =>
  useQuery({
    queryKey: bookingKeys.calendar(businessId ?? "", fromDate ?? "", toDate ?? ""),
    queryFn: () => bookingsApi.getCalendar(businessId as string, fromDate as string, toDate as string),
    enabled: Boolean(businessId) && Boolean(fromDate) && Boolean(toDate),
  });

/** Shared success handler for every business-side lifecycle mutation below: seed the fresh
 * detail into cache immediately (so a Booking Detail screen mid-view updates without waiting on
 * a refetch) and invalidate every list/calendar view that might now show this Booking
 * differently. */
const onBookingMutated = (
  queryClient: ReturnType<typeof useQueryClient>,
  businessId: string,
  booking: BookingDetail,
) => {
  queryClient.setQueryData(bookingKeys.detail(businessId, booking.id), booking);
  invalidateBookingCaches(queryClient, businessId);
};

export const useCompleteBookingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      bookingId,
      venuePayment,
    }: {
      businessId: string;
      bookingId: string;
      venuePayment?: { paid: boolean; amountCents?: number; note?: string };
    }) => bookingsApi.completeBooking(businessId, bookingId, venuePayment),
    onSuccess: (booking, variables) => onBookingMutated(queryClient, variables.businessId, booking),
  });
};

export const useCancelByBusinessMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      bookingId,
      reason,
    }: {
      businessId: string;
      bookingId: string;
      reason?: string;
    }) => bookingsApi.cancelByBusiness(businessId, bookingId, reason),
    onSuccess: (booking, variables) => onBookingMutated(queryClient, variables.businessId, booking),
  });
};

export const useRescheduleByOwnerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      bookingId,
      startAt,
    }: {
      businessId: string;
      bookingId: string;
      startAt: string;
    }) => bookingsApi.rescheduleByOwner(businessId, bookingId, startAt),
    onSuccess: (booking, variables) => onBookingMutated(queryClient, variables.businessId, booking),
  });
};

export const useMarkNoShowMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, bookingId }: { businessId: string; bookingId: string }) =>
      bookingsApi.markNoShow(businessId, bookingId),
    onSuccess: (booking, variables) => onBookingMutated(queryClient, variables.businessId, booking),
  });
};

export const useWaiveFeeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      bookingId,
      reason,
      internalNote,
    }: {
      businessId: string;
      bookingId: string;
      reason: string;
      internalNote?: string;
    }) => bookingsApi.waiveFee(businessId, bookingId, reason, internalNote),
    onSuccess: (booking, variables) => onBookingMutated(queryClient, variables.businessId, booking),
  });
};

export const useCancelNoShowMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, bookingId }: { businessId: string; bookingId: string }) =>
      bookingsApi.cancelNoShow(businessId, bookingId),
    onSuccess: (booking, variables) => onBookingMutated(queryClient, variables.businessId, booking),
  });
};
