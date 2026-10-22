"use client";

import { useAuthStore } from "@/lib/auth/store";
import { useBusinessPackageDetailQuery } from "@/lib/packages/hooks";
import PackageAppointmentHistory from "./PackageAppointmentHistory";

export default function BusinessPackageAppointmentHistory({
  businessId, packageId, currentBookingId, onViewBooking,
}: {
  businessId: string;
  packageId: string;
  currentBookingId: string;
  onViewBooking?: (bookingId: string) => void;
}) {
  const role = useAuthStore(state => state.user?.role);
  const permitted = role === "BUSINESS_OWNER" || role === "SUPERVISOR";
  const query = useBusinessPackageDetailQuery(businessId, packageId, { enabled: permitted });
  if (!permitted) return null;
  return (
    <div className="border-t border-[#DDD2F7] pt-4 font-poppins">
      <h2 className="text-sm font-semibold text-[#1C1B1C]">Appointment history</h2>
      <p className="mt-1 mb-4 text-xs leading-relaxed text-[#675A82]">
        Every scheduled appointment remains visible, including cancelled attempts. Recorded session indices may repeat.
        {query.data?.status === "VOIDED"
          ? " Historical remaining sessions cannot be scheduled."
          : " Remaining sessions above are unscheduled credits, not numbered appointment slots."}
      </p>
      {query.isPending ? (
        <p role="status" className="text-sm text-[#73726D]">Loading package appointments…</p>
      ) : query.isError ? (
        <div role="alert" className="rounded-xl bg-white p-4 text-sm text-[#5F5E5A]">
          <p>Couldn&apos;t load package appointments.</p>
          <button type="button" onClick={() => void query.refetch()} className="mt-2 rounded-lg border border-[#C6C6CB] px-4 py-2 font-semibold text-[#020305] hover:bg-neutral-50">Try again</button>
        </div>
      ) : query.data ? (
        <PackageAppointmentHistory sessions={query.data.sessions} totalSessions={query.data.totalSessions} currentBookingId={currentBookingId} onViewBooking={onViewBooking} />
      ) : null}
    </div>
  );
}
