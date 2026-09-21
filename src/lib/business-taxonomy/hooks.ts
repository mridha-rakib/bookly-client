"use client";

import { useQuery } from "@tanstack/react-query";

import {
  type BusinessTaxonomyCategory,
  platformSettingsApi,
} from "@/lib/api/platform-settings";

export const businessTaxonomyKeys = {
  root: ["businessTaxonomy"] as const,
};

/**
 * THE one fetch/query abstraction for the canonical Business Owner registration category +
 * subcategory taxonomy (GET /platform/business-taxonomy). Every consumer — the registration
 * category picker, the list-your-business marketing page, anywhere else a business category
 * needs to be rendered — should use this instead of keeping its own hardcoded array.
 *
 * Static, platform-owned, read-only data (no admin CRUD exists for it), so this is cached
 * aggressively and never invalidated by any mutation in the app.
 */
export const useBusinessTaxonomyQuery = () =>
  useQuery({
    queryKey: businessTaxonomyKeys.root,
    queryFn: () => platformSettingsApi.getBusinessTaxonomy(),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });

/** Look up one category's subcategories from an already-fetched taxonomy list. Returns `[]`
 * (never throws) when the category key isn't found or the taxonomy hasn't loaded yet. */
export const subcategoriesFor = (
  taxonomy: BusinessTaxonomyCategory[] | undefined,
  categoryKey: string | undefined,
): BusinessTaxonomyCategory["subcategories"] => {
  if (!taxonomy || !categoryKey) {
    return [];
  }
  return taxonomy.find((category) => category.key === categoryKey)?.subcategories ?? [];
};
