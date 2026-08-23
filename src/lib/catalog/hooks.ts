"use client";

import { useQuery } from "@tanstack/react-query";

import { catalogApi } from "@/lib/api/catalog";
import type { BusinessCity } from "@/lib/constants/cities";

export const catalogKeys = {
  all: ["catalog"] as const,
  business: (businessId: string) => [...catalogKeys.all, "business", businessId] as const,
  addons: (businessId: string, serviceId: string) =>
    [...catalogKeys.all, "addons", businessId, serviceId] as const,
  availability: (
    businessId: string,
    serviceId: string,
    params: { fromDate: string; toDate: string; staffMembershipId?: string; partySize?: number; customerCity?: BusinessCity },
  ) => [...catalogKeys.all, "availability", businessId, serviceId, params] as const,
};

export const useBusinessCatalogQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: catalogKeys.business(businessId ?? ""),
    queryFn: () => catalogApi.getBusinessCatalog(businessId as string),
    enabled: Boolean(businessId),
  });

export const useServiceAddonsQuery = (businessId: string | undefined, serviceId: string | undefined) =>
  useQuery({
    queryKey: catalogKeys.addons(businessId ?? "", serviceId ?? ""),
    queryFn: () => catalogApi.listServiceAddons(businessId as string, serviceId as string),
    enabled: Boolean(businessId) && Boolean(serviceId),
  });

export const useServiceAvailabilityQuery = (
  businessId: string | undefined,
  serviceId: string | undefined,
  params: {
    fromDate: string;
    toDate: string;
    staffMembershipId?: string;
    partySize?: number;
    customerCity?: BusinessCity;
  } | undefined,
) =>
  useQuery({
    queryKey: catalogKeys.availability(
      businessId ?? "",
      serviceId ?? "",
      params ?? { fromDate: "", toDate: "" },
    ),
    queryFn: () =>
      catalogApi.getServiceAvailability(businessId as string, serviceId as string, params!),
    enabled: Boolean(businessId) && Boolean(serviceId) && Boolean(params),
  });
