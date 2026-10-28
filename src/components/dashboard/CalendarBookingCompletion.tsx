"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { bookingsApi } from "@/lib/api/bookings";
import { bookingKeys, useCompleteBookingMutation } from "@/lib/bookings/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import { toast } from "@/components/ui/sonner";
import { CompleteModal, type CompleteModalVenuePayment } from "./CalendarActionModals";

/** Mounted for one selected Business/Booking. Summaries supply identity only, never money.
 * Reuses the Business detail cache and the existing completion mutation/invalidation contract. */
export default function CalendarBookingCompletion({ businessId, bookingId, onClose, onViewBooking }: {
  businessId: string;
  bookingId: string;
  onClose: () => void;
  onViewBooking?: (bookingId: string) => void;
}) {
  const [failure, setFailure] = useState<string>();
  const submitting = useRef(false);
  const mutation = useCompleteBookingMutation();
  const detail = useQuery({
    queryKey: bookingKeys.detail(businessId, bookingId),
    queryFn: () => bookingsApi.getDetailForBusiness(businessId, bookingId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const booking = detail.data;
  const firstClass = booking?.serviceLines.some((line) => Boolean(line.packageItemId));
  const balance = booking?.paymentSummary?.outstandingVenueBalanceCents;
  const validBalance = Number.isSafeInteger(balance) && balance !== undefined && balance >= 0;
  const ready = detail.isFetchedAfterMount && !detail.isFetching && !detail.isError &&
    booking?.id === bookingId && booking.businessId === businessId;

  function confirm(venuePayment: CompleteModalVenuePayment) {
    if (submitting.current || mutation.isPending || !ready || !validBalance ||
        firstClass || booking?.status !== "UPCOMING" || booking.completionPayment != null || failure) return;
    submitting.current = true;
    mutation.mutate({ businessId, bookingId, venuePayment, expectedOutstandingVenueBalanceCents: balance }, {
      onSuccess: () => { toast.success("Booking completed."); onClose(); },
      onError: (error) => {
        // The server rechecks status and financial input. Unknown outcomes may have committed:
        // require an explicit fresh read and new confirmation, never replay automatically.
        setFailure(`${toUserMessage(error)} Reload Booking details to check its status and balance before confirming again.`);
      },
      onSettled: () => { submitting.current = false; },
    });
  }

  if (ready && !failure && !firstClass && booking.status === "UPCOMING" && booking.completionPayment == null && validBalance) {
    return <CompleteModal key={`${bookingId}:${detail.dataUpdatedAt}`} isOpen onClose={onClose}
      onConfirm={confirm} defaultBalanceDueCents={balance} isPending={mutation.isPending}
      isPackageSession={booking.serviceLines.some((line) => Boolean(line.packageProgressId))}
      isPackageOrigin={booking.packageSessions.some((session) => session.isOriginSession)} />;
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <section role="dialog" aria-label="Booking completion" aria-modal="true" className="w-full max-w-md space-y-4 rounded-xl bg-white p-6">
      <h2 className="text-lg font-semibold">Booking completion</h2>
      {detail.isFetching ? <p role="status">Loading current Booking details…</p> :
        failure || detail.isError ? <p role="alert">{failure ?? "Booking details are unavailable. Reload before completing this appointment."}</p> :
        ready && firstClass ? <p>Manage this appointment from its Package controls. Package availability and completion are verified there.</p> :
        ready && booking?.status === "UPCOMING" && booking.completionPayment != null ? <p role="alert">This appointment already has a venue-payment record. View the Booking to review it before completing the appointment.</p> :
        ready && booking?.status !== "UPCOMING" ? <p>This Booking is {booking?.status} and cannot be completed again. View the Booking to review its recorded outcome.</p> :
        <p role="alert">The current Booking balance is unavailable. Reload before completing this appointment.</p>}
      {!(ready && firstClass) && <button type="button" disabled={detail.isFetching || mutation.isPending}
        onClick={() => { void detail.refetch().then((result) => { if (!result.isError) setFailure(undefined); }); }}>
        Reload Booking details
      </button>}
      {onViewBooking && <button type="button" disabled={mutation.isPending} onClick={() => { onClose(); onViewBooking(bookingId); }}>
        {firstClass ? "Manage package appointment" : "View Booking"}
      </button>}
      <button type="button" disabled={mutation.isPending} onClick={onClose}>Close</button>
    </section>
  </div>;
}
