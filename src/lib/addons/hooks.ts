"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { addonsApi, type AddonInput, type ListAddonsParams } from "@/lib/api/addons";

export const addonKeys = {
  all: ["addons"] as const,
  list: (businessId: string, params: ListAddonsParams) =>
    [...addonKeys.all, "list", businessId, params] as const,
  detail: (businessId: string, addonId: string) =>
    [...addonKeys.all, "detail", businessId, addonId] as const,
  forService: (businessId: string, serviceId: string) =>
    [...addonKeys.all, "for-service", businessId, serviceId] as const,
};

export const useAddonsQuery = (businessId: string | undefined, params: ListAddonsParams = {}) =>
  useQuery({
    queryKey: addonKeys.list(businessId ?? "", params),
    queryFn: () => addonsApi.listAddons(businessId as string, params),
    enabled: Boolean(businessId),
  });

export const useAddonQuery = (businessId: string | undefined, addonId: string | undefined) =>
  useQuery({
    queryKey: addonKeys.detail(businessId ?? "", addonId ?? ""),
    queryFn: () => addonsApi.getAddon(businessId as string, addonId as string),
    enabled: Boolean(businessId) && Boolean(addonId),
  });

/** Backs Service Edit/View's real "Assigned Add-ons" section. */
export const useAddonsForServiceQuery = (
  businessId: string | undefined,
  serviceId: string | undefined,
) =>
  useQuery({
    queryKey: addonKeys.forService(businessId ?? "", serviceId ?? ""),
    queryFn: () => addonsApi.listAddonsForService(businessId as string, serviceId as string),
    enabled: Boolean(businessId) && Boolean(serviceId),
  });

// All Add-on list/detail/for-service caches for one business are invalidated together on any
// mutation — an Add-on mutation can move a row between DRAFT/ACTIVE/INACTIVE/ARCHIVED buckets
// and change which Services it's attached to, so a narrower invalidation risks a stale cache.
const invalidateAddonCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  businessId: string,
) => {
  void queryClient.invalidateQueries({ queryKey: [...addonKeys.all, "list", businessId] });
  void queryClient.invalidateQueries({ queryKey: [...addonKeys.all, "detail", businessId] });
  void queryClient.invalidateQueries({ queryKey: [...addonKeys.all, "for-service", businessId] });
};

export const useCreateAddonMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, input }: { businessId: string; input: AddonInput }) =>
      addonsApi.createAddon(businessId, input),
    onSuccess: (_addon, variables) => {
      invalidateAddonCaches(queryClient, variables.businessId);
    },
  });
};

export const useUpdateAddonMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      addonId,
      input,
    }: {
      businessId: string;
      addonId: string;
      input: AddonInput;
    }) => addonsApi.updateAddon(businessId, addonId, input),
    onSuccess: (_addon, variables) => {
      invalidateAddonCaches(queryClient, variables.businessId);
    },
  });
};

export const useUpdateAddonStatusMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      addonId,
      status,
    }: {
      businessId: string;
      addonId: string;
      status: "ACTIVE" | "INACTIVE";
    }) => addonsApi.updateAddonStatus(businessId, addonId, status),
    onSuccess: (_addon, variables) => {
      invalidateAddonCaches(queryClient, variables.businessId);
    },
  });
};

export const useArchiveAddonMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, addonId }: { businessId: string; addonId: string }) =>
      addonsApi.archiveAddon(businessId, addonId),
    onSuccess: (_result, variables) => {
      invalidateAddonCaches(queryClient, variables.businessId);
    },
  });
};

export const useRestoreAddonMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      addonId,
      status,
    }: {
      businessId: string;
      addonId: string;
      status: "ACTIVE" | "INACTIVE";
    }) => addonsApi.restoreAddon(businessId, addonId, status),
    onSuccess: (_addon, variables) => {
      invalidateAddonCaches(queryClient, variables.businessId);
    },
  });
};
