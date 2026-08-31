import { apiRequest } from "@/lib/api/client";

/**
 * Content Manager — FAQ vertical (Phase 1). Admin CRUD + reorder are SUPER_ADMIN-only on the
 * backend (see api/src/modules/super-admin/super-admin.route.ts). The public list is genuinely
 * anonymous (see api/src/modules/content/content.route.ts) and returns PUBLISHED rows only.
 * Shapes mirror api/src/modules/content/faq.dto.ts exactly.
 */

export type FaqAudience = "CUSTOMER" | "BUSINESS";
export type FaqStatus = "PUBLISHED" | "DRAFT";

export interface Faq {
  id: string;
  question: string;
  answer: string;
  audience: FaqAudience;
  status: FaqStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** Public shape — question + answer only. */
export interface PublicFaq {
  id: string;
  question: string;
  answer: string;
}

export interface CreateFaqInput {
  question: string;
  answer: string;
  audience: FaqAudience;
  status?: FaqStatus;
}

export interface UpdateFaqInput {
  question?: string;
  answer?: string;
  status?: FaqStatus;
}

export const contentApi = {
  listFaqs: (params: { audience: FaqAudience; status?: FaqStatus }) =>
    apiRequest<{ faqs: Faq[] }>({
      method: "GET",
      url: "/super-admin/content/faqs",
      params: {
        audience: params.audience,
        ...(params.status ? { status: params.status } : {}),
      },
    }),

  createFaq: (input: CreateFaqInput) =>
    apiRequest<Faq>({ method: "POST", url: "/super-admin/content/faqs", data: input }),

  updateFaq: (faqId: string, input: UpdateFaqInput) =>
    apiRequest<Faq>({ method: "PATCH", url: `/super-admin/content/faqs/${faqId}`, data: input }),

  deleteFaq: (faqId: string) =>
    apiRequest<{ id: string }>({ method: "DELETE", url: `/super-admin/content/faqs/${faqId}` }),

  reorderFaqs: (input: { audience: FaqAudience; orderedIds: string[] }) =>
    apiRequest<{ faqs: Faq[] }>({
      method: "POST",
      url: "/super-admin/content/faqs/reorder",
      data: input,
    }),

  /** Public, no auth required. */
  listPublicFaqs: (audience: FaqAudience) =>
    apiRequest<{ faqs: PublicFaq[] }>({
      method: "GET",
      url: "/content/faqs",
      params: { audience },
    }),

  // --- Blog (Phase 2) — shapes mirror api/src/modules/content/blog.dto.ts -----------------

  listBlog: (params: { category?: BlogCategory; status?: BlogStatus; page?: number; limit?: number }) =>
    apiRequest<BlogListResult<BlogAdminPost>>({
      method: "GET",
      url: "/super-admin/content/blog",
      params: {
        ...(params.category ? { category: params.category } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.page ? { page: String(params.page) } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  getBlog: (postId: string) =>
    apiRequest<BlogAdminPost>({ method: "GET", url: `/super-admin/content/blog/${postId}` }),

  createBlog: (input: CreateBlogInput) =>
    apiRequest<BlogAdminPost>({ method: "POST", url: "/super-admin/content/blog", data: input }),

  updateBlog: (postId: string, input: UpdateBlogInput) =>
    apiRequest<BlogAdminPost>({
      method: "PATCH",
      url: `/super-admin/content/blog/${postId}`,
      data: input,
    }),

  deleteBlog: (postId: string) =>
    apiRequest<{ id: string }>({ method: "DELETE", url: `/super-admin/content/blog/${postId}` }),

  uploadBlogMedia: (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return apiRequest<BlogImage>({
      method: "POST",
      url: "/super-admin/content/blog/media",
      data,
    });
  },

  deleteBlogMedia: (mediaId: string) =>
    apiRequest<{ id: string }>({
      method: "DELETE",
      url: `/super-admin/content/blog/media/${mediaId}`,
    }),

  /** Public, no auth required — PUBLISHED posts only. */
  listPublicBlog: (params: { category?: BlogCategory; page?: number; limit?: number } = {}) =>
    apiRequest<BlogListResult<BlogPublicListItem>>({
      method: "GET",
      url: "/content/blog",
      params: {
        ...(params.category ? { category: params.category } : {}),
        ...(params.page ? { page: String(params.page) } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  /** Public, no auth required — resolves a PUBLISHED post by slug (404 for drafts). */
  getPublicBlogBySlug: (slug: string) =>
    apiRequest<BlogPublicDetail>({
      method: "GET",
      url: `/content/blog/${encodeURIComponent(slug)}`,
    }),

  // --- Static Pages (Phase 3) — fixed set of legal pages, always-live (no status) ----------

  listStaticPages: () =>
    apiRequest<{ pages: StaticPageAdminItem[] }>({
      method: "GET",
      url: "/super-admin/content/pages",
    }),

  getStaticPage: (pageKey: StaticPageKey) =>
    apiRequest<StaticPageAdminItem>({
      method: "GET",
      url: `/super-admin/content/pages/${pageKey}`,
    }),

  updateStaticPage: (pageKey: StaticPageKey, input: UpdateStaticPageInput) =>
    apiRequest<StaticPageAdminItem>({
      method: "PATCH",
      url: `/super-admin/content/pages/${pageKey}`,
      data: input,
    }),

  /** Public, no auth required — 404 until a SUPER_ADMIN first saves the page. */
  getPublicStaticPage: (pageKey: StaticPageKey) =>
    apiRequest<StaticPagePublicItem>({
      method: "GET",
      url: `/content/pages/${pageKey}`,
    }),
};

// --- Static Page types -----------------------------------------------------------------------

export type StaticPageKey = "TERMS" | "TERMS_OF_USE" | "PRIVACY" | "COOKIES";

/** Admin shape — always covers all 4 pages; `exists: false` means never saved yet. No user ids. */
export interface StaticPageAdminItem {
  pageKey: StaticPageKey;
  routePath: string;
  title: string;
  bodyHtml: string;
  exists: boolean;
  updatedAt: string | null;
  createdAt: string | null;
}

/** Public shape — real persisted content only. */
export interface StaticPagePublicItem {
  pageKey: StaticPageKey;
  routePath: string;
  title: string;
  bodyHtml: string;
  updatedAt: string;
}

export interface UpdateStaticPageInput {
  title: string;
  bodyHtml: string;
}

// --- Blog types ---------------------------------------------------------------------------

export type BlogCategory =
  | "FOUNDING_PARTNER"
  | "BOOKLY_NEWS"
  | "FOR_BUSINESS"
  | "CUSTOMER_TIPS";
export type BlogStatus = "DRAFT" | "PUBLISHED";

export interface BlogImage {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  originalFileName?: string;
  createdAt: string;
}

export interface BlogListResult<T> {
  posts: T[];
  pagination: { page: number; limit: number; total: number };
}

/** Full admin shape — includes DRAFT, bodyHtml and resolved image URLs. No author field. */
export interface BlogAdminPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  category: BlogCategory;
  status: BlogStatus;
  publishedAt: string | null;
  coverMediaId: string | null;
  coverImage: BlogImage | null;
  galleryMediaIds: string[];
  galleryImages: BlogImage[];
  galleryCount: number;
  facebookUrl?: string;
  instagramUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPublicListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: BlogCategory;
  publishedAt: string;
  coverImageUrl: string | null;
}

export interface BlogPublicDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  category: BlogCategory;
  publishedAt: string;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
  facebookUrl?: string;
  instagramUrl?: string;
}

export interface CreateBlogInput {
  title: string;
  slug?: string;
  excerpt?: string;
  bodyHtml: string;
  category: BlogCategory;
  status: BlogStatus;
  coverMediaId?: string;
  galleryMediaIds?: string[];
  facebookUrl?: string;
  instagramUrl?: string;
}

export interface UpdateBlogInput {
  title?: string;
  slug?: string;
  excerpt?: string;
  bodyHtml?: string;
  category?: BlogCategory;
  status?: BlogStatus;
  coverMediaId?: string | null;
  galleryMediaIds?: string[];
  facebookUrl?: string | null;
  instagramUrl?: string | null;
}
