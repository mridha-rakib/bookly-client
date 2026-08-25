import { apiRequest } from "@/lib/api/client";

/**
 * Batch 11 — the first real (non-Finance) Super Admin backend surface. Matches
 * api/src/modules/super-admin/super-admin-business.service.ts's DTOs exactly. SUPER_ADMIN-only
 * on the backend (super-admin.route.ts).
 */

// Matches api/src/modules/business/business.types.ts.
export type BusinessStatus = "PENDING" | "APPROVED" | "WARNING" | "SUSPENDED";
export type BusinessVisitType = "AT_BUSINESS_LOCATION" | "TRAVEL_TO_CUSTOMER";

export interface SuperAdminBusinessListItem {
  id: string;
  name: string;
  category: string;
  visitType: BusinessVisitType;
  city: string;
  status: BusinessStatus;
  /** No review/rating system exists anywhere in this codebase — always null, never fabricated. */
  rating: null;
  reviewsCount: null;
  bookingsCount: number;
  memberSince: string;
}

export interface SuperAdminBusinessListResult {
  businesses: SuperAdminBusinessListItem[];
  pagination: { page: number; limit: number; total: number };
  counts: Record<BusinessStatus, number> & { ALL: number };
}

export interface SuperAdminBusinessStatusHistoryEntry {
  fromStatus: BusinessStatus;
  toStatus: BusinessStatus;
  actorUserId: string;
  actorEmail?: string;
  reason?: string;
  changedAt: string;
}

export interface SuperAdminBusinessDetail {
  id: string;
  name: string;
  ownerName: string;
  status: BusinessStatus;
  visitType: BusinessVisitType;
  timezone: string;
  phone: { countryCode: string; nationalNumber: string; e164: string };
  address: {
    city: string;
    area: string;
    streetName: string;
    streetNumber: string;
    floorUnit?: string;
    aptRoom?: string;
  };
  briefDescription: string;
  category: string;
  subcategories: string[];
  owner: { id: string; email: string; status: string };
  bookingsCount: number;
  statusHistory: SuperAdminBusinessStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ListBusinessesParams {
  status?: BusinessStatus;
  visitType?: BusinessVisitType;
  city?: string;
  category?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export const superAdminBusinessApi = {
  list: (params: ListBusinessesParams = {}) =>
    apiRequest<SuperAdminBusinessListResult>({
      method: "GET",
      url: "/super-admin/businesses",
      params: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.visitType ? { visitType: params.visitType } : {}),
        ...(params.city ? { city: params.city } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.page ? { page: String(params.page) } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  getById: (businessId: string) =>
    apiRequest<SuperAdminBusinessDetail>({ method: "GET", url: `/super-admin/businesses/${businessId}` }),

  approve: (businessId: string) =>
    apiRequest<SuperAdminBusinessDetail>({
      method: "POST",
      url: `/super-admin/businesses/${businessId}/approve`,
    }),

  reject: (businessId: string, reason?: string) =>
    apiRequest<SuperAdminBusinessDetail>({
      method: "POST",
      url: `/super-admin/businesses/${businessId}/reject`,
      data: { reason },
    }),

  suspend: (businessId: string, reason?: string) =>
    apiRequest<SuperAdminBusinessDetail>({
      method: "POST",
      url: `/super-admin/businesses/${businessId}/suspend`,
      data: { reason },
    }),
};
