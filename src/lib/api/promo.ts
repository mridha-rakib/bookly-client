import { apiRequest } from "@/lib/api/client";

/**
 * Batch 13 — Super Admin Promo Code CRUD + usage log + "Discounted money" finance card.
 * SUPER_ADMIN-only on the backend (see api/src/modules/super-admin/super-admin.route.ts). Matches
 * api/src/modules/promo/promo.dto.ts and super-admin-promo.service.ts's DTOs exactly.
 */

export type PromoType = "PERCENTAGE" | "FIXED";
export type PromoScope = "ALL_FIRST_BOOKINGS" | "ALL_BOOKINGS" | "SELECTED_BUSINESSES";
export type PromoDisplayStatus = "ACTIVE" | "EXPIRED" | "DEACTIVATED";
export type PromoStoredStatus = "ACTIVE" | "DEACTIVATED";

export interface PromoListItem {
  id: string;
  code: string;
  type: PromoType;
  value: number;
  scope: PromoScope;
  businessIds: string[];
  startAt?: string;
  expiresAt: string;
  status: PromoDisplayStatus;
  totalUsageLimit?: number;
  perUserUsageLimit?: number;
  redeemedCount: number;
  createdAt: string;
}

export interface PromoDetail extends PromoListItem {
  businesses: Array<{ id: string; name: string }>;
}

export interface PromoListResult {
  promos: PromoListItem[];
  pagination: { page: number; limit: number; total: number };
}

export interface PromoRedemptionRow {
  id: string;
  promoId: string;
  code: string;
  customerEmail: string;
  businessId: string;
  businessName: string;
  depositBeforePromoCents: number;
  promoDiscountCents: number;
  customerChargeNowCents: number;
  isFirstBooking: boolean;
  redeemedAt: string;
}

export interface PromoRedemptionListResult {
  redemptions: PromoRedemptionRow[];
  pagination: { page: number; limit: number; total: number };
}

export interface PromoDiscountedMoney {
  totalCents: number;
  count: number;
  period: { from: string; to: string };
}

export interface ListPromosParams {
  status?: PromoStoredStatus;
  q?: string;
  page?: number;
  limit?: number;
}

export interface PromoWriteInput {
  code: string;
  type: PromoType;
  value: number;
  scope: PromoScope;
  businessIds: string[];
  startAt?: string;
  expiresAt: string;
  totalUsageLimit?: number;
  perUserUsageLimit?: number;
}

export type PromoUpdateInput = Partial<PromoWriteInput>;

export const promoApi = {
  list: (params: ListPromosParams = {}) =>
    apiRequest<PromoListResult>({
      method: "GET",
      url: "/super-admin/promo-codes",
      params: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.page ? { page: String(params.page) } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  getById: (promoId: string) =>
    apiRequest<PromoDetail>({ method: "GET", url: `/super-admin/promo-codes/${promoId}` }),

  create: (input: PromoWriteInput) =>
    apiRequest<PromoDetail>({ method: "POST", url: "/super-admin/promo-codes", data: input }),

  update: (promoId: string, input: PromoUpdateInput) =>
    apiRequest<PromoDetail>({
      method: "PATCH",
      url: `/super-admin/promo-codes/${promoId}`,
      data: input,
    }),

  setStatus: (promoId: string, status: PromoStoredStatus) =>
    apiRequest<PromoDetail>({
      method: "POST",
      url: `/super-admin/promo-codes/${promoId}/status`,
      data: { status },
    }),

  remove: (promoId: string) =>
    apiRequest<{ outcome: "deleted" | "deactivated" }>({
      method: "DELETE",
      url: `/super-admin/promo-codes/${promoId}`,
    }),

  listRedemptions: (promoId: string, pagination: { page?: number; limit?: number } = {}) =>
    apiRequest<PromoRedemptionListResult>({
      method: "GET",
      url: `/super-admin/promo-codes/${promoId}/redemptions`,
      params: {
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
      },
    }),

  getDiscountedMoney: (period: { from: string; to: string }) =>
    apiRequest<PromoDiscountedMoney>({
      method: "GET",
      url: "/super-admin/finance/promo-discounts",
      params: period,
    }),
};
