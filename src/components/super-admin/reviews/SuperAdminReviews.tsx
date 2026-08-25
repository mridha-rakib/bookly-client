"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons/core-free-icons";

import type { ReviewModerationStatus } from "@/lib/api/superAdminReview";
import { useModerateReviewMutation, useSuperAdminReviewsQuery } from "@/lib/superAdminReview/hooks";

const statusBadge = (status: ReviewModerationStatus) => {
  switch (status) {
    case "PUBLISHED":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F4EA] text-[#137333]">Published</span>;
    case "HIDDEN":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFF4E5] text-[#B5651D]">Hidden</span>;
    case "REMOVED":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FCE8E6] text-[#C5221F]">Removed</span>;
  }
};

/** Batch 14 — the smallest design-consistent Super Admin Reviews moderation surface, following
 * the same table/tab/badge conventions SuperAdminPromoCode.tsx established. Hide/Remove only —
 * no Restore (confirmed rule: no product evidence supports one). */
export default function SuperAdminReviews() {
  const [activeTab, setActiveTab] = useState<"All" | ReviewModerationStatus>("All");
  const [page, setPage] = useState(1);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const listQuery = useSuperAdminReviewsQuery({
    status: activeTab === "All" ? undefined : activeTab,
    page,
    limit: 20,
  });
  const moderateMutation = useModerateReviewMutation();

  const reviews = listQuery.data?.reviews ?? [];
  const total = listQuery.data?.pagination.total ?? 0;

  const handleModerate = async (reviewId: string, action: "HIDE" | "REMOVE") => {
    setPendingActionId(reviewId);
    try {
      await moderateMutation.mutateAsync({ reviewId, action });
    } finally {
      setPendingActionId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="flex flex-col gap-6 w-full pb-12 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
        <h2 className="font-sans font-semibold text-2xl text-[#111827] leading-[32px]">Reviews</h2>
      </div>

      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden flex flex-col w-full">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 pt-4 gap-6 overflow-x-auto whitespace-nowrap scrollbar-none">
          {(["All", "PUBLISHED", "HIDDEN", "REMOVED"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setPage(1);
                }}
                className={`pb-4 text-sm font-medium transition-all relative cursor-pointer ${
                  isActive ? "text-[#2E9DA7] font-semibold" : "text-[#4E5F78]"
                }`}
              >
                <span>{tab === "All" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2E9DA7] rounded-t-full" />}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Reviewer</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Business</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Rating</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Comment</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Booking</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                    Loading reviews...
                  </td>
                </tr>
              )}
              {!listQuery.isLoading && reviews.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                    No reviews found.
                  </td>
                </tr>
              )}
              {!listQuery.isLoading &&
                reviews.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {review.reviewerDisplayName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{review.businessName}</td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <HugeiconsIcon
                            key={idx}
                            icon={StarIcon}
                            className={`w-3.5 h-3.5 ${idx < review.rating ? "text-[#E49D12] fill-[#E49D12]" : "text-gray-200"}`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-[280px] truncate">{review.comment ?? "—"}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-500 whitespace-nowrap">{review.bookingReference}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(review.createdAt)}</td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">{statusBadge(review.status)}</td>
                    <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                      {review.status === "PUBLISHED" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleModerate(review.id, "HIDE")}
                            disabled={pendingActionId === review.id}
                            className="px-3 py-1.5 border border-gray-200 rounded-full text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Hide
                          </button>
                          <button
                            onClick={() => handleModerate(review.id, "REMOVE")}
                            disabled={pendingActionId === review.id}
                            className="px-3 py-1.5 border border-red-200 rounded-full text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No action</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Showing {reviews.length > 0 ? (page - 1) * 20 + 1 : 0}–{(page - 1) * 20 + reviews.length} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 20 >= total}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
