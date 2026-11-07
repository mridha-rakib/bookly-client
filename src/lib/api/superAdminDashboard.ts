import { apiRequest } from "@/lib/api/client";
import type { BookingStatus } from "@/lib/api/bookings";
import type { BusinessStatus } from "@/lib/api/superAdminBusiness";

/** Batch 11 — ONLY the metrics safely derivable from existing real data via server-side
 * aggregation (see api/.../super-admin-dashboard.service.ts's own doc comment — no cohort
 * analysis, no forecasting, nothing invented merely because the mock UI showed it). */
export interface SuperAdminDashboardSummary {
  /** P1.9 — window applied to the PERIOD metrics (`bookings`, `platformRevenueCents`). */
  period: { from: string; to: string; isAllTime: boolean };
  /** Current state (not affected by the period). */
  businesses: Record<BusinessStatus, number> & { total: number };
  /** Current state (not affected by the period). */
  customers: { total: number };
  /** PERIOD: Bookings created in the period, by current status (all time when no period). */
  bookings: Record<BookingStatus, number> & { total: number };
  /** PERIOD: Bookly-owned net revenue in the period (all time when no period). Originally all-time Bookly-owned net revenue — same primitives as the Finance tab's own summary. */
  platformRevenueCents: number;
  /** All-time, unclaimed Business-owed balance across every Business — the SAME figure the
   * Finance tab's pending-payouts list computes. */
  pendingBusinessPayableCents: number;
  /** Batch 12 — all-time total of Business payouts already marked PAID — the SAME
   * BusinessPayoutRepository.sumPaidTotal primitive the Finance tab's own platform summary
   * (sentToBusinesses) already reuses. */
  completedPayoutsAllTimeCents: number;
}

export const superAdminDashboardApi = {
  getSummary: (period?: { fromDate: string; toDate: string }) =>
    apiRequest<SuperAdminDashboardSummary>({
      method: "GET",
      url: "/super-admin/dashboard/summary",
      ...(period ? { params: { fromDate: period.fromDate, toDate: period.toDate } } : {}),
    }),
};
