"use client";

import React from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon, Facebook02Icon, InstagramIcon } from "@hugeicons/core-free-icons";

import type { BlogAdminPost, BlogCategory, BlogStatus } from "@/lib/api/content";
import { BLOG_CATEGORIES, blogCategoryLabel, formatBlogDate } from "@/lib/content/blog";

type CategoryFilter = "All" | BlogCategory;
type StatusFilter = "All" | BlogStatus;

interface BlogTabProps {
  posts: BlogAdminPost[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  blogFilter: CategoryFilter;
  setBlogFilter: (val: CategoryFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (val: StatusFilter) => void;
  onEdit: (post: BlogAdminPost) => void;
  onDelete: (post: BlogAdminPost) => void;
  onNewPost: () => void;
  onView: (post: BlogAdminPost) => void;
}

export default function BlogTab({
  posts,
  total,
  isLoading,
  isError,
  blogFilter,
  setBlogFilter,
  statusFilter,
  setStatusFilter,
  onEdit,
  onDelete,
  onNewPost,
  onView,
}: BlogTabProps) {
  const categoryOptions: CategoryFilter[] = ["All", ...BLOG_CATEGORIES];

  return (
    <div className="flex flex-col gap-5">
      {/* Sub-filters row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-100">
        <div
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0 max-w-full sm:max-w-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {categoryOptions.map((filterVal) => {
            const isActive = blogFilter === filterVal;
            return (
              <button
                key={filterVal}
                onClick={() => setBlogFilter(filterVal)}
                className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 shrink-0 ${
                  isActive
                    ? "bg-[#6366F1]/10 border-[#6366F1] text-[#6366F1]"
                    : "bg-white border-[#E5E7EB] text-[#374151] hover:bg-gray-55"
                }`}
              >
                {filterVal === "FOUNDING_PARTNER" && (
                  <HugeiconsIcon icon={StarIcon} className="w-3.5 h-3.5 text-amber-500" />
                )}
                {filterVal === "All" ? "All Posts" : blogCategoryLabel(filterVal)}
              </button>
            );
          })}
        </div>

        {/* Status & Add Row */}
        <div className="flex items-center gap-3 shrink-0 border-t border-gray-100 pt-2 sm:border-t-0 sm:pt-0 justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Status:</span>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="appearance-none bg-white border border-gray-200 rounded-xl px-2.5 py-1 pr-7 text-xs font-medium text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#6366F1] cursor-pointer"
              >
                <option value="All">All</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          <button
            onClick={onNewPost}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#6366F1] text-white text-xs font-medium rounded-full hover:bg-indigo-650 transition-colors border-none cursor-pointer shadow-sm shrink-0"
          >
            + New Post
          </button>
        </div>
      </div>

      {/* Cards List */}
      <div className="flex flex-col gap-4">
        {isLoading && (
          <div className="text-center py-10 bg-white border border-[#E5E7EB] rounded-xl text-gray-400 text-sm">
            Loading blog posts…
          </div>
        )}

        {!isLoading && isError && (
          <div className="text-center py-10 bg-white border border-red-100 rounded-xl text-red-500 text-sm">
            Could not load blog posts. Please try again.
          </div>
        )}

        {!isLoading && !isError && posts.length === 0 && (
          <div className="text-center py-10 bg-white border border-[#E5E7EB] rounded-xl text-gray-400 text-sm">
            {blogFilter === "All" && statusFilter === "All"
              ? "No blog posts yet. Click “+ New Post” to create the first one."
              : "No blog posts match the selected filters."}
          </div>
        )}

        {!isLoading &&
          !isError &&
          posts.map((post) => (
            <div
              key={post.id}
              className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] flex flex-col lg:flex-row gap-5 items-stretch lg:items-start w-full min-w-0"
            >
              {/* Cover image or honest placeholder */}
              <div className="relative w-24 h-20 rounded-lg shrink-0 overflow-hidden border border-gray-100">
                {post.coverImage ? (
                  <Image
                    src={post.coverImage.url}
                    alt={post.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-gray-50 flex items-center justify-center text-[10px] font-medium text-gray-400 select-none">
                    No image
                  </div>
                )}
                {post.galleryCount > 0 && (
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white font-medium text-[9px] px-1.5 py-0.5 rounded">
                    +{post.galleryCount}
                  </div>
                )}
              </div>

              {/* Middle content */}
              <div className="flex-grow flex flex-col gap-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      post.category === "FOUNDING_PARTNER"
                        ? "bg-amber-100/60 text-[#92400E]"
                        : "bg-blue-100/60 text-[#1D4ED8]"
                    }`}
                  >
                    {blogCategoryLabel(post.category)}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                      post.status === "PUBLISHED"
                        ? "bg-green-100/60 text-[#16A34A]"
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                    }`}
                  >
                    {post.status === "PUBLISHED" ? "Published" : "Draft"}
                  </span>
                  <span className="text-[#6B7280]">
                    {formatBlogDate(post.publishedAt ?? post.updatedAt)}
                  </span>
                </div>

                <h3
                  className="font-semibold text-[#111827] text-base leading-5 truncate"
                  title={post.title}
                >
                  {post.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#6B7280] leading-5 line-clamp-2">
                  {post.excerpt}
                </p>

                {(post.facebookUrl || post.instagramUrl) && (
                  <div className="flex items-center gap-4 text-xs text-[#6B7280] mt-1 flex-wrap">
                    {post.facebookUrl && (
                      <div className="flex items-center gap-1 min-w-0">
                        <HugeiconsIcon icon={Facebook02Icon} className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{post.facebookUrl}</span>
                      </div>
                    )}
                    {post.instagramUrl && (
                      <div className="flex items-center gap-1 min-w-0">
                        <HugeiconsIcon icon={InstagramIcon} className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{post.instagramUrl}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-row lg:flex-col items-center justify-end gap-3 shrink-0 w-full lg:w-auto mt-2 lg:mt-0 border-t border-gray-100 pt-3 lg:border-t-0 lg:pt-0">
                <button
                  onClick={() => onView(post)}
                  className="text-xs font-semibold text-[#6366F1] bg-transparent border-none hover:underline cursor-pointer px-3 py-1"
                >
                  View
                </button>
                <button
                  onClick={() => onEdit(post)}
                  className="text-xs font-semibold text-[#6366F1] bg-white border border-[#6366F1] rounded-full hover:bg-indigo-50 px-3.5 py-1.5 transition-colors cursor-pointer shrink-0"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(post)}
                  className="text-xs font-semibold text-[#DC2626] bg-transparent border-none hover:underline cursor-pointer px-3 py-1"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
      </div>

      {!isLoading && !isError && posts.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {posts.length} of {total} post{total === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
