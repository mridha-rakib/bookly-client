"use client";

import { useQuery } from "@tanstack/react-query";

import { dashboardOverviewApi, type OverviewRange } from "@/lib/api/dashboardOverview";
import { useAuthStore } from "@/lib/auth/store";

/** Preset ranges carry no dates (the API resolves them from the Business-local "today");
 * Custom keeps exactly its two inclusive dates. Equal selections therefore share one cache key. */
export const normalizeOverviewRange = (range?: OverviewRange): OverviewRange | undefined =>
  !range
    ? undefined
    : range.range === "Custom"
      ? { range: "Custom", fromDate: range.fromDate, toDate: range.toDate }
      : { range: range.range };

export const dashboardOverviewKeys = {
  all: ["dashboardOverview"] as const,
  // Booking/settings mutations invalidate this `[all, businessId]` prefix (lib/bookings/dashboard-cache.ts).
  detail: (businessId: string) => [...dashboardOverviewKeys.all, businessId] as const,
  range: (businessId: string, scope: string | null, range?: OverviewRange) =>
    [...dashboardOverviewKeys.detail(businessId), scope, normalizeOverviewRange(range) ?? null] as const,
};

const useOverviewScope = (): string | null => {
  const userId = useAuthStore((state) => state.user?.id);
  const status = useAuthStore((state) => state.status);
  const cacheEpoch = useAuthStore((state) => state.cacheEpoch);
  return status === "authenticated" && userId ? `${userId}:${cacheEpoch}` : null;
};

/** Keyed by Business, signed-in identity and normalized range: a response for an earlier range,
 * Business or account can never be shown for the current selection. */
export const useDashboardOverviewQuery = (businessId: string | undefined, range?: OverviewRange) => {
  const scope = useOverviewScope();
  const normalized = normalizeOverviewRange(range);
  const query = useQuery({
    queryKey: dashboardOverviewKeys.range(businessId ?? "", scope, normalized),
    queryFn: () => dashboardOverviewApi.get(businessId as string, normalized),
    enabled: Boolean(businessId && scope),
  });
  return { ...query, data: scope ? query.data : undefined };
};
