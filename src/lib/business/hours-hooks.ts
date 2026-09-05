"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  businessHoursApi,
  type BusinessHoursDay,
} from "@/lib/api/business-hours";

export const businessHoursKeys = {
  detail: (businessId: string) => ["businessHours", businessId] as const,
};

export const useBusinessHoursQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: businessHoursKeys.detail(businessId ?? ""),
    queryFn: () => businessHoursApi.get(businessId as string),
    enabled: Boolean(businessId),
  });

// businessId is passed at mutate-time (not hook-call time) — matches
// useUpdateBusinessTravelSettingsMutation, the sibling mutation this is always called alongside
// in DashboardCreateBusiness.tsx's sequential save flow.
export const useUpdateBusinessHoursMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, days }: { businessId: string; days: BusinessHoursDay[] }) =>
      businessHoursApi.put(businessId, { days }),
    onSuccess: (hours) => {
      queryClient.setQueryData(businessHoursKeys.detail(hours.businessId), hours);
    },
  });
};
