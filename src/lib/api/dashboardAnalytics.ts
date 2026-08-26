import { apiRequest } from "@/lib/api/client";

/**
 * Matches api/src/modules/dashboard-analytics/dashboard-analytics.dto.ts exactly. Replaces the
 * 100% hardcoded mock data previously in data/analyticsMockData.ts for DashboardAnalytics.tsx.
 * Owner-only on the backend (see api/src/modules/dashboard-analytics/dashboard-analytics.route.ts's
 * own comment) — same reachability as the Analytics tab itself (only ever rendered inside
 * RequireBusinessOwner on /business-dashboard).
 */

export type DashboardAnalyticsPeriod = "MONTH" | "YEAR" | "ALL";

export type DashboardAnalyticsBookingStatus =
  | "UPCOMING"
  | "COMPLETED"
  | "PENDING"
  | "NO_SHOW_CHARGED"
  | "NO_SHOW_WAIVED"
  | "NO_SHOW_CANCELLED"
  | "CANCELLED_BY_CUSTOMER"
  | "CANCELLED_BY_BUSINESS"
  | "LATE_CANCELLATION";

export type DashboardAnalyticsDayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export interface DashboardAnalyticsTopService {
  serviceId: string;
  name: string;
  count: number;
}

export interface DashboardAnalyticsStatusCount {
  status: DashboardAnalyticsBookingStatus;
  count: number;
}

export interface DashboardAnalyticsWeekdayCount {
  dayOfWeek: DashboardAnalyticsDayOfWeek;
  count: number;
}

export interface DashboardAnalytics {
  period: DashboardAnalyticsPeriod;
  currency: "EUR";
  range: { from: string; to: string };

  totalBookingsCount: number;
  totalBookingsChangePercent: number | null;

  newCustomersCount: number;
  returningCustomersCount: number;

  completionRate: number;
  noShowRate: number;
  noShowCount: number;
  noShowChargedCount: number;

  avgBookingValueCents: number;
  avgBookingValueChangeCents: number | null;

  revenueRecoveredCents: number;

  topServices: DashboardAnalyticsTopService[];
  bookingsByStatus: DashboardAnalyticsStatusCount[];
  busiestDays: DashboardAnalyticsWeekdayCount[];
}

export const dashboardAnalyticsApi = {
  get: (businessId: string, period: DashboardAnalyticsPeriod) =>
    apiRequest<DashboardAnalytics>({
      method: "GET",
      url: `/businesses/${businessId}/dashboard/analytics`,
      params: { period },
    }),
};
