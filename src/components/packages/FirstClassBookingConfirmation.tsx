"use client";
import { useQuery } from "@tanstack/react-query";
import ConfirmedStep from "@/app/venue/components/ConfirmedStep";
import { bookingsApi } from "@/lib/api/bookings";
import { packageViewsApi } from "@/lib/api/package-views";
import { useBusinessCatalogQuery } from "@/lib/catalog/hooks";
import { useAuthStore } from "@/lib/auth/store";
import { packageSecondaryCta } from "./package-cta";

/** Receives only canonical completion IDs, then reads existing owned endpoints. It cannot
 * create, pay, retry or grant an entitlement, and never performs automatic navigation. */
export function FirstClassBookingConfirmation({ businessId, progressId, bookingIds, primaryBookingId, kind, classification }: {
  businessId: string; progressId: string; bookingIds: string[]; primaryBookingId?: string;
  kind: "PURCHASE" | "REDEMPTION"; classification?: "FIRST" | "RETURNING";
}) {
  const actor = useAuthStore((state) => state.user?.id);
  const epoch = useAuthStore((state) => state.cacheEpoch);
  const catalog = useBusinessCatalogQuery(businessId);
  const query = useQuery({
    queryKey: ["packageConfirmation", actor, epoch, businessId, progressId, kind, primaryBookingId, bookingIds],
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: async () => {
      if (!bookingIds.length || new Set(bookingIds).size !== bookingIds.length || (primaryBookingId && !bookingIds.includes(primaryBookingId))) throw Error("Canonical appointment references unavailable");
      const [records, owned] = await Promise.all([Promise.all(bookingIds.map((id) => bookingsApi.getDetailForCustomer(id))), packageViewsApi.owned(progressId)]);
      const pkg = owned.packages.find((item) => item.id === progressId);
      if (!pkg || pkg.businessId !== businessId || pkg.purchaseCompletion !== "VERIFIED" || (kind === "PURCHASE" && primaryBookingId && pkg.originBookingId !== primaryBookingId)) throw Error("Owned Package verification unavailable");
      for (let index = 0; index < records.length; index++) {
        const booking = records[index]!;
        if (booking.id !== bookingIds[index] || booking.businessId !== businessId ||
          !pkg.sessions.some((session) => session.bookingId === booking.id) ||
          !booking.serviceLines.some((line) => line.packageProgressId === progressId && line.packageItemId && line.packageRole === kind)) throw Error("Owned appointment association unavailable");
      }
      // Business name is supplementary. A catalog outage never fabricates an address or
      // erases a verified Booking; all appointment/financial data above is persisted readback.
      const primary = primaryBookingId ? records.find((record) => record.id === primaryBookingId)! : records[0]!;
      return { primary, others: records.filter((record) => record.id !== primary.id), pkg };
    },
  });
  if (!query.data) return <section className="space-y-4 rounded-2xl border border-[#C6C6CB] bg-white p-5 sm:p-8" aria-label="Confirmed appointment readback" aria-busy={query.isFetching}>
    <p role={query.isError ? "alert" : "status"}>{query.isError ? "Your completed operation is retained, but its appointment details could not be verified for display. Retry the details read; do not purchase again." : "Loading your confirmed appointment details…"}</p>
    {query.isError && <button type="button" className={packageSecondaryCta} disabled={query.isFetching} onClick={() => void query.refetch()}>Retry confirmation details</button>}
  </section>;
  return <><ConfirmedStep booking={query.data.primary} additionalBookings={query.data.others} businessName={catalog.data?.business.name}
    purchasedPackage={{ id: progressId, name: query.data.pkg.name, bundlePriceCents: query.data.pkg.bundlePriceCents, totalSessions: query.data.pkg.items.reduce((sum, item) => sum + item.total, 0), kind, ...(classification ? { classification } : {}) }} />
    {query.isError && <p role="status">The latest confirmation details could not be refreshed. Showing the last verified readback.</p>}</>;
}
