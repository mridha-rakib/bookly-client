"use client";
import { useQuery } from "@tanstack/react-query";
import ConfirmedStep from "@/app/venue/components/ConfirmedStep";
import { bookingsApi } from "@/lib/api/bookings";
import { useAuthStore } from "@/lib/auth/store";
import { packageSecondaryCta } from "./package-cta";

/** Shared Booking Confirmed screen after a committed legacy Package session redemption. It reads
 * the persisted Booking back and checks it belongs to this Business and Package before showing
 * it; it never creates, retries or pays anything, and never navigates on its own. */
export function LegacyRedemptionConfirmation({ bookingId, businessId, packageProgressId, businessName, onClose }: {
  bookingId: string; businessId: string; packageProgressId: string; businessName?: string; onClose: () => void;
}) {
  const actor = useAuthStore((state) => state.user?.id);
  const epoch = useAuthStore((state) => state.cacheEpoch);
  const query = useQuery({
    queryKey: ["legacyRedemptionConfirmation", actor, epoch, bookingId],
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: async () => {
      const booking = await bookingsApi.getDetailForCustomer(bookingId);
      if (booking.id !== bookingId || booking.businessId !== businessId ||
        !booking.serviceLines.some((line) => line.packageProgressId === packageProgressId))
        throw Error("Booked session association unavailable");
      return booking;
    },
  });
  return <div className="fixed inset-0 z-[300] overflow-y-auto bg-[#FCFAF9] px-4 font-poppins" role="dialog" aria-modal="true" aria-label="Package session booked">
    <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-4 py-6">
      {query.data ? <ConfirmedStep booking={query.data} businessName={businessName} /> : <section className="w-full space-y-4 rounded-2xl border border-[#C6C6CB] bg-white p-5 sm:p-8" aria-busy={query.isFetching}>
        <p role={query.isError ? "alert" : "status"}>{query.isError
          ? "Your session was booked, but its details could not be loaded for display. Retry, or find it in My Bookings; do not book it again."
          : "Loading your booked session…"}</p>
        {query.isError && <button type="button" className={packageSecondaryCta} disabled={query.isFetching} onClick={() => void query.refetch()}>Retry booking details</button>}
      </section>}
      <button type="button" className="min-h-11 font-semibold text-[#2E9DA7] underline" onClick={onClose}>← Back to package</button>
    </div>
  </div>;
}
