"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { favoriteApi } from "@/lib/api/favorite";
import { useAuthStore } from "@/lib/auth/store";

export const currentFavoriteScope = () => {
  const { user, status, isInitializing, cacheEpoch } = useAuthStore.getState();
  return status === "authenticated" && !isInitializing && user?.role === "CUSTOMER" && user.status !== "SUSPENDED"
    ? `${user.id}:${cacheEpoch}` : null;
};
const useFavoriteScope = () => {
  useAuthStore(state => state.user);
  useAuthStore(state => state.status);
  useAuthStore(state => state.isInitializing);
  useAuthStore(state => state.cacheEpoch);
  return currentFavoriteScope();
};

export const favoriteKeys = {
  all: ["favorite"] as const,
  ids: (scope?: string | null) => [...favoriteKeys.all, "ids", scope] as const,
  list: (pagination: { page?: number; limit?: number }, scope?: string | null) =>
    [...favoriteKeys.all, "list", pagination, scope] as const,
};

/** The full set of the Customer's favorited businessIds — used to derive heart-fill state on any
 * card without a per-card request (see confirmed "avoid N+1" rule). Disabled entirely for a
 * logged-out visitor (Explore itself stays public — only this personalized state requires auth). */
export const useFavoriteIdsQuery = (enabled: boolean) => {
  const scope = useFavoriteScope();
  const query = useQuery({
    queryKey: favoriteKeys.ids(scope),
    queryFn: () => favoriteApi.listIds(),
    enabled: enabled && !!scope,
  });
  return { ...query, data: enabled && scope ? query.data : undefined };
};

export const useFavoritesListQuery = (pagination: { page?: number; limit?: number } = {}) => {
  const scope = useFavoriteScope();
  const query = useQuery({
    queryKey: favoriteKeys.list(pagination, scope),
    queryFn: () => favoriteApi.list(pagination),
    enabled: !!scope,
  });
  // A revisited, invalidated page must refresh before presenting its old saved-card list.
  return { ...query, isLoading: query.isLoading || query.isFetching, data: scope ? query.data : undefined };
};

const useFavoriteMutation = (action: "add" | "remove") => {
  const queryClient = useQueryClient();
  const scope = useFavoriteScope();
  return useMutation({
    mutationKey: [...favoriteKeys.all, "write", scope, action],
    mutationFn: async (businessId: string) => {
      if (!scope || scope !== currentFavoriteScope()) throw new Error("Favorites require a current Customer session.");
      await favoriteApi[action](businessId);
      return { scope, action };
    },
    onSuccess: async (result, businessId) => {
      if (result.scope !== currentFavoriteScope()) return;
      const queryKey = favoriteKeys.ids(result.scope);
      await queryClient.cancelQueries({ queryKey });
      if (result.scope !== currentFavoriteScope()) return;
      queryClient.setQueryData<{ businessIds: string[] }>(queryKey, previous => previous ? ({
        businessIds: result.action === "add" ? [...new Set([...previous.businessIds, businessId])]
          : previous.businessIds.filter(id => id !== businessId),
      }) : undefined);
      await queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
    onError: () => {
      if (scope && scope === currentFavoriteScope()) void queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
};

export const useAddFavoriteMutation = () => useFavoriteMutation("add");
export const useRemoveFavoriteMutation = () => useFavoriteMutation("remove");
