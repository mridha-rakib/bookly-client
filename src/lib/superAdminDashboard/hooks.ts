"use client";

import { useQuery } from "@tanstack/react-query";

import { superAdminDashboardApi } from "@/lib/api/superAdminDashboard";

export const superAdminDashboardKeys = {
  all: ["superAdminDashboard"] as const,
  summary: () => [...superAdminDashboardKeys.all, "summary"] as const,
};

export const useSuperAdminDashboardSummaryQuery = () =>
  useQuery({
    queryKey: superAdminDashboardKeys.summary(),
    queryFn: () => superAdminDashboardApi.getSummary(),
  });
