import { apiRequest } from "@/lib/api/client";
import type { BookingListItem } from "@/lib/api/bookings";

/** Batch 11 — the global Customer (platform User) read surface. A "Customer" here is strictly
 * the platform User/CustomerProfile identity — never a Business's own BusinessClient row.
 * Matches api/src/modules/super-admin/super-admin-customer.service.ts's DTOs exactly. */

// Matches api/src/modules/user/user.types.ts.
export type CustomerStatus = "ACTIVE" | "DORMANT" | "SUSPENDED";

export interface SuperAdminCustomerListItem {
  id: string;
  email: string;
  status: CustomerStatus;
  firstName?: string;
  lastName?: string;
  phone?: { countryCode: string; nationalNumber: string; e164: string };
  createdAt: string;
}

export interface SuperAdminCustomerDetail extends SuperAdminCustomerListItem {
  /** Bounded, most-recent-first (50) — never the customer's full unbounded history. First-vs-
   * returning is intentionally NOT summarized into one global label: `source` +
   * `platformFeeCents` on each row is the same real, business-scoped data the customer's own
   * booking history already renders correctly per row (see lib/bookings/format.ts's
   * bookingClientBadge). */
  bookings: BookingListItem[];
  bookingsTotal: number;
}

export interface SuperAdminCustomerListResult {
  customers: SuperAdminCustomerListItem[];
  pagination: { page: number; limit: number; total: number };
}

export interface ListSuperAdminCustomersParams {
  status?: CustomerStatus;
  q?: string;
  page?: number;
  limit?: number;
}

export const superAdminCustomersApi = {
  list: (params: ListSuperAdminCustomersParams = {}) =>
    apiRequest<SuperAdminCustomerListResult>({
      method: "GET",
      url: "/super-admin/customers",
      params: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.page ? { page: String(params.page) } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  getById: (userId: string) =>
    apiRequest<SuperAdminCustomerDetail>({ method: "GET", url: `/super-admin/customers/${userId}` }),
};
