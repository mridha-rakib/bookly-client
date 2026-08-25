import { apiRequest } from "@/lib/api/client";
import type { BookingStatus } from "@/lib/api/bookings";
import type { BusinessStatus } from "@/lib/api/superAdminBusiness";

/** Batch 12 — Super Admin Dashboard + Analytics real backend surface. Matches
 * api/src/modules/super-admin/super-admin-*-analytics.service.ts DTOs exactly. */

export interface AnalyticsPeriodParams {
  fromDate?: string;
  toDate?: string;
}

export interface MonthlySeriesPoint {
  year: number;
  month: number;
  count: number;
}

export interface SuperAdminBookingAnalytics {
  period: { from: string; to: string };
  totalCount: number;
  statusCounts: Record<BookingStatus, number>;
  monthlySeries: MonthlySeriesPoint[];
  clientTypeSplit: { manual: number; newBooking: number; returning: number };
  fulfilmentSplit: { premises: number; mobile: number };
  platformRevenueCents: number;
  categoryBreakdownUnsupported: true;
}

export interface SuperAdminTopBusinessRow {
  businessId: string;
  name: string;
  city: string;
  bookingsCount: number;
  newCustomersCount: number;
  bookyRevenueCents: number;
  noShowRate: number;
  returnRate: number | null;
}

export interface SuperAdminBusinessAnalytics {
  period: { from: string; to: string };
  createdOverTime: MonthlySeriesPoint[];
  statusCounts: Record<BusinessStatus, number> & { total: number };
  topByBookings: SuperAdminTopBusinessRow[];
  topByNewCustomers: SuperAdminTopBusinessRow[];
  topByRevenue: SuperAdminTopBusinessRow[];
}

export interface SuperAdminCustomerAnalytics {
  period: { from: string; to: string };
  registeredOverTime: MonthlySeriesPoint[];
  registeredTotal: number;
  activatedCount: number;
  retainedCount: number;
  dormantCount: number;
}

export interface SuperAdminTopServiceRow {
  serviceId: string;
  name: string;
  businessId: string;
  businessName: string;
  count: number;
}

export interface SuperAdminTopServicesResult {
  period: { from: string; to: string };
  services: SuperAdminTopServiceRow[];
}

export interface SuperAdminCityCoverageRow {
  city: string;
  premisesCount: number;
  mobileCount: number;
  approvedCount: number;
}

export interface SuperAdminCityCoverageResult {
  cities: SuperAdminCityCoverageRow[];
}

export type SuperAdminActivityEventType =
  | "BUSINESS_APPLICATION"
  | "BUSINESS_STATUS_CHANGED"
  | "CUSTOMER_REGISTERED"
  | "PAYOUT_PAID";

export interface SuperAdminActivityEvent {
  type: SuperAdminActivityEventType;
  occurredAt: string;
  summary: string;
}

export interface SuperAdminRecentActivityResult {
  activities: SuperAdminActivityEvent[];
}

export const superAdminAnalyticsApi = {
  getBookingAnalytics: (period: AnalyticsPeriodParams = {}) =>
    apiRequest<SuperAdminBookingAnalytics>({
      method: "GET",
      url: "/super-admin/analytics/bookings",
      params: period,
    }),

  getBusinessAnalytics: (period: AnalyticsPeriodParams = {}) =>
    apiRequest<SuperAdminBusinessAnalytics>({
      method: "GET",
      url: "/super-admin/analytics/businesses",
      params: period,
    }),

  getCustomerAnalytics: (period: AnalyticsPeriodParams = {}) =>
    apiRequest<SuperAdminCustomerAnalytics>({
      method: "GET",
      url: "/super-admin/analytics/customers",
      params: period,
    }),

  getTopServices: (period: AnalyticsPeriodParams & { limit?: number } = {}) =>
    apiRequest<SuperAdminTopServicesResult>({
      method: "GET",
      url: "/super-admin/analytics/top-services",
      params: {
        ...(period.fromDate ? { fromDate: period.fromDate } : {}),
        ...(period.toDate ? { toDate: period.toDate } : {}),
        ...(period.limit ? { limit: String(period.limit) } : {}),
      },
    }),

  getCityCoverage: () =>
    apiRequest<SuperAdminCityCoverageResult>({ method: "GET", url: "/super-admin/analytics/cities" }),

  getRecentActivity: (limit?: number) =>
    apiRequest<SuperAdminRecentActivityResult>({
      method: "GET",
      url: "/super-admin/analytics/recent-activity",
      params: { ...(limit ? { limit: String(limit) } : {}) },
    }),
};
