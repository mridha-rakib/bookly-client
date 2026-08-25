"use client";
import Image from "next/image";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons/core-free-icons";
import { useMyBusinessProfileQuery } from "@/lib/business/hooks";
import { useBusinessRatingSummaryQuery, useBusinessReviewsQuery } from "@/lib/review/hooks";

/** Batch 14 — real, read-only Reviews. Business Owner only (no reply/moderation/delete action
 * exists for any Business role — confirmed rule 1.9/19). Supervisor/Staff variants of this page
 * remain unwired: neither role has any real "current business" resolution anywhere in this
 * frontend yet (a pre-existing gap outside this batch's scope — see the batch report). */
export default function DashboardReviewsList() {
  const [page, setPage] = useState(1);
  const businessQuery = useMyBusinessProfileQuery();
  const businessId = businessQuery.data?.primary?.id;
  const summaryQuery = useBusinessRatingSummaryQuery(businessId);
  const reviewsQuery = useBusinessReviewsQuery(businessId, { page, limit: 10 });

  const reviews = reviewsQuery.data?.reviews ?? [];
  const total = reviewsQuery.data?.pagination.total ?? 0;
  const isLoading = businessQuery.isLoading || summaryQuery.isLoading || reviewsQuery.isLoading;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
      {/* Header Row */}
      <DashboardHeader title="Reviews" subtitle="Verified reviews from Bookly customers" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">
        {/* Main Alignment Wrapper */}
        <div className="flex flex-col gap-5 w-full">
          {/* Ratings Summary Card */}
          <div className="box-sizing-border-box flex flex-col items-center justify-center p-5 gap-2 w-[142px] h-[172px] border border-[#111111]/60 rounded-[12px] bg-white">
            <span className="font-poppins font-normal text-[12px] leading-[18px] tracking-[0.5px] uppercase text-[#111111]/60">
              Overall Rating
            </span>
            <span className="font-poppins font-medium text-[28px] leading-[36px] text-[#111111]">
              {summaryQuery.data?.averageRating !== null && summaryQuery.data?.averageRating !== undefined
                ? summaryQuery.data.averageRating.toFixed(1)
                : "—"}
            </span>
            <div className="flex flex-row gap-0.5">
              {[...Array(5)].map((_, i) => (
                <HugeiconsIcon
                  key={i}
                  icon={StarIcon}
                  className={`w-3 h-3 ${
                    summaryQuery.data?.averageRating && i < Math.round(summaryQuery.data.averageRating)
                      ? "text-[#E49D12] fill-[#E49D12]"
                      : "text-[#D3D1C7]"
                  }`}
                />
              ))}
            </div>
            <span className="font-poppins font-medium text-[12px] leading-[20px] text-[#111111]/60">
              {summaryQuery.data
                ? `${summaryQuery.data.reviewCount} review${summaryQuery.data.reviewCount === 1 ? "" : "s"}`
                : "—"}
            </span>
          </div>

          {/* Reviews List */}
          <div className="box-sizing-border-box flex flex-col items-start p-5 gap-5 w-full border border-[#111111]/60 rounded-[12px] bg-white">
            {isLoading && (
              <div className="w-full text-center text-sm text-[#5F5E5A] py-10">Loading reviews...</div>
            )}
            {!isLoading && reviews.length === 0 && (
              <div className="w-full text-center text-sm text-[#5F5E5A] py-10">
                No reviews yet — reviews from completed bookings will appear here.
              </div>
            )}
            {!isLoading &&
              reviews.map((review, index) => (
                <div key={review.id} className="w-full flex flex-col gap-3">
                  {/* Client Profile details */}
                  <div className="flex flex-row items-center gap-5 w-full justify-between">
                    <div className="flex flex-row items-center gap-1.5 h-10">
                      <Image
                        src="/img/dumyUser.jpeg"
                        alt={review.reviewerDisplayName}
                        className="w-7 h-7 rounded-full object-cover"
                        width={28}
                        height={28}
                      />
                      <div className="flex flex-col justify-center items-start">
                        <span className="font-poppins font-normal text-[12px] leading-[20px] text-[#111111]">
                          {review.reviewerDisplayName}
                        </span>
                        <span className="font-poppins font-normal text-[12px] leading-[20px] text-[#666666]">
                          Verified booking
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <span
                            key={idx}
                            className={`text-base ${idx < review.rating ? "text-[#E49D12]" : "text-neutral-200"}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="font-poppins font-normal text-[12px] leading-[20px] text-[#111111]/60 text-right">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Comment Text */}
                  {review.comment && (
                    <p className="font-poppins font-normal text-sm leading-[20px] text-[#111111]/60 w-full text-left">
                      {review.comment}
                    </p>
                  )}

                  {/* Separator line */}
                  {index < reviews.length - 1 && (
                    <div className="w-full border-b border-[#111111]/40 my-3" />
                  )}
                </div>
              ))}
          </div>

          {total > 10 && (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 10 >= total}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
