import { apiRequest } from "@/lib/api/client";
import type { BookingDetail, BookingListItem, BookingStatus } from "@/lib/api/bookings";

/** Batch 11 — the global, cross-business Super Admin Bookings read surface. Reuses the EXACT
 * SAME BookingListItem/BookingDetail shapes as every other Booking screen (lib/api/bookings.ts)
 * — the only addition is `businessName`, since a cross-business list spans many Businesses per
 * page and the Booking itself carries no business-name snapshot. */

export type SuperAdminBookingListItem = BookingListItem & { businessName: string };

export interface SuperAdminBookingTabCounts {
  all: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface SuperAdminBookingListResult {
  bookings: SuperAdminBookingListItem[];
  pagination: { page: number; limit: number; total: number };
  counts: SuperAdminBookingTabCounts;
}

export interface ListSuperAdminBookingsParams {
  businessId?: string;
  status?: BookingStatus[];
  q?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export const superAdminBookingsApi = {
  list: (params: ListSuperAdminBookingsParams = {}) =>
    apiRequest<SuperAdminBookingListResult>({
      method: "GET",
      url: "/super-admin/bookings",
      params: {
        ...(params.businessId ? { businessId: params.businessId } : {}),
        ...(params.status && params.status.length > 0 ? { status: params.status.join(",") } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.fromDate ? { fromDate: params.fromDate } : {}),
        ...(params.toDate ? { toDate: params.toDate } : {}),
        ...(params.page ? { page: String(params.page) } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  getById: (bookingId: string) =>
    apiRequest<BookingDetail>({ method: "GET", url: `/super-admin/bookings/${bookingId}` }),
};
