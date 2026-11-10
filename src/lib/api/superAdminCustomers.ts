import { apiRequest } from "@/lib/api/client";
import type { BookingListItem } from "@/lib/api/bookings";

/** Batch 11 — the global Customer (platform User) read surface. A "Customer" here is strictly
 * the platform User/CustomerProfile identity — never a Business's own BusinessClient row.
 * Matches api/src/modules/super-admin/super-admin-customer.service.ts's DTOs exactly. */

// Matches api/src/modules/user/user.types.ts.
export type CustomerStatus = "ACTIVE" | "DORMANT" | "SUSPENDED" | "DELETED";

export interface SuperAdminCustomerListItem {
  id: string;
  email: string;
  status: CustomerStatus;
  firstName?: string;
  lastName?: string;
  phone?: { countryCode: string; nationalNumber: string; e164: string };
  createdAt: string;
  businessCount: number;
  hasSavedCard: boolean;
  savedCard: { brand: string; last4: string } | null;
  marketingConsent: boolean;
  avatarUrl?: string;
  address?: string;
}

export interface SuperAdminCustomerDetail extends SuperAdminCustomerListItem {
  /** Server-paginated canonical Bookings; relationship classifications remain Business-specific. */
  bookings: (BookingListItem & { businessName: string; actualOnlinePaidCents: number })[];
  bookingsTotal: number;
  bookingPagination: { page: number; limit: number; total: number };
  statistics: { total: number; completed: number; noShows: number; upcoming: number };
  relationships: {
    id: string;
    businessId: string;
    businessName: string;
    classification: "FIRST" | "RETURNING";
    financialState: string | null;
    archived: boolean;
    lastBooking: { startAt: string; timezone: string } | null;
    notes: string | null;
  }[];
  relationshipPagination: { page: number; limit: number; total: number };
  /** P2.2.6 — latest account-status actions, newest first. */
  statusHistory?: CustomerStatusChange[];
  /** Historical Super Admin profile edits (P2.2.8.2, field names only), newest first. Read-only:
   * P2.2.8.2.1 policy — Super Admin never edits personal profiles. */
  profileEditHistory?: CustomerProfileEdit[];
}

/** Field names recorded by historical (P2.2.8.2) Super Admin profile edits. */
export type CustomerEditableField = "firstName" | "lastName";

export interface CustomerProfileEdit {
  action: "PROFILE_UPDATE";
  fields: CustomerEditableField[];
  actorUserId: string;
  changedAt: string;
}

/** P2.2.6 — Super Admin account-status action (api super-admin-customer-status.service.ts). */
export type CustomerStatusAction = "SUSPEND" | "REACTIVATE";

export interface CustomerStatusChange {
  action: CustomerStatusAction;
  fromStatus: CustomerStatus;
  toStatus: CustomerStatus;
  actorUserId: string;
  reason?: string;
  changedAt: string;
}

export interface CustomerStatusChangeResult {
  customerId: string;
  status: CustomerStatus;
  /** false when the Customer was already in the requested state. */
  changed: boolean;
  change?: CustomerStatusChange;
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

  getById: (userId: string, page = 1, relationshipsPage = 1) =>
    apiRequest<SuperAdminCustomerDetail>({
      method: "GET",
      url: `/super-admin/customers/${userId}`,
      params: { page, relationshipsPage },
    }),
  exportCustomers: (params: ListSuperAdminCustomersParams = {}) =>
    apiRequest<{ csv: string; filename: string }>({
      method: "GET",
      url: "/super-admin/customers/export",
      params: { status: params.status, q: params.q },
    }),
  /** P2.2.6 — server-confirmed; never applied optimistically. */
  changeStatus: (userId: string, action: CustomerStatusAction, reason?: string) =>
    apiRequest<CustomerStatusChangeResult>({
      method: "POST",
      url: `/super-admin/customers/${userId}/${action === "SUSPEND" ? "suspend" : "reactivate"}`,
      data: reason?.trim() ? { reason: reason.trim() } : {},
    }),
  exportBookings: (userId: string) =>
    apiRequest<{ csv: string; filename: string }>({
      method: "GET",
      url: `/super-admin/customers/${userId}/bookings/export`,
    }),
};
