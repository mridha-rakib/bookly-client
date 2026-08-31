"use client";

import React, { useState } from "react";
import type {
  BlogAdminPost,
  BlogCategory,
  BlogStatus,
  Faq,
  StaticPageKey,
} from "@/lib/api/content";
import {
  useAdminBlogListQuery,
  useAdminStaticPagesQuery,
  useCreateBlogMutation,
  useCreateFaqMutation,
  useDeleteBlogMutation,
  useDeleteFaqMutation,
  useFaqsQuery,
  useReorderFaqsMutation,
  useUpdateBlogMutation,
  useUpdateFaqMutation,
} from "@/lib/content/hooks";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import BlogTab from "./BlogTab";
import StaticPagesTab from "./StaticPagesTab";
import FaqTab from "./FaqTab";
import FaqFormModal from "./FaqFormModal";
import NewBlogPostPage, { type BlogFormPayload } from "./NewBlogPostPage";
import StaticPageEditorPage from "./StaticPageEditorPage";
import BlogDetailBody from "@/components/blog/BlogDetailBody";

export default function SuperAdminContent() {
  const [activeTab, setActiveTab] = useState<"Blog" | "Static Pages" | "FAQ — Customers" | "FAQ — Businesses">("Blog");

  // Blog state — MongoDB-backed (see api/src/modules/content). Filters drive the server query.
  const [blogFilter, setBlogFilter] = useState<"All" | BlogCategory>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | BlogStatus>("All");
  const [viewingPost, setViewingPost] = useState<BlogAdminPost | null>(null);

  const blogQuery = useAdminBlogListQuery({
    category: blogFilter === "All" ? undefined : blogFilter,
    status: statusFilter === "All" ? undefined : statusFilter,
  });
  const blogPosts = blogQuery.data?.posts ?? [];
  const blogTotal = blogQuery.data?.pagination.total ?? 0;
  const createBlogMutation = useCreateBlogMutation();
  const updateBlogMutation = useUpdateBlogMutation();
  const deleteBlogMutation = useDeleteBlogMutation();

  // Static Pages — MongoDB-backed fixed set of legal pages (see api/src/modules/content).
  const staticPagesQuery = useAdminStaticPagesQuery();
  const staticPages = staticPagesQuery.data?.pages ?? [];

  // FAQ data is now MongoDB-backed (see api/src/modules/content). One collection, discriminated
  // by `audience` — the active tab picks which audience we read/write.
  const faqAudience: Faq["audience"] =
    activeTab === "FAQ — Businesses" ? "BUSINESS" : "CUSTOMER";
  const faqsQuery = useFaqsQuery({ audience: faqAudience });
  const faqs = faqsQuery.data?.faqs ?? [];
  const createFaqMutation = useCreateFaqMutation();
  const updateFaqMutation = useUpdateFaqMutation();
  const deleteFaqMutation = useDeleteFaqMutation();
  const reorderFaqsMutation = useReorderFaqsMutation();

  // --- Modals Toggle & Editing Item state ---
  const [isEditingBlogPost, setIsEditingBlogPost] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogAdminPost | null>(null);

  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);

  const [editingPageKey, setEditingPageKey] = useState<StaticPageKey | null>(null);

  // Custom Delete Confirm state (Blog + FAQ only — Static Pages are a fixed set, not deletable)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "post" | "faq";
    id: string;
  } | null>(null);

  // --- Blog Handlers (MongoDB-backed via React Query mutations) ---
  const handleSavePost = async (data: BlogFormPayload) => {
    try {
      if (editingPost) {
        await updateBlogMutation.mutateAsync({
          postId: editingPost.id,
          input: {
            title: data.title,
            bodyHtml: data.bodyHtml,
            category: data.category,
            status: data.status,
            coverMediaId: data.coverMediaId,
            galleryMediaIds: data.galleryMediaIds,
            facebookUrl: data.facebookUrl,
            instagramUrl: data.instagramUrl,
          },
        });
        toast.success("Blog post updated successfully.");
      } else {
        await createBlogMutation.mutateAsync({
          title: data.title,
          bodyHtml: data.bodyHtml,
          category: data.category,
          status: data.status,
          coverMediaId: data.coverMediaId ?? undefined,
          galleryMediaIds: data.galleryMediaIds,
          facebookUrl: data.facebookUrl ?? undefined,
          instagramUrl: data.instagramUrl ?? undefined,
        });
        toast.success("Blog post created successfully.");
      }
      setIsEditingBlogPost(false);
      setEditingPost(null);
    } catch (error) {
      // Keep the editor open so the admin can retry — nothing was persisted.
      toast.error(toUserMessage(error));
    }
  };

  const handleDeletePost = (post: BlogAdminPost) => {
    setDeleteConfirm({ isOpen: true, type: "post", id: post.id });
  };

  // --- FAQ Handlers (MongoDB-backed via React Query mutations) ---
  const handleSaveFaq = async (
    e: React.FormEvent,
    data: { question: string; answer: string; status: Faq["status"] },
  ) => {
    e.preventDefault();
    try {
      if (editingFaq) {
        await updateFaqMutation.mutateAsync({ faqId: editingFaq.id, input: data });
        toast.success("FAQ updated successfully.");
      } else {
        await createFaqMutation.mutateAsync({ ...data, audience: faqAudience });
        toast.success("FAQ created successfully.");
      }
      setShowFaqModal(false);
    } catch (error) {
      // Keep the modal open so the admin can retry — nothing was persisted.
      toast.error(toUserMessage(error));
    }
  };

  const handleDeleteFaq = (id: string) => {
    setDeleteConfirm({ isOpen: true, type: "faq", id });
  };

  const handleReorderFaqs = async (orderedIds: string[]) => {
    try {
      await reorderFaqsMutation.mutateAsync({ audience: faqAudience, orderedIds });
      toast.success("FAQ order updated successfully.");
    } catch (error) {
      toast.error(toUserMessage(error));
      // Restore the real server order — FaqTab's optimistic list re-syncs from this refetch.
      void faqsQuery.refetch();
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    if (type === "faq") {
      try {
        await deleteFaqMutation.mutateAsync(id);
        toast.success("FAQ deleted successfully.");
        setDeleteConfirm(null);
      } catch (error) {
        // Leave the confirmation open on failure — nothing was deleted.
        toast.error(toUserMessage(error));
      }
      return;
    }
    if (type === "post") {
      try {
        await deleteBlogMutation.mutateAsync(id);
        toast.success("Blog post deleted successfully.");
        setDeleteConfirm(null);
      } catch (error) {
        toast.error(toUserMessage(error));
      }
      return;
    }
    setDeleteConfirm(null);
  };

  if (viewingPost) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-[730px] mx-auto w-full">
        <BlogDetailBody
          post={{
            title: viewingPost.title,
            category: viewingPost.category,
            publishedAt: viewingPost.publishedAt,
            bodyHtml: viewingPost.bodyHtml,
            coverImageUrl: viewingPost.coverImage?.url ?? null,
            galleryImageUrls: viewingPost.galleryImages.map((img) => img.url),
            facebookUrl: viewingPost.facebookUrl,
            instagramUrl: viewingPost.instagramUrl,
          }}
          draftNotice={viewingPost.status === "DRAFT"}
          onBack={() => setViewingPost(null)}
        />
      </div>
    );
  }

  if (isEditingBlogPost) {
    return (
      <NewBlogPostPage
        editingPost={editingPost}
        isSaving={createBlogMutation.isPending || updateBlogMutation.isPending}
        onDiscard={() => {
          setIsEditingBlogPost(false);
          setEditingPost(null);
        }}
        onSave={handleSavePost}
      />
    );
  }

  if (editingPageKey) {
    return (
      <StaticPageEditorPage
        pageKey={editingPageKey}
        onDiscard={() => setEditingPageKey(null)}
        onSaved={() => setEditingPageKey(null)}
      />
    );
  }

  return (
    <div
      className="h-full overflow-y-auto overflow-x-hidden no-scrollbar pr-2 pb-8 flex flex-col gap-6 font-sans"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Heading Title Container */}
      <div className="flex flex-col gap-1 flex-shrink-0">
        <h1 className="text-[32px] font-bold text-[#111827] leading-[38px] tracking-tight">
          Content Manager
        </h1>
        <p className="text-sm font-normal text-[#6B7280] leading-[17px]">
          Manage category wording, static pages, and FAQs.
        </p>
      </div>

      {/* Main Navigation Sub-tabs Container */}
      <div className="flex flex-row items-center border-b border-[#E5E7EB] h-[38px] gap-1 flex-shrink-0 w-full overflow-x-auto no-scrollbar">
        {(["Blog", "Static Pages", "FAQ — Customers", "FAQ — Businesses"] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-[38px] px-4 py-2 text-sm font-medium whitespace-nowrap transition-all border-b border-t-0 border-x-0 cursor-pointer bg-transparent flex items-center justify-center gap-1.5 ${
                isActive
                  ? "border-b-[1.06667px] border-b-[#6366F1] text-[#6366F1]"
                  : "border-b-transparent text-[#6B7280] hover:text-gray-900"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Dynamic Tab Render */}
      <div className="flex-grow">
        {activeTab === "Blog" && (
          <BlogTab
            posts={blogPosts}
            total={blogTotal}
            isLoading={blogQuery.isLoading}
            isError={blogQuery.isError}
            blogFilter={blogFilter}
            setBlogFilter={setBlogFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onEdit={(post) => {
              setEditingPost(post);
              setIsEditingBlogPost(true);
            }}
            onDelete={handleDeletePost}
            onNewPost={() => {
              setEditingPost(null);
              setIsEditingBlogPost(true);
            }}
            onView={(post) => setViewingPost(post)}
          />
        )}

        {activeTab === "Static Pages" && (
          <StaticPagesTab
            pages={staticPages}
            isLoading={staticPagesQuery.isLoading}
            isError={staticPagesQuery.isError}
            onEdit={(pageKey) => setEditingPageKey(pageKey)}
          />
        )}

        {(activeTab === "FAQ — Customers" || activeTab === "FAQ — Businesses") && (
          <FaqTab
            faqs={faqs}
            isLoading={faqsQuery.isLoading}
            isError={faqsQuery.isError}
            isReordering={reorderFaqsMutation.isPending}
            onReorder={handleReorderFaqs}
            onEdit={(faq) => {
              setEditingFaq(faq);
              setShowFaqModal(true);
            }}
            onDelete={handleDeleteFaq}
            onNewFaq={() => {
              setEditingFaq(null);
              setShowFaqModal(true);
            }}
          />
        )}
      </div>

      {/* Modals Mounting */}
      <FaqFormModal
        show={showFaqModal}
        onClose={() => setShowFaqModal(false)}
        onSave={handleSaveFaq}
        editingFaq={editingFaq}
        isSaving={createFaqMutation.isPending || updateFaqMutation.isPending}
      />

      {deleteConfirm?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-[400px] rounded-xl overflow-hidden shadow-xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base text-[#111827]">Confirm Deletion</h3>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 leading-5">
              Are you sure you want to delete this {deleteConfirm.type === "post" ? "blog post" : "FAQ item"}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5 mt-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-600 border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={
                  (deleteConfirm.type === "faq" && deleteFaqMutation.isPending) ||
                  (deleteConfirm.type === "post" && deleteBlogMutation.isPending)
                }
                className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-xs font-semibold text-white border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {(deleteConfirm.type === "faq" && deleteFaqMutation.isPending) ||
                (deleteConfirm.type === "post" && deleteBlogMutation.isPending)
                  ? "Deleting…"
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
