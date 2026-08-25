import { apiRequest } from "@/lib/api/client";
import type { BusinessCity } from "@/lib/constants/cities";

/**
 * Batch 3 frontend Booking domain foundation — types + API client only. Deliberately does NOT
 * wire any screen: DashboardBookingsList.tsx and friends still read their existing mock data
 * (with its inconsistent "Canceled"/"Cancelled"/"Upcoming" strings) until a later batch does
 * that integration work. This file exists so that work has a single, correct source of truth to
 * start from — matching api/src/modules/booking/*.ts and booking.dto.ts exactly, never the
 * mock's ad hoc vocabulary.
 */

// Matches api/src/modules/booking/booking.types.ts bookingStatuses.
export type BookingStatus =
  | "UPCOMING"
  | "COMPLETED"
  | "PENDING"
  | "NO_SHOW_CHARGED"
  | "NO_SHOW_WAIVED"
  | "NO_SHOW_CANCELLED"
  | "CANCELLED_BY_CUSTOMER"
  | "CANCELLED_BY_BUSINESS"
  | "LATE_CANCELLATION";

export type BookingSource = "BOOKLY_MANAGED" | "MANUAL";

export interface BookingServiceLineDto {
  serviceId: string;
  name: string;
  pricingMode: string;
  durationMin: number;
  discountPercent?: number;
  staffMembershipId: string;
  staffName?: string;
  addons: Array<{ addonId: string; name: string; priceCents: number }>;
  amountCents: number;
}

export interface BookingFinancialsDto {
  currency: "EUR";
  servicesSubtotalCents: number;
  addonsSubtotalCents: number;
  serviceDiscountCents: number;
  travelFeeCents: number;
  eligiblePlatformFeeBasisCents: number;
  platformFeeCents: number;
  depositCents: number;
  balanceDueCents: number;
  totalCents: number;
}

export interface BookingScheduleDto {
  timezone: string;
  startAt: string;
  endAt: string;
}

export interface BookingLocationSnapshotDto {
  city: BusinessCity;
  area: string;
  streetName: string;
  streetNumber: string;
  floorUnit?: string;
  aptRoom?: string;
}

export interface BookingTravelAddressSnapshotDto extends BookingLocationSnapshotDto {
  propertyType: string;
  additionalDirections?: string;
}

export interface BookingFulfilmentDto {
  mode: "AT_BUSINESS_LOCATION" | "TRAVEL_TO_CUSTOMER";
  businessLocation?: BookingLocationSnapshotDto;
  travelAddress?: BookingTravelAddressSnapshotDto;
}

