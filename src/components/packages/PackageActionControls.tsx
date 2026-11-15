"use client";
import { invalidateBusinessBookingViews } from "@/lib/bookings/dashboard-cache";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { formatBookingDate, formatBookingTimeRange } from "@/lib/bookings/format";
import { packagesApi } from "@/lib/api/packages";
import { useAuthStore } from "@/lib/auth/store";
import { useBusinessPackageDetailQuery, usePackageDetailQuery } from "@/lib/packages/hooks";

export default function PackageActionControls({
  businessId,
  packageId,
}: {
  businessId: string;
  packageId: string;
}) {
  const role = useAuthStore((state) => state.user?.role);
  const cache = useQueryClient();
  const [action, setAction] = useState<"future" | "terminate" | null>(null);
  const submitting = useRef(false);
  const permitted = role === "CUSTOMER" || role === "BUSINESS_OWNER" || role === "SUPERVISOR";
  const customerQuery = usePackageDetailQuery(packageId, {
    enabled: role === "CUSTOMER",
    refetchOnMount: false,
  });
  const businessQuery = useBusinessPackageDetailQuery(businessId, packageId, {
    enabled: role === "BUSINESS_OWNER" || role === "SUPERVISOR",
    refetchOnMount: false,
  });
  const query = role === "CUSTOMER" ? customerQuery : businessQuery;
  const mutation = useMutation({
    mutationFn: (kind: "future" | "terminate") => kind === "future"
      ? packagesApi.cancelFuture(businessId, packageId)
      : packagesApi.terminate(businessId, packageId),
    onSuccess: () => {
      setAction(null);
      void cache.invalidateQueries({ queryKey: ["packages"] });
      void invalidateBusinessBookingViews(cache, businessId);
      void cache.invalidateQueries({ queryKey: ["customerBookings"] });
    },
    onSettled: () => { submitting.current = false; },
  });
  if (!permitted) return null;
  if (query.isError) return <div role="alert" className="rounded-lg border p-4 text-sm">Package actions could not be loaded. <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="underline disabled:opacity-50">{query.isFetching ? "Retrying..." : "Retry"}</button></div>;
  if (!query.data) return <p role="status" className="rounded-lg border p-4 text-sm">Loading package actions...</p>;
  const pkg = query.data;
  const refund = pkg.voidRefundSettlement;
  if (pkg.status === "VOIDED") {
    return (
      <div className="rounded-lg border p-4 text-sm">
        <p>Package cancelled. No sessions are available to schedule.</p>
        {role !== "SUPERVISOR" && <p>Refund: {refund ? refund.status.toLowerCase() : "none required"}.</p>}
      </div>
    );
  }
  const upcoming = pkg.sessions.filter((entry) => entry.booking?.status === "UPCOMING");
  const affected = action === "future"
    ? upcoming.filter((entry) => entry.bookingId !== pkg.originBookingId)
    : upcoming;
  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => { mutation.reset(); setAction("future"); }} className="rounded border px-3 py-2">
          Cancel future scheduled appointments
        </button>
        {role !== "SUPERVISOR" && (
          <button type="button" onClick={() => { mutation.reset(); setAction("terminate"); }} className="rounded border border-red-200 px-3 py-2 text-red-700">
            Cancel entire package
          </button>
        )}
      </div>
      {action && (
        <div role="dialog" aria-label={action === "future" ? "Cancel future appointments" : "Cancel entire package"} className="mt-4 space-y-3">
          <p>{action === "future"
            ? "Only future appointments after the purchase session will be cancelled. Your package remains usable."
            : "The package will be cancelled, future appointments resolved, and remaining entitlement will no longer be usable. Started appointments and pending no-shows must be resolved first. Refunds follow the recorded payment and cancellation rules."}</p>
          <p>Upcoming appointments below; the server confirms which are still eligible:</p>
          <ul>
            {affected.map((entry) => (
              <li key={entry.bookingId}>
                Session {entry.sessionIndex}: {entry.booking
                  ? `${formatBookingDate(entry.booking.schedule.startAt, entry.booking.schedule.timezone)} ${formatBookingTimeRange(entry.booking.schedule)}`
                  : "Schedule unavailable"}
              </li>
            ))}
          </ul>
          {mutation.error && <p role="alert" className="text-red-700">{mutation.error.message}</p>}
          <button type="button" disabled={mutation.isPending} onClick={() => { if (submitting.current) return; submitting.current = true; mutation.mutate(action); }} className="rounded bg-black px-3 py-2 text-white">
            {mutation.isPending ? "Cancelling…" : "Confirm cancellation"}
          </button>
          <button type="button" disabled={mutation.isPending} onClick={() => setAction(null)} className="ml-3">
            Keep package and appointments
          </button>
        </div>
      )}
    </div>
  );
}
