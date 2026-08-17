"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { bookingSettingsApi } from "@/lib/api/bookingSettings";
import {
  servicesApi,
  type ListServicesParams,
  type ServiceInput,
} from "@/lib/api/services";

export const serviceKeys = {
  all: ["services"] as const,
  list: (businessId: string, params: ListServicesParams) =>
    [...serviceKeys.all, "list", businessId, params] as const,
  detail: (businessId: string, serviceId: string) =>
    [...serviceKeys.all, "detail", businessId, serviceId] as const,
  categories: (businessId: string) => [...serviceKeys.all, "categories", businessId] as const,
};

export const bookingSettingsKeys = {
  all: ["booking-settings"] as const,
  detail: (businessId: string) => [...bookingSettingsKeys.all, businessId] as const,
};

export const useServicesQuery = (
  businessId: string | undefined,
  params: ListServicesParams = {},
) =>
  useQuery({
    queryKey: serviceKeys.list(businessId ?? "", params),
    queryFn: () => servicesApi.listServices(businessId as string, params),
    enabled: Boolean(businessId),
  });

export const useServiceQuery = (businessId: string | undefined, serviceId: string | undefined) =>
  useQuery({
    queryKey: serviceKeys.detail(businessId ?? "", serviceId ?? ""),
    queryFn: () => servicesApi.getService(businessId as string, serviceId as string),
    enabled: Boolean(businessId) && Boolean(serviceId),
  });

// All Service list/detail caches for one business are invalidated together on any mutation —
// a Service mutation can move a row between ACTIVE/INACTIVE/ARCHIVED buckets, so any narrower
// invalidation would risk leaving a stale list cached under a different filter combination.
const invalidateServiceCaches = (queryClient: ReturnType<typeof useQueryClient>, businessId: string) => {
  void queryClient.invalidateQueries({ queryKey: [...serviceKeys.all, "list", businessId] });
  void queryClient.invalidateQueries({ queryKey: [...serviceKeys.all, "detail", businessId] });
};

export const useCreateServiceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, input }: { businessId: string; input: ServiceInput }) =>
      servicesApi.createService(businessId, input),
    onSuccess: (_service, variables) => {
      invalidateServiceCaches(queryClient, variables.businessId);
    },
  });
};

export const useUpdateServiceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      serviceId,
      input,
    }: {
      businessId: string;
      serviceId: string;
      input: ServiceInput;
    }) => servicesApi.updateService(businessId, serviceId, input),
    onSuccess: (_service, variables) => {
      invalidateServiceCaches(queryClient, variables.businessId);
    },
  });
};

export const useUpdateServiceStatusMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      serviceId,
      status,
    }: {
      businessId: string;
      serviceId: string;
      status: "ACTIVE" | "INACTIVE";
    }) => servicesApi.updateServiceStatus(businessId, serviceId, status),
    onSuccess: (_service, variables) => {
      invalidateServiceCaches(queryClient, variables.businessId);
    },
  });
};

export const useArchiveServiceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, serviceId }: { businessId: string; serviceId: string }) =>
      servicesApi.archiveService(businessId, serviceId),
    onSuccess: (_result, variables) => {
      invalidateServiceCaches(queryClient, variables.businessId);
    },
  });
};

export const useRestoreServiceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      serviceId,
      status,
    }: {
      businessId: string;
      serviceId: string;
      status: "ACTIVE" | "INACTIVE";
    }) => servicesApi.restoreService(businessId, serviceId, status),
    onSuccess: (_service, variables) => {
      invalidateServiceCaches(queryClient, variables.businessId);
    },
  });
};

export const useServiceCategoriesQuery = (
  businessId: string | undefined,
  includeInactive = false,
) =>
  useQuery({
    queryKey: [...serviceKeys.categories(businessId ?? ""), includeInactive] as const,
    queryFn: () => servicesApi.listCategories(businessId as string, includeInactive),
    enabled: Boolean(businessId),
  });

export const useCreateServiceCategoryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, name }: { businessId: string; name: string }) =>
      servicesApi.createCategory(businessId, name),
    onSuccess: (_category, variables) => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.categories(variables.businessId) });
    },
  });
};

export const useUpdateServiceCategoryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      categoryId,
      input,
    }: {
      businessId: string;
      categoryId: string;
      input: { name?: string; active?: boolean };
    }) => servicesApi.updateCategory(businessId, categoryId, input),
    onSuccess: (_category, variables) => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.categories(variables.businessId) });
    },
  });
};

export const useBookingSettingsQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: bookingSettingsKeys.detail(businessId ?? ""),
    queryFn: () => bookingSettingsApi.getBookingSettings(businessId as string),
    enabled: Boolean(businessId),
  });

export const useUpdateBookingSettingsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      gapEliminationEnabled,
    }: {
      businessId: string;
      gapEliminationEnabled: boolean;
    }) => bookingSettingsApi.updateBookingSettings(businessId, gapEliminationEnabled),
    onSuccess: (settings) => {
      queryClient.setQueryData(bookingSettingsKeys.detail(settings.businessId), settings);
    },
  });
};