export interface BookingDetail {
  id: string;
  businessId: string;
  reference: string;
  source: BookingSource;
  status: BookingStatus;
  customer: {
    businessClientId: string;
    firstName: string;
    lastName?: string;
    email: string;
    phone: { countryCode: string; nationalNumber: string; e164: string };
  };
  createdBy: { actorRole: string };
  fulfilment: BookingFulfilmentDto;
  serviceLines: BookingServiceLineDto[];
  financials: BookingFinancialsDto;
  schedule: BookingScheduleDto;
  customerRescheduleCount: number;
  cancellationOutcome?: {
    classifiedAt: string;
    tier: string;
    feeMode: "FREE" | "PERCENTAGE";
    feePercentage?: number;
    /** The GROSS fee per the cancellation-policy tier — never what's actually charged; see
     * `additionalChargeCents`. Matches api/.../booking.model.ts's own updated doc comment
     * (Batch 5 netting correction). */
    cancellationFeeCents: number;
    /** Portion of the customer's already-collected, non-refundable deposit applied toward the
     * fee (informational only). */
    depositAppliedCents: number;
    /** The actual amount a NEW charge collects (or a Waive Fee action forgives) — always use
     * this, never `cancellationFeeCents`, for "what will the customer be charged". */
    additionalChargeCents: number;
    refundOwedCents: number;
    settlementStatus: "NOT_APPLICABLE" | "PENDING" | "SUCCEEDED" | "FAILED" | "WAIVED";
  };
  /** Set only once the Business has completed the booking and recorded whether the customer
   * paid the remaining balance at the venue — see CompleteModal / bookingsApi.completeBooking. */
  completionPayment?: { paid: boolean; amountCents?: number; recordedAt: string };
  /** Both set only by markNoShow, both-or-neither — the authoritative source for any no-show
   * countdown display (never a client-side-only timer; see the backend DTO's own comment). */
  noShowStartedAt?: string;
  noShowDeadlineAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingListItem {
  id: string;
  /** Batch 9 — lets the cross-business customer "My Bookings" list identify/link to each
   * row's Business (via `/catalog/businesses/:businessId`). */
  businessId: string;
  reference: string;
  status: BookingStatus;
  source: BookingSource;
  primaryServiceName: string;
  serviceCount: number;
  customerName: string;
  businessClientId: string;
  staffNames: string[];
  schedule: BookingScheduleDto;
  totalCents: number;
  depositCents: number;
  currency: string;
  /** First-vs-returning display only — see booking.dto.ts's own doc comment. Meaningless when
   * `source === "MANUAL"` (always 0); branch on `source` first. */
  platformFeeCents: number;
}

export interface BookingCalendarEntry {
  id: string;
  reference: string;
  status: BookingStatus;
  source: BookingSource;
  schedule: BookingScheduleDto;
  serviceNames: string[];
  staffMembershipIds: string[];
  staffNames: string[];
  customerName: string;
  totalCents: number;
  currency: string;
}

export interface BookingListResponse {
  bookings: BookingListItem[];
  pagination: { page: number; limit: number; total: number };
}

export interface BookingServiceLineInput {
  serviceId: string;
  staffMembershipId: string;
  addonIds: string[];
  pricingInput: { hours?: number; personCount?: number };
}

export interface CreateBookingInput {
  serviceLines: BookingServiceLineInput[];
  startAt: string;
  travelAddress?: {
    city: BusinessCity;
    propertyType: string;
    area: string;
    streetName: string;
    streetNumber: string;
    floorUnit?: string;
    aptRoom?: string;
    additionalDirections?: string;
  };
  customerCity?: BusinessCity;
  notes?: string;
  idempotencyKey: string;
  /** Batch 13 — customer-only, optional Promo Code. Server validates/computes everything;
   * never trust a client-computed discount. Ignored by `createManual`. */
  promoCode?: string;
}

export interface CreateManualBookingInput extends CreateBookingInput {
  businessClientId: string;
}

// Matches api/src/modules/booking/booking-creation.service.ts BookingCreationPreview (Batch 4 —
// now a real, Customer-aware quote, never the Batch 3 "PAYMENT_INTEGRATION_PENDING" placeholder).
export interface BookingCreationPreview {
  finalizable: true;
  isFirstBooking: boolean;
  business: { id: string; name: string; timezone: string };
  schedule: BookingScheduleDto;
  fulfilment: BookingFulfilmentDto;
  serviceLines: Array<{
    serviceId: string;
    staffMembershipId: string;
    serviceSnapshot: { name: string; pricingMode: string; durationMin: number; discountPercent?: number };
    staffSnapshot?: { firstName: string; lastName?: string };
    addons: Array<{ addonId: string; name: string; priceCents: number }>;
    amountCents: number;
  }>;
  financials: BookingFinancialsDto;
  amountDueNowCents: number;
  requiresSavedCard: boolean;
  hasSavedCard: boolean;
  /** Batch 13 — present only when a valid `promoCode` was submitted and resolved server-side.
   * `depositBeforePromoCents` always equals `financials.depositCents`; `amountDueNowCents` above
   * is already the post-promo charge — never recompute the discount in the client. */
  promo?: {
    code: string;
    type: "PERCENTAGE" | "FIXED";
    value: number;
    depositBeforePromoCents: number;
    discountCents: number;
  };
}

// Matches the /bookings/finalize endpoint's two possible response bodies: a plain BookingDetail
// on success (HTTP 201), or this shape when Stripe requires additional 3DS authentication
// (HTTP 200). Both shapes happen to have a `status` field (BookingDetail's is a BookingStatus
// value like "UPCOMING"; this one is the literal "requires_action") — disambiguate via
// `"clientSecret" in result`, which only ever appears on this shape.
export interface FinalizeRequiresAction {
  status: "requires_action";
  clientSecret: string;
  paymentIntentId: string;
}
export type FinalizeBookingResult = BookingDetail | FinalizeRequiresAction;

export interface ListBookingsParams {
  status?: BookingStatus[];
  staffMembershipId?: string;
  businessClientId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export const bookingsApi = {
  // --- Business-side ---
  createManual: (businessId: string, input: CreateManualBookingInput) =>
    apiRequest<BookingDetail>({ method: "POST", url: `/businesses/${businessId}/bookings`, data: input }),

  listForBusiness: (businessId: string, params: ListBookingsParams = {}) =>
    apiRequest<BookingListResponse>({
      method: "GET",
      url: `/businesses/${businessId}/bookings`,
      params: {
        ...(params.status ? { status: params.status.join(",") } : {}),
        ...(params.staffMembershipId ? { staffMembershipId: params.staffMembershipId } : {}),
        ...(params.businessClientId ? { businessClientId: params.businessClientId } : {}),
        ...(params.fromDate ? { fromDate: params.fromDate } : {}),
        ...(params.toDate ? { toDate: params.toDate } : {}),
        ...(params.page ? { page: String(params.page) } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  getDetailForBusiness: (businessId: string, bookingId: string) =>
    apiRequest<BookingDetail>({ method: "GET", url: `/businesses/${businessId}/bookings/${bookingId}` }),

  getCalendar: (businessId: string, fromDate: string, toDate: string) =>
    apiRequest<{ bookings: BookingCalendarEntry[] }>({
      method: "GET",
      url: `/businesses/${businessId}/bookings/calendar`,
      params: { fromDate, toDate },
    }),

  /** `venuePayment` (Batch 5) — the Business's own attestation of whether the customer paid the
   * remaining `financials.balanceDueCents` at the venue (see CompleteModal). Omit entirely when
   * the flow has no venue-payment question to ask (e.g. nothing was ever due). */
  completeBooking: (
    businessId: string,
    bookingId: string,
    venuePayment?: { paid: boolean; amountCents?: number; note?: string },
  ) =>
    apiRequest<BookingDetail>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/${bookingId}/complete`,
      data: { venuePayment },
    }),

  markNoShow: (businessId: string, bookingId: string) =>
    apiRequest<BookingDetail>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/${bookingId}/no-show`,
    }),

  /** Batch 5 — the generic Waive Fee flow (applies to whichever fee is currently outstanding:
   * an active no-show timer, or a still-uncollected late-cancellation fee). `reason` is
   * required by the backend; `internalNote` is optional and never echoed back to any
   * customer-facing read. */
  waiveFee: (businessId: string, bookingId: string, reason: string, internalNote?: string) =>
    apiRequest<BookingDetail>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/${bookingId}/waive-fee`,
      data: { reason, internalNote },
    }),

  cancelNoShow: (businessId: string, bookingId: string) =>
    apiRequest<BookingDetail>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/${bookingId}/no-show/cancel`,
    }),

  cancelByBusiness: (businessId: string, bookingId: string, reason?: string) =>
    apiRequest<BookingDetail>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/${bookingId}/cancel`,
      data: { reason },
    }),

  rescheduleByOwner: (businessId: string, bookingId: string, startAt: string) =>
    apiRequest<BookingDetail>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/${bookingId}/reschedule`,
      data: { startAt },
    }),

