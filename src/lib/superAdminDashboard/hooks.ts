"use client";

import { useQuery } from "@tanstack/react-query";

import { superAdminDashboardApi } from "@/lib/api/superAdminDashboard";
import { useAuthStore } from "@/lib/auth/store";
import type { OverviewPeriodParams } from "@/lib/superAdminDashboard/period";

/** P1.9 — keys carry the Super Admin identity scope and the exact period, so an earlier period's
 * (or another session's) summary can never be shown for the current selection. */
export const superAdminDashboardKeys = {
  all: ["superAdminDashboard"] as const,
  summary: (scope?: string | null, period?: OverviewPeriodParams, filters: { city?: string; day?: string } = {}) =>
    [
      ...superAdminDashboardKeys.all,
      "summary",
      scope ?? null,
      period ?? "ALL_TIME",
      { city: filters.city ?? null, day: filters.day ?? null },
    ] as const,
};

export const useSuperAdminScope = (): string | null => {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const cacheEpoch = useAuthStore((state) => state.cacheEpoch);
  return status === "authenticated" && user?.role === "SUPER_ADMIN" ? `${user.id}:${cacheEpoch}` : null;
};

export const useSuperAdminDashboardSummaryQuery = (
  period?: OverviewPeriodParams,
  filters: { city?: string; day?: string } = {},
) => {
  const scope = useSuperAdminScope();
  const query = useQuery({
    queryKey: superAdminDashboardKeys.summary(scope, period, filters),
    queryFn: () => superAdminDashboardApi.getSummary(period, filters),
    enabled: Boolean(scope),
  });
  return { ...query, data: scope ? query.data : undefined };
};
