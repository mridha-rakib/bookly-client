import type { PackageProgress, PackageProgressSessionStatus } from "@/lib/api/packages";

export const PACKAGE_STATUS_PRESENTATION: Record<
  PackageProgress["status"],
  { label: string; className: string }
> = {
  ACTIVE: { label: "Active", className: "bg-[#DFFDDF] text-[#176117]" },
  AWAITING_BALANCE: { label: "Balance due", className: "bg-[#FFF3CD] text-[#8A6D0B]" },
  DEPLETED: { label: "All sessions used", className: "bg-neutral-100 text-neutral-600" },
  VOIDED: { label: "Refunded", className: "bg-neutral-100 text-neutral-600" },
};

export const PACKAGE_SESSION_STATUS_PRESENTATION: Record<
  PackageProgressSessionStatus,
  { label: string; className: string; description: string }
> = {
  SCHEDULED: {
    label: "Scheduled",
    className: "bg-[#CFE1FE] text-[#091C32]",
    description: "This appointment is scheduled.",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-[#CFFED6] text-[#093213]",
    description: "This package session was completed.",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-[#F1EDED] text-[#45474B]",
    description: "This appointment was cancelled and remains in your history.",
  },
  FORFEITED: {
    label: "Forfeited",
    className: "bg-[#FEF8CF] text-[#6B4F00]",
    description: "This session was consumed under the cancellation or no-show policy.",
  },
};

/** Convenience-only visibility hint. The server remains authoritative when the request runs. */
export const isLikelyVoidEligible = (pkg: PackageProgress): boolean =>
  pkg.status !== "VOIDED" &&
  !pkg.sessions.some(
    (session) => session.status === "COMPLETED" || session.status === "FORFEITED",
  );

