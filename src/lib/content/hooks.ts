"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type BlogCategory,
  type BlogStatus,
  type CreateBlogInput,
  type CreateFaqInput,
  type FaqAudience,
  type FaqStatus,
  type StaticPageKey,
  type UpdateBlogInput,
  type UpdateFaqInput,
  type UpdateStaticPageInput,
  contentApi,
} from "@/lib/api/content";

type AdminBlogFilter = { category?: BlogCategory; status?: BlogStatus; page?: number };
type PublicBlogFilter = { category?: BlogCategory; page?: number };

export const contentKeys = {
  all: ["content"] as const,
  faqs: (params: { audience: FaqAudience; status?: FaqStatus }) =>
    [...contentKeys.all, "faqs", params] as const,
  publicFaqs: (audience: FaqAudience) => [...contentKeys.all, "publicFaqs", audience] as const,
  blog: ["content", "blog"] as const,
  adminBlogList: (filter: AdminBlogFilter) => [...contentKeys.blog, "adminList", filter] as const,
  adminBlogDetail: (postId: string) => [...contentKeys.blog, "adminDetail", postId] as const,
  publicBlogList: (filter: PublicBlogFilter) =>
    [...contentKeys.blog, "publicList", filter] as const,
  publicBlogDetail: (slug: string) => [...contentKeys.blog, "publicDetail", slug] as const,
  staticPages: ["content", "staticPages"] as const,
  adminStaticPageList: () => [...contentKeys.staticPages, "adminList"] as const,
  adminStaticPage: (pageKey: string) => [...contentKeys.staticPages, "admin", pageKey] as const,
  publicStaticPage: (pageKey: string) => [...contentKeys.staticPages, "public", pageKey] as const,
};

// Blog responses embed S3 signed URLs (default 15-min TTL). Keep cached data comfortably
// fresher than that so a remount never renders an expired image URL, without disabling caching
// globally. `staleTime` → refetch fresh URLs on remount after 5 min; `gcTime` → an idle cache
// entry is dropped after 10 min so it can never outlive the signed URL.
const BLOG_QUERY_FRESHNESS = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 } as const;

/** Admin Content Manager FAQ list — all statuses for the audience unless `status` narrows it. */
export const useFaqsQuery = (params: { audience: FaqAudience; status?: FaqStatus }) =>
  useQuery({
    queryKey: contentKeys.faqs(params),
    queryFn: () => contentApi.listFaqs(params),
  });

/** Public (anonymous) FAQ list — PUBLISHED only, ordered by persisted `order`. Consumed by the
 * landing-page `FaqSection` (homepage → CUSTOMER, List Your Business → BUSINESS). */
export const usePublicFaqsQuery = (audience: FaqAudience) =>
  useQuery({
    queryKey: contentKeys.publicFaqs(audience),
    queryFn: () => contentApi.listPublicFaqs(audience),
  });

export const useCreateFaqMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFaqInput) => contentApi.createFaq(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
};

export const useUpdateFaqMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ faqId, input }: { faqId: string; input: UpdateFaqInput }) =>
      contentApi.updateFaq(faqId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
};

export const useDeleteFaqMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (faqId: string) => contentApi.deleteFaq(faqId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
};

export const useReorderFaqsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { audience: FaqAudience; orderedIds: string[] }) =>
      contentApi.reorderFaqs(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
};

// --- Blog (Phase 2) -------------------------------------------------------------------------

/** Super Admin blog list — all statuses unless narrowed. Server-side category/status filter. */
export const useAdminBlogListQuery = (filter: AdminBlogFilter) =>
  useQuery({
    queryKey: contentKeys.adminBlogList(filter),
    queryFn: () =>
      contentApi.listBlog({
        category: filter.category,
        status: filter.status,
        page: filter.page ?? 1,
      }),
    ...BLOG_QUERY_FRESHNESS,
  });

/** Super Admin single post — private, can resolve DRAFT (used by admin Edit + View preview). */
export const useAdminBlogPostQuery = (postId: string | undefined) =>
  useQuery({
    queryKey: contentKeys.adminBlogDetail(postId ?? ""),
    queryFn: () => contentApi.getBlog(postId as string),
    enabled: Boolean(postId),
    ...BLOG_QUERY_FRESHNESS,
  });

/** Public (anonymous) blog list — PUBLISHED only. */
export const usePublicBlogListQuery = (filter: PublicBlogFilter) =>
  useQuery({
    queryKey: contentKeys.publicBlogList(filter),
    queryFn: () => contentApi.listPublicBlog({ category: filter.category, page: filter.page ?? 1 }),
    ...BLOG_QUERY_FRESHNESS,
  });

/** Public (anonymous) article by slug — 404 for drafts. */
export const usePublicBlogPostQuery = (slug: string | undefined) =>
  useQuery({
    queryKey: contentKeys.publicBlogDetail(slug ?? ""),
    queryFn: () => contentApi.getPublicBlogBySlug(slug as string),
    enabled: Boolean(slug),
    ...BLOG_QUERY_FRESHNESS,
  });

export const useCreateBlogMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBlogInput) => contentApi.createBlog(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.blog });
    },
  });
};

export const useUpdateBlogMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: UpdateBlogInput }) =>
      contentApi.updateBlog(postId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.blog });
    },
  });
};

export const useDeleteBlogMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => contentApi.deleteBlog(postId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.blog });
    },
  });
};

/** Upload a single blog image. Does NOT invalidate lists — media is only referenced once a
 * post is saved. */
export const useUploadBlogMediaMutation = () =>
  useMutation({
    mutationFn: (file: File) => contentApi.uploadBlogMedia(file),
  });

export const useDeleteBlogMediaMutation = () =>
  useMutation({
    mutationFn: (mediaId: string) => contentApi.deleteBlogMedia(mediaId),
  });

// --- Static Pages (Phase 3) --------------------------------------------------------------

/** Super Admin — all 4 legal pages (each row is real or an `exists:false` placeholder). */
export const useAdminStaticPagesQuery = () =>
  useQuery({
    queryKey: contentKeys.adminStaticPageList(),
    queryFn: () => contentApi.listStaticPages(),
  });

/** Super Admin — one page by key, for the editor. */
export const useAdminStaticPageQuery = (pageKey: StaticPageKey | undefined) =>
  useQuery({
    queryKey: contentKeys.adminStaticPage(pageKey ?? ""),
    queryFn: () => contentApi.getStaticPage(pageKey as StaticPageKey),
    enabled: Boolean(pageKey),
  });

/** Public (anonymous) — a legal page by key. Rejects (404) until first saved. */
export const usePublicStaticPageQuery = (pageKey: StaticPageKey) =>
  useQuery({
    queryKey: contentKeys.publicStaticPage(pageKey),
    queryFn: () => contentApi.getPublicStaticPage(pageKey),
  });

export const useUpdateStaticPageMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageKey, input }: { pageKey: StaticPageKey; input: UpdateStaticPageInput }) =>
      contentApi.updateStaticPage(pageKey, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.staticPages });
    },
  });
};