  // --- Customer-side ---
  previewCustomerBooking: (businessId: string, input: CreateBookingInput) =>
    apiRequest<BookingCreationPreview>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/preview`,
      data: input,
    }),

  finalizeCustomerBooking: (businessId: string, input: CreateBookingInput) =>
    apiRequest<FinalizeBookingResult>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/finalize`,
      data: input,
    }),

  listForCustomer: (params: ListBookingsParams = {}) =>
    apiRequest<BookingListResponse>({
      method: "GET",
      url: "/me/bookings",
      params: {
        ...(params.status ? { status: params.status.join(",") } : {}),
        ...(params.fromDate ? { fromDate: params.fromDate } : {}),
        ...(params.toDate ? { toDate: params.toDate } : {}),
        ...(params.page ? { page: String(params.page) } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  getDetailForCustomer: (bookingId: string) =>
    apiRequest<BookingDetail>({ method: "GET", url: `/me/bookings/${bookingId}` }),

  cancelByCustomer: (bookingId: string, reason?: string) =>
    apiRequest<BookingDetail>({ method: "POST", url: `/me/bookings/${bookingId}/cancel`, data: { reason } }),

  rescheduleByCustomer: (bookingId: string, startAt: string) =>
    apiRequest<BookingDetail>({
      method: "POST",
      url: `/me/bookings/${bookingId}/reschedule`,
      data: { startAt },
    }),
};
