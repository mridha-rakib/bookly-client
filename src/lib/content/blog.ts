import type { BlogCategory } from "@/lib/api/content";

/**
 * The ONE canonical category taxonomy for the blog. The persisted enum lives on the backend
 * (`api/src/modules/content/content.types.ts`); this maps each value to its display label so the
 * Super Admin CMS and the public blog always read the same values and show the same wording.
 */
export const BLOG_CATEGORIES: BlogCategory[] = [
  "FOUNDING_PARTNER",
  "BOOKLY_NEWS",
  "FOR_BUSINESS",
  "CUSTOMER_TIPS",
];

export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  FOUNDING_PARTNER: "Founding Partner",
  BOOKLY_NEWS: "Bookly News",
  FOR_BUSINESS: "For Business",
  CUSTOMER_TIPS: "Customer Tips",
};

export const blogCategoryLabel = (category: BlogCategory): string =>
  BLOG_CATEGORY_LABELS[category] ?? category;

/** Reverse lookup for the public category pills (which are rendered from labels). */
export const blogCategoryFromLabel = (label: string): BlogCategory | undefined =>
  BLOG_CATEGORIES.find((category) => BLOG_CATEGORY_LABELS[category] === label);

/** Public-blog badge palette, keyed by canonical category (mirrors the prior mock styling). */
export const blogCategoryBadgeClass = (category: BlogCategory): string => {
  switch (category) {
    case "BOOKLY_NEWS":
      return "bg-[#DBDDFF] text-[#0C0C0C]";
    case "FOUNDING_PARTNER":
      return "bg-[#C3E8C5] text-[#0C0C0C]";
    case "FOR_BUSINESS":
      return "bg-[#FEDFC9] text-[#0C0C0C]";
    case "CUSTOMER_TIPS":
      return "bg-[#FFDBF7] text-[#0C0C0C]";
    default:
      return "bg-gray-100 text-[#0C0C0C]";
  }
};

export const formatBlogDate = (iso: string | null): string => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
