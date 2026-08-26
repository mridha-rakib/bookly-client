"use client";

import { useQuery } from "@tanstack/react-query";

import { dashboardOverviewApi } from "@/lib/api/dashboardOverview";

export const dashboardOverviewKeys = {
  all: ["dashboardOverview"] as const,
  detail: (businessId: string) => [...dashboardOverviewKeys.all, businessId] as const,
};

export const useDashboardOverviewQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: dashboardOverviewKeys.detail(businessId ?? ""),
    queryFn: () => dashboardOverviewApi.get(businessId as string),
    enabled: Boolean(businessId),
  });
