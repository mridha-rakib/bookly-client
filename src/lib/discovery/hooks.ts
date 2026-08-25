"use client";

import { useQuery } from "@tanstack/react-query";

import { type DiscoverySearchParams, discoveryApi } from "@/lib/api/discovery";

export const discoveryKeys = {
  all: ["discovery"] as const,
  search: (params: DiscoverySearchParams) => [...discoveryKeys.all, "search", params] as const,
  categories: () => [...discoveryKeys.all, "categories"] as const,
};

export const useDiscoverySearchQuery = (params: DiscoverySearchParams = {}) =>
  useQuery({
    queryKey: discoveryKeys.search(params),
    queryFn: () => discoveryApi.search(params),
  });

export const useDiscoveryCategoriesQuery = () =>
  useQuery({
    queryKey: discoveryKeys.categories(),
    queryFn: () => discoveryApi.listCategories(),
    staleTime: 5 * 60 * 1000,
  });
