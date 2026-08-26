"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";

interface NotAvailableForRoleProps {
  title: string;
  subtitle: string;
  message: string;
  detail: string;
}

/** Batch 19 — the shared honest empty-state shell for a whole dashboard tab that has no backend
 * capability for the current role (e.g. STAFF has no Client/Staff-management read access at all —
 * see client.route.ts/staff.route.ts's role gates). Same visual pattern DashboardCalendar/
 * DashboardBookingsList already use inline for their own no-businessId state, extracted here only
 * because it now needs to fill an entire tab rather than sit inside an existing list shell. */
export default function NotAvailableForRole({
  title,
  subtitle,
  message,
  detail,
}: NotAvailableForRoleProps) {
  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] select-none">
      <DashboardHeader title={title} subtitle={subtitle} />
      <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
        <span className="font-poppins text-sm font-semibold text-[#5F5E5A]">{message}</span>
        <span className="font-poppins text-xs text-[#ABAAA6] max-w-sm">{detail}</span>
      </div>
    </main>
  );
}
