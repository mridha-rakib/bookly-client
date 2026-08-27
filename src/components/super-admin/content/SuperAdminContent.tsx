"use client";

import React, { useState } from "react";
import { BlogPost, StaticPage } from "./types";
import type { Faq } from "@/lib/api/content";
import {
  useCreateFaqMutation,
  useDeleteFaqMutation,
  useFaqsQuery,
  useReorderFaqsMutation,
  useUpdateFaqMutation,
} from "@/lib/content/hooks";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import BlogTab from "./BlogTab";
import StaticPagesTab from "./StaticPagesTab";
import FaqTab from "./FaqTab";
import BlogFormModal from "./BlogFormModal";
import FaqFormModal from "./FaqFormModal";
import NewBlogPostPage from "./NewBlogPostPage";
import StaticPageEditorPage from "./StaticPageEditorPage";
import BlogDetailBody from "@/components/blog/BlogDetailBody";

export default function SuperAdminContent() {
  const [activeTab, setActiveTab] = useState<"Blog" | "Static Pages" | "FAQ — Customers" | "FAQ — Businesses">("Blog");
  const [viewingPostId, setViewingPostId] = useState<string | null>(null);
  
  // Blog Filters state
  const [blogFilter, setBlogFilter] = useState<"All" | "Founding Partner" | "Bookly News" | "For Business" | "Customer Tips">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Published" | "Draft">("All");

  // --- Mock Data States ---
  const [posts, setPosts] = useState<BlogPost[]>([
    {
      id: "1",
      category: "Founding Partner",
      status: "Published",
      date: "22 May 2026",
      title: "Meet Our Founding Partners: Building Cyprus's First Booking Platform",
      description: "We're proud to introduce the visionary businesses that believed in Bookly from day one. These founding partners helped shape the platform you see today...",
      fbLink: "facebook.com/bookly.cy",
      igLink: "@bookly.cy",
    },
    {
      id: "2",
      category: "Bookly News",
      status: "Published",
      date: "22 May 2026",
      title: "Bookly.cy Launches Mobile Application for Staff Members",
      description: "Staff members can now manage bookings, view schedules, and interact with customers on the go. Read more about our release notes...",
      fbLink: "facebook.com/bookly.cy",
      igLink: "@bookly.cy",
    },
    {
      id: "3",
      category: "Bookly News",
      status: "Draft",
      date: "22 May 2026",
      title: "Upcoming Features: SMS Reminders & Multi-location Support",
      description: "We are testing automated SMS alerts to drastically reduce client no-shows. Learn how to configure this for your branch...",
      fbLink: "facebook.com/bookly.cy",
      igLink: "@bookly.cy",
    },
  ]);

  const [staticPages, setStaticPages] = useState<StaticPage[]>([
    { id: "1", title: "Terms & Conditions", slug: "/terms-of-service", status: "Published", lastUpdated: "15 Jan 2026" },
    { id: "2", title: "Privacy Policy (GDPR)", slug: "/privacy", status: "Published", lastUpdated: "15 Jan 2026" },
    { id: "3", title: "Cookie Policy", slug: "/cookies", status: "Published", lastUpdated: "15 Jan 2026" },
  ]);

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
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);

  const [isEditingStaticPage, setIsEditingStaticPage] = useState(false);
  const [editingPage, setEditingPage] = useState<StaticPage | null>(null);

  // Custom Delete Confirm state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "post" | "faq" | "page";
    id: string;
  } | null>(null);

  // --- Blog Handlers ---
  const handleSavePost = (data: Omit<BlogPost, "id" | "date">) => {
    if (editingPost) {
      setPosts((prev) =>
        prev.map((p) => (p.id === editingPost.id ? { ...p, ...data } : p))
      );
    } else {
      const newPost: BlogPost = {
        id: String(posts.length + 1),
        date: "22 May 2026",
        ...data,
      };
      setPosts([newPost, ...posts]);
    }
    setIsEditingBlogPost(false);
  };

  const handleDeletePost = (id: string) => {
    setDeleteConfirm({ isOpen: true, type: "post", id });
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

  // --- Static Page Handlers ---
  const handleSavePage = (data: Omit<StaticPage, "id" | "lastUpdated">) => {
    if (editingPage) {
      setStaticPages((prev) =>
        prev.map((sp) => (sp.id === editingPage.id ? { ...sp, ...data, lastUpdated: "15 Jan 2026" } : sp))
      );
    } else {
      const newPage: StaticPage = {
        id: String(Date.now()),
        lastUpdated: "15 Jan 2026",
        ...data,
      };
      setStaticPages((prev) => [...prev, newPage]);
    }
    setIsEditingStaticPage(false);
  };

  const handleDeletePage = (id: string) => {
    setDeleteConfirm({ isOpen: true, type: "page", id });
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
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } else if (type === "page") {
      setStaticPages((prev) => prev.filter((sp) => sp.id !== id));
    }
    setDeleteConfirm(null);
  };

  if (viewingPostId) {
    const finalId = viewingPostId.startsWith("post-") ? viewingPostId : `post-${viewingPostId}`;
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-[730px] mx-auto w-full">
        <BlogDetailBody
          id={finalId}
          onBack={() => setViewingPostId(null)}
        />
      </div>
    );
  }

  if (isEditingBlogPost) {
    return (
      <NewBlogPostPage
        editingPost={editingPost}
        onDiscard={() => setIsEditingBlogPost(false)}
        onSave={handleSavePost}
      />
    );
  }

  if (isEditingStaticPage && editingPage) {
    return (
      <StaticPageEditorPage
        editingPage={editingPage}
        onDiscard={() => setIsEditingStaticPage(false)}
        onSave={handleSavePage}
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
            posts={posts}
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
            onView={(post) => setViewingPostId(post.id)}
          />
        )}

        {activeTab === "Static Pages" && (
          <StaticPagesTab
            staticPages={staticPages}
            onEdit={(page) => {
              setEditingPage(page);
              setIsEditingStaticPage(true);
            }}
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
              Are you sure you want to delete this {deleteConfirm.type === "post" ? "blog post" : deleteConfirm.type === "faq" ? "FAQ item" : "static page"}? This action cannot be undone.
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
                disabled={deleteConfirm.type === "faq" && deleteFaqMutation.isPending}
                className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-xs font-semibold text-white border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleteConfirm.type === "faq" && deleteFaqMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
