import type { StaticPageKey } from "@/lib/api/content";

/**
 * The fixed set of CMS-managed legal pages and where each one lives on the public site. Route
 * paths mirror the existing Next.js route files + Footer links exactly — wiring facts, not
 * legal content. The backend is the source of truth for titles + bodies; these are only used
 * for the admin ordering and as the public route → pageKey binding.
 */
export const STATIC_PAGE_KEYS: StaticPageKey[] = ["TERMS", "TERMS_OF_USE", "PRIVACY", "COOKIES"];

export const STATIC_PAGE_ROUTE_PATH: Record<StaticPageKey, string> = {
  TERMS: "/terms-of-service",
  TERMS_OF_USE: "/terms-of-use",
  PRIVACY: "/privacy",
  COOKIES: "/cookies",
};

export const formatStaticPageDate = (iso: string | null): string => {
  if (!iso) return "Not created yet";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
