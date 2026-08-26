"use client";

import { useQuery } from "@tanstack/react-query";

import { dashboardAnalyticsApi, type DashboardAnalyticsPeriod } from "@/lib/api/dashboardAnalytics";

export const dashboardAnalyticsKeys = {
  all: ["dashboardAnalytics"] as const,
  detail: (businessId: string, period: DashboardAnalyticsPeriod) =>
    [...dashboardAnalyticsKeys.all, businessId, period] as const,
};

export const useDashboardAnalyticsQuery = (
  businessId: string | undefined,
  period: DashboardAnalyticsPeriod,
) =>
  useQuery({
    queryKey: dashboardAnalyticsKeys.detail(businessId ?? "", period),
    queryFn: () => dashboardAnalyticsApi.get(businessId as string, period),
    enabled: Boolean(businessId),
  });
