"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bookingsApi,
  type BookingDetail,
  type CreateBookingInput,
  type CreateManualBookingInput,
  type FinalizeBookingResult,
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
  // --- Customer scope (Batch 9) — cross-business, mirrors "/me/bookings" ---
  customerAll: ["customerBookings"] as const,
  customerLists: () => [...bookingKeys.customerAll, "list"] as const,
  customerList: (params: ListBookingsParams) => [...bookingKeys.customerLists(), params] as const,
  customerDetails: () => [...bookingKeys.customerAll, "detail"] as const,
  customerDetail: (bookingId: string) => [...bookingKeys.customerDetails(), bookingId] as const,
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

/** Batch 10 — Business Owner/Supervisor manual booking creation. Reuses the exact same
 * `CreateManualBookingInput` shape and idempotency contract as `createManualBooking` on the
 * backend (a real MongoDB unique-index-backed claim — see BookingCreationClaimRepository) —
 * never a second, competing idempotency scheme. A MANUAL booking's `depositCents`/
 * `platformFeeCents` are always zero (server-enforced, see BookingService.
 * validateManualBookingHasNoBooklyFee) — there is no payment/Stripe step in this flow at all. */
export const useCreateManualBookingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      input,
    }: {
      businessId: string;
      input: CreateManualBookingInput;
    }) => bookingsApi.createManual(businessId, input),
    onSuccess: (booking, variables) => onBookingMutated(queryClient, variables.businessId, booking),
  });
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

// --- Customer-side (Batch 9) --------------------------------------------------------------

export const useCustomerBookingsQuery = (params: ListBookingsParams = {}) =>
  useQuery({
    queryKey: bookingKeys.customerList(params),
    queryFn: () => bookingsApi.listForCustomer(params),
  });

export const useCustomerBookingDetailQuery = (bookingId: string | undefined) =>
  useQuery({
    queryKey: bookingKeys.customerDetail(bookingId ?? ""),
    queryFn: () => bookingsApi.getDetailForCustomer(bookingId as string),
    enabled: Boolean(bookingId),
  });

const invalidateCustomerBookingCaches = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: bookingKeys.customerLists() });
};

/** A "get me the real price" quote — read-only server-side, but a mutation (not a query) since
 * it's triggered on demand as the customer moves through the wizard (service lines/date change),
 * never polled/cached across renders. Never trust a client-computed total — see
 * BookingCreationPreview's own doc comment in lib/api/bookings.ts. */
export const usePreviewCustomerBookingMutation = () =>
  useMutation({
    mutationFn: ({ businessId, input }: { businessId: string; input: CreateBookingInput }) =>
      bookingsApi.previewCustomerBooking(businessId, input),
  });

/** The real booking-creation call — may return `{status: "requires_action", clientSecret}` for
 * 3DS (see FinalizeBookingResult's own doc comment); the caller is responsible for completing
 * 3DS via Stripe.js and calling this AGAIN with the SAME `idempotencyKey` inside `input`, which
 * the backend's own idempotent-retry claim resolves safely (see
 * BookingCreationService.finalizeCustomerBooking's own doc comment — never a second charge). */
export const useFinalizeCustomerBookingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, input }: { businessId: string; input: CreateBookingInput }) =>
      bookingsApi.finalizeCustomerBooking(businessId, input),
    onSuccess: (result: FinalizeBookingResult) => {
      // Discriminate the SAME way lib/api/bookings.ts's own doc comment specifies: only the
      // requires_action shape has `clientSecret` — a confirmed BookingDetail's own `status`
      // field is a BookingStatus value like "UPCOMING", never the literal "confirmed".
      if (!("clientSecret" in result)) {
        queryClient.setQueryData(bookingKeys.customerDetail(result.id), result);
        invalidateCustomerBookingCaches(queryClient);
      }
    },
  });
};

export const useCancelByCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      bookingsApi.cancelByCustomer(bookingId, reason),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKeys.customerDetail(booking.id), booking);
      invalidateCustomerBookingCaches(queryClient);
    },
  });
};

export const useRescheduleByCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, startAt }: { bookingId: string; startAt: string }) =>
      bookingsApi.rescheduleByCustomer(bookingId, startAt),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKeys.customerDetail(booking.id), booking);
      invalidateCustomerBookingCaches(queryClient);
    },
  });
};
