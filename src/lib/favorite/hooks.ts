"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { favoriteApi } from "@/lib/api/favorite";

export const favoriteKeys = {
  all: ["favorite"] as const,
  ids: () => [...favoriteKeys.all, "ids"] as const,
  list: (pagination: { page?: number; limit?: number }) =>
    [...favoriteKeys.all, "list", pagination] as const,
};

/** The full set of the Customer's favorited businessIds — used to derive heart-fill state on any
 * card without a per-card request (see confirmed "avoid N+1" rule). Disabled entirely for a
 * logged-out visitor (Explore itself stays public — only this personalized state requires auth). */
export const useFavoriteIdsQuery = (enabled: boolean) =>
  useQuery({
    queryKey: favoriteKeys.ids(),
    queryFn: () => favoriteApi.listIds(),
    enabled,
  });

export const useFavoritesListQuery = (pagination: { page?: number; limit?: number } = {}) =>
  useQuery({
    queryKey: favoriteKeys.list(pagination),
    queryFn: () => favoriteApi.list(pagination),
  });

export const useAddFavoriteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (businessId: string) => favoriteApi.add(businessId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
};

export const useRemoveFavoriteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (businessId: string) => favoriteApi.remove(businessId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
};
