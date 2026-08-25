import { apiRequest } from "@/lib/api/client";
import type { DiscoveryBusinessCard } from "@/lib/api/discovery";

/** Batch 16 — Favorites. CUSTOMER-only (see api/src/modules/favorite/favorite.route.ts).
 * `customerUserId` is never sent — the backend always derives it from the authenticated actor. */

export interface FavoriteListResult {
  favorites: DiscoveryBusinessCard[];
  pagination: { page: number; limit: number; total: number };
}

export const favoriteApi = {
  add: (businessId: string) =>
    apiRequest<undefined>({ method: "POST", url: `/me/favorites/${businessId}` }),

  remove: (businessId: string) =>
    apiRequest<undefined>({ method: "DELETE", url: `/me/favorites/${businessId}` }),

  listIds: () =>
    apiRequest<{ businessIds: string[] }>({ method: "GET", url: "/me/favorites/ids" }),

  list: (pagination: { page?: number; limit?: number } = {}) =>
    apiRequest<FavoriteListResult>({
      method: "GET",
      url: "/me/favorites",
      params: {
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
      },
    }),
};
