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
};
