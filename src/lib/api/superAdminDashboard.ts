import { apiRequest } from "@/lib/api/client";
import type { BookingStatus } from "@/lib/api/bookings";
import type { BusinessStatus } from "@/lib/api/superAdminBusiness";

/** Batch 11 — ONLY the metrics safely derivable from existing real data via server-side
 * aggregation (see api/.../super-admin-dashboard.service.ts's own doc comment — no cohort
 * analysis, no forecasting, nothing invented merely because the mock UI showed it). */
export interface SuperAdminDashboardSummary {
  businesses: Record<BusinessStatus, number> & { total: number };
  customers: { total: number };
  bookings: Record<BookingStatus, number> & { total: number };
  /** All-time Bookly-owned net revenue — same primitives as the Finance tab's own summary. */
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
  getSummary: () =>
    apiRequest<SuperAdminDashboardSummary>({ method: "GET", url: "/super-admin/dashboard/summary" }),
};
