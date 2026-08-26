import { apiRequest } from "@/lib/api/client";

/**
 * Matches api/src/modules/dashboard-overview/dashboard-overview.dto.ts exactly. Replaces the
 * mock data previously in utils/dashboardMockData.ts for DashboardOverview/SupervisorOverview/
 * StaffOverview. Owner/Supervisor get `scope: "FULL"` (financials populated); Staff get
 * `scope: "STAFF_SCOPED"` (own bookings only, financials always null).
 */

export type DashboardOverviewScope = "FULL" | "STAFF_SCOPED";
export type DashboardOverviewLeadType = "NEW_CUSTOMER" | "RETURNING" | "MANUAL";

export interface DashboardOverviewScheduleRow {
  bookingId: string;
  bookingReference: string;
  time: string;
  status: string;
  customerName: string;
  serviceName: string;
  totalPaymentCents: number;
  platformFeeCents: number;
  remainingFeeCents: number;
  staffName: string;
  leadType: DashboardOverviewLeadType;
}

export interface DashboardOverviewTimelineEntry {
  bookingId: string;
  time: string;
  customerName: string;
  detail: string;
  durationMin: number;
}

export type DashboardOverviewActivityType =
  | "PLATFORM_FEE"
  | "DEPOSIT"
  | "PROCESSING_FEE"
  | "PROMO_SUBSIDY"
  | "CANCELLATION_FEE"
  | "NO_SHOW_FEE"
  | "REFUND";

export interface DashboardOverviewActivityEntry {
  id: string;
  type: DashboardOverviewActivityType;
  status: "SUCCEEDED" | "FAILED" | "WAIVED" | "PENDING";
  amountCents: number;
  currency: "EUR";
  customerName: string;
  serviceName?: string;
  bookingReference?: string;
  createdAt: string;
}

export interface DashboardOverviewFinancials {
  payAtVenueDueCents: number;
  noShowMonthCount: number;
  noShowMonthChargedCents: number;
  monthlyRevenueCents: number;
  recentActivity: DashboardOverviewActivityEntry[];
}

export interface DashboardOverview {
  scope: DashboardOverviewScope;
  currency: "EUR";
  todayDateStr: string;
  todayBookingsCount: number;
  todayRemainingCount: number;
  schedule: DashboardOverviewScheduleRow[];
  timeline: DashboardOverviewTimelineEntry[];
  financials: DashboardOverviewFinancials | null;
}

export const dashboardOverviewApi = {
  get: (businessId: string) =>
    apiRequest<DashboardOverview>({
      method: "GET",
      url: `/businesses/${businessId}/dashboard/overview`,
    }),
};
