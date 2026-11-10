"use client";

import { useQuery } from "@tanstack/react-query";

import {
  type DiscoverySearchParams,
  type HomeSectionsParams,
  discoveryApi,
} from "@/lib/api/discovery";
import { useAuthStore } from "@/lib/auth/store";

export const discoveryKeys = {
  all: ["discovery"] as const,
  search: (params: DiscoverySearchParams) => [...discoveryKeys.all, "search", params] as const,
  homeSections: (params: HomeSectionsParams) =>
    [...discoveryKeys.all, "homeSections", params] as const,
  categories: () => [...discoveryKeys.all, "categories"] as const,
  foundingPartners: () => [...discoveryKeys.all, "foundingPartners"] as const,
};

/** P2.2.3 — results can be personalized (Recommended) for the signed-in Customer, so the key
 * carries the session identity: another account never reuses them. */
export const useDiscoverySearchQuery = (params: DiscoverySearchParams = {}) => {
  const userId = useAuthStore((state) => (state.status === "authenticated" ? state.user?.id : undefined));
  const cacheEpoch = useAuthStore((state) => state.cacheEpoch);
  const scope = userId ? `${userId}:${cacheEpoch}` : "anon";
  return useQuery({
    queryKey: [...discoveryKeys.search(params), scope] as const,
    queryFn: () => discoveryApi.search(params),
  });
};

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
