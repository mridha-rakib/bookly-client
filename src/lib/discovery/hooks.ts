"use client";

import { useQuery } from "@tanstack/react-query";

import {
  type DiscoverySearchParams,
  type HomeSectionsParams,
  discoveryApi,
} from "@/lib/api/discovery";

export const discoveryKeys = {
  all: ["discovery"] as const,
  search: (params: DiscoverySearchParams) => [...discoveryKeys.all, "search", params] as const,
  homeSections: (params: HomeSectionsParams) =>
    [...discoveryKeys.all, "homeSections", params] as const,
  categories: () => [...discoveryKeys.all, "categories"] as const,
  foundingPartners: () => [...discoveryKeys.all, "foundingPartners"] as const,
};

export const useDiscoverySearchQuery = (params: DiscoverySearchParams = {}) =>
  useQuery({
    queryKey: discoveryKeys.search(params),
    queryFn: () => discoveryApi.search(params),
  });

/** Batch 17 — the homepage's Recommended / Services near you / Popular rows in one request.
 * `enabled` gates the fetch until the caller knows whether a session exists, so a logged-in
 * Customer never briefly sees the anonymous ranking before their token is attached.
 * `authScope` (the current user id, or "anon") is folded into the cache key so the rows
 * refetch when the visitor logs in or out. */
export const useHomeSectionsQuery = (
  params: HomeSectionsParams = {},
  options: { enabled?: boolean; authScope?: string } = {},
) =>
  useQuery({
    queryKey: [...discoveryKeys.homeSections(params), options.authScope ?? "anon"] as const,
    queryFn: () => discoveryApi.homeSections(params),
    enabled: options.enabled ?? true,
    staleTime: 60 * 1000,
  });

export const useDiscoveryCategoriesQuery = () =>
  useQuery({
    queryKey: discoveryKeys.categories(),
    queryFn: () => discoveryApi.listCategories(),
    staleTime: 5 * 60 * 1000,
  });

export const useFoundingPartnersQuery = () =>
  useQuery({
    queryKey: discoveryKeys.foundingPartners(),
    queryFn: () => discoveryApi.listFoundingPartners(),
    staleTime: 5 * 60 * 1000,
  });
