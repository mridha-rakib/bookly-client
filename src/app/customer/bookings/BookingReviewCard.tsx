"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons/core-free-icons";

import { toUserMessage } from "@/lib/auth/messages";
import { useCreateReviewMutation, useReviewStateQuery, useUpdateReviewMutation } from "@/lib/review/hooks";

interface BookingReviewCardProps {
  bookingId: string;
  bookingSource: "BOOKLY_MANAGED" | "MANUAL";
  bookingStatus: string;
}

const StarInput = ({ value, onChange }: { value: number; onChange: (rating: number) => void }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        onClick={() => onChange(star)}
        className="cursor-pointer"
        aria-label={`${star} star${star === 1 ? "" : "s"}`}
      >
        <HugeiconsIcon
          icon={StarIcon}
          className={`w-7 h-7 ${star <= value ? "text-[#E49D12] fill-[#E49D12]" : "text-[#D3D1C7]"}`}
        />
      </button>
    ))}
  </div>
);

/** Batch 14 — Customer "leave a review" / "edit" / read-only card for a Booking's detail page.
 * Only ever shown for a genuinely COMPLETED + BOOKLY_MANAGED booking (server-verified via
 * `useReviewStateQuery`'s own `eligible` flag — this component never decides eligibility itself,
 * it only renders whatever the server says). */
export default function BookingReviewCard({
  bookingId,
  bookingSource,
  bookingStatus,
}: BookingReviewCardProps) {
  const stateQuery = useReviewStateQuery(bookingId);
  const createMutation = useCreateReviewMutation();
  const updateMutation = useUpdateReviewMutation();

  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const review = stateQuery.data?.review ?? null;
  const isEditable = review ? new Date(review.editableUntil) > new Date() : false;

  const startEditing = () => {
    if (review) {
      setRating(review.rating);
      setComment(review.comment ?? "");
    }
    setFormError(undefined);
    setIsEditing(true);
  };

  // Only relevant for a COMPLETED + BOOKLY_MANAGED booking — every other combination (UPCOMING,
  // CANCELLED, NO_SHOW, MANUAL) shows no review action at all (confirmed rule — see the batch
  // report's "Customer My Bookings integration" section).
  if (bookingSource !== "BOOKLY_MANAGED" || bookingStatus !== "COMPLETED") {
    return null;
  }
  if (stateQuery.isLoading || !stateQuery.data) {
    return null;
  }
  if (!stateQuery.data.eligible) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(undefined);
    try {
      if (review) {
        await updateMutation.mutateAsync({ bookingId, input: { rating, comment: comment || undefined } });
      } else {
        await createMutation.mutateAsync({ bookingId, input: { rating, comment: comment || undefined } });
      }
      setIsEditing(false);
    } catch (error) {
      setFormError(toUserMessage(error));
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Existing review, not currently editing — read-only or an Edit trigger, per the 14-day window.
  if (review && !isEditing) {
    return (
      <div className="w-full bg-[#FFFFFF] border border-[#ACAAB4] rounded-xl p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-[#888780] uppercase">Your review</span>
          {isEditable && (
            <button
              type="button"
              onClick={startEditing}
              className="text-xs font-semibold text-[#2E9DA7] hover:underline cursor-pointer"
            >
              Edit
            </button>
          )}
        </div>
        <StarInput value={review.rating} onChange={() => {}} />
        {review.comment && <p className="text-sm text-[#111111]">{review.comment}</p>}
      </div>
    );
  }

  // No review yet, or actively editing.
  return (
    <div className="w-full bg-[#FFFFFF] border border-[#ACAAB4] rounded-xl p-6 flex flex-col gap-4">
      <span className="text-xs font-semibold tracking-wider text-[#888780] uppercase">
        {review ? "Edit your review" : "Leave a review"}
      </span>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <StarInput value={rating} onChange={setRating} />
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience (optional)"
          maxLength={1000}
          rows={3}
          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm font-inter focus:outline-none focus:border-[#2E9DA7] focus:bg-white transition-all text-[#111111] resize-none"
        />
        {formError && <p className="text-sm text-red-600 font-medium">{formError}</p>}
        <div className="flex items-center gap-3 justify-end">
          {review && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setRating(review.rating);
                setComment(review.comment ?? "");
                setFormError(undefined);
              }}
              className="py-2.5 px-6 border border-[#C6C6CB] rounded-lg text-sm font-semibold text-[#111111] hover:bg-neutral-100 transition-colors bg-white cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="py-2.5 px-6 rounded-lg text-sm font-semibold bg-[#2E9DA7] text-white hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : review ? "Save changes" : "Submit review"}
          </button>
        </div>
      </form>
    </div>
  );
}
