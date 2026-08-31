"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  platformSettingsApi,
  type UpdatePlatformSettingsInput,
} from "@/lib/api/platform-settings";

export const platformSettingsKeys = {
  root: ["platformSettings"] as const,
  publicBookingConfig: ["platformSettings", "publicBookingConfig"] as const,
};

export const usePlatformSettingsQuery = () =>
  useQuery({
    queryKey: platformSettingsKeys.root,
    queryFn: () => platformSettingsApi.get(),
  });

export const useUpdatePlatformSettingsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePlatformSettingsInput) => platformSettingsApi.update(input),
    onSuccess: (data) => {
      queryClient.setQueryData(platformSettingsKeys.root, data);
      // The public booking-config mirrors maxServicesPerBooking — keep it fresh too.
      queryClient.invalidateQueries({ queryKey: platformSettingsKeys.publicBookingConfig });
    },
  });
};

/**
 * Anonymous booking limit for the customer / business booking selectors. The backend still
 * validates independently on every create — this is a UX guard only.
 */
export const usePublicBookingConfigQuery = () =>
  useQuery({
    queryKey: platformSettingsKeys.publicBookingConfig,
    queryFn: () => platformSettingsApi.getPublicBookingConfig(),
    staleTime: 5 * 60_000,
  });
