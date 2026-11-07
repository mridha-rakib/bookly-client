"use client";

import { useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, CancelCircleIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

import type { BookingCreationPreview } from "@/lib/api/bookings";
import type { CatalogBusiness } from "@/lib/api/catalog";
import { formatBookingMoney } from "@/lib/bookings/format";

type Policy = NonNullable<BookingCreationPreview["cancellationPolicy"]>;
type Tier = Policy["tiers"][number]["tier"];

/** The approved Normal Booking windows the server classifies new Bookings against
 * (classifyNormalCancellationTier). More than 24 hours is always free; the Business sets the rest. */
const WINDOWS: Array<{ tier: Tier | "MORE_THAN_24_HOURS"; label: string; feeLabel: string; from?: number; until?: number }> = [
  // The server treats exactly 24 hours before as free (>= 24 h), hence "24 hours or more".
  { tier: "MORE_THAN_24_HOURS", label: "24 hours or more", feeLabel: "", until: 24 },
  { tier: "BETWEEN_12_AND_24_HOURS", label: "12 to less than 24 hours", feeLabel: "cancellation fee", from: 24, until: 12 },
  { tier: "BETWEEN_2_AND_12_HOURS", label: "2 to less than 12 hours", feeLabel: "late-cancellation fee", from: 12, until: 2 },
  { tier: "UNDER_2_HOURS", label: "Less than 2 hours", feeLabel: "late-cancellation fee", from: 2 },
];
const HOUR = 3_600_000;

type Tone = "free" | "fee" | "noShow";
const icons = { free: CheckmarkCircle02Icon, fee: Alert02Icon, noShow: CancelCircleIcon } as const;
const iconTone = { free: "text-[#1E7B37]", fee: "text-[#9A5B00]", noShow: "text-[#B42318]" } as const;

function PolicyRow({ tone, title, when, children }: { tone: Tone; title: string; when?: string; children: ReactNode }) {
  return <li className="flex items-start gap-3 py-2.5">
    <HugeiconsIcon icon={icons[tone]} size={20} className={`mt-0.5 shrink-0 ${iconTone[tone]}`} aria-hidden="true" />
    <div className="min-w-0 space-y-0.5">
      <p className="font-semibold text-[#1C1B1C]">{title}</p>
      <p>{children}</p>
      {when && <p className="text-sm text-[#5F5E5A]">{when}</p>}
    </div>
  </li>;
}

interface BookingPolicyDetailsProps {
  business?: CatalogBusiness;
  /** Present only when it describes the current selections (never a stale or failed quote). */
  preview?: BookingCreationPreview;
  isPackagePurchase?: boolean;
}

/** The Payment & Cancellation Policy for Normal Service and legacy Package Deal bookings. Rates
 * come from the Business policy the server returns: the quote's own copy once quoted, otherwise
 * the catalogue's current copy. Nothing here calculates a fee; amounts are the server's figures. */
export default function BookingPolicyDetails({ business, preview, isPackagePurchase }: BookingPolicyDetailsProps) {
  const businessName = business?.name ?? preview?.business.name ?? "this Business";
  // A quote that omits the policy means the Business has none (the server then charges no fee).
  const policy: Policy | null | undefined = preview ? preview.cancellationPolicy ?? null : business?.cancellationPolicy;
  const nothingDueNow = preview?.dueNowCents === 0;
  const appliedPromo = preview?.promo;
  const basisCents = preview?.financials.eligiblePlatformFeeBasisCents;
  const timezone = preview?.schedule.timezone ?? business?.timezone;
  const startMs = preview ? Date.parse(preview.schedule.startAt) : undefined;
  const at = (ms: number) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(ms));
  // Captured once per mount: window labels are display guidance, never a fee decision.
  const [now] = useState(() => Date.now());
  const whenFor = (window: (typeof WINDOWS)[number]) => {
    if (startMs === undefined || !timezone) return undefined;
    const end = window.until !== undefined ? startMs - window.until * HOUR : startMs;
    if (now >= end) return "Already passed for this appointment time.";
    if (window.from === undefined) return `Until ${at(end)} (${timezone}).`;
    return `From ${at(startMs - window.from * HOUR)} until ${at(end)} (${timezone}).`;
  };
  // Refund of the deposit actually paid, for a customer cancelling more than 24 hours ahead.
  const refundLine = !preview ? "Any deposit you paid online is refunded in full."
    : preview.dueNowCents > 0 ? `Your deposit of ${formatBookingMoney(preview.dueNowCents)} is refunded in full.` : "";
  const basis = basisCents !== undefined
    ? `of ${formatBookingMoney(basisCents)} — services and add-ons${appliedPromo ? " after your promo discount" : ""}, excluding travel`
    : "of the booking price — services and add-ons after any discount, excluding travel";

  return <div className="flex flex-col gap-5">
    <section aria-label="Payment information" className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-[#1C1B1C]">Payment</h3>
      {!preview ? <>
        <p>Your exact upfront payment and the amount due at the appointment are calculated with your quote.</p>
        <p>Your card is securely stored via Stripe for the Business&apos;s cancellation/no-show policy below.</p>
      </> : isPackagePurchase ? <>
        {nothingDueNow ? (
          <p>
            Nothing is charged online now. You will pay the full {formatBookingMoney(preview.balanceDueCents)} at the appointment. Your
            remaining sessions cannot be booked until the Business records this balance as fully paid.
          </p>
        ) : <>
          <p>
            The quoted upfront payment of {formatBookingMoney(preview.preTaxChargeCents)} is due
            now to secure your first session and is credited against the package&apos;s total cost.
          </p>
          <p>
            The remaining {formatBookingMoney(preview.balanceDueCents)} is due at the
            appointment. Your remaining sessions cannot be booked until the Business records this
            balance as fully paid.
          </p>
        </>}
        <p>{nothingDueNow
          ? "Your card is securely stored via Stripe for the Business's cancellation/no-show policy below."
          : "Payment is processed securely via Stripe. Your card is also stored for the Business's cancellation/no-show policy below."}</p>
      </> : <>
        {nothingDueNow ? (
          <p>Nothing is charged online now. You will pay the full {formatBookingMoney(preview.balanceDueCents)} at the appointment.</p>
        ) : <>
          <p>
            The quoted upfront payment of {formatBookingMoney(preview.preTaxChargeCents)} is due
            now to secure your appointment and is credited against your booking total.
          </p>
          <p>The remaining {formatBookingMoney(preview.balanceDueCents)} is due at the appointment.</p>
        </>}
        <p>{nothingDueNow
          ? "Your card is securely stored via Stripe for the Business's cancellation/no-show policy below."
          : "Payment is processed securely via Stripe. Your card is also stored for the Business's cancellation/no-show policy below."}</p>
      </>}
    </section>

    <section aria-label="Business cancellation policy" className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
      <h3 className="text-base font-semibold text-[#1C1B1C]">{businessName} cancellation policy</h3>
      {policy === undefined ? (
        <p>{businessName}&apos;s cancellation and no-show rates are shown here once they have loaded or with your quote.</p>
      ) : policy === null ? (
        <p>{businessName} has not set a cancellation policy, so no cancellation or no-show fee applies to this booking.{isPackagePurchase ? " Cancelling returns the session to your package balance." : ` Cancelling 24 hours or more before the appointment is free. ${refundLine}`}</p>
      ) : <>
        <p className="text-sm text-[#5F5E5A]">Based on how long before the appointment you cancel{timezone ? ` (times in ${timezone})` : ""}:</p>
        <ul className="divide-y divide-neutral-100">
          {WINDOWS.map((window) => {
            const title = `${window.label} before the appointment`;
            if (window.tier === "MORE_THAN_24_HOURS") return <PolicyRow key={window.tier} tone="free" title={title} when={whenFor(window)}>
              {isPackagePurchase ? "Free cancellation — the session returns to your package balance."
                : <>Free cancellation, no cancellation fee. {refundLine}</>}
            </PolicyRow>;
            const rule = policy.tiers.find((entry) => entry.tier === window.tier);
            const fee = rule?.mode === "PERCENTAGE" && rule.percentage !== undefined;
            if (isPackagePurchase) return <PolicyRow key={window.tier} tone={fee ? "fee" : "free"} title={title} when={whenFor(window)}>
              {fee ? "Late cancellation — the session is forfeited. No fee is charged." : "Free cancellation — the session returns to your package balance."}
            </PolicyRow>;
            return <PolicyRow key={window.tier} tone={fee ? "fee" : "free"} title={title} when={whenFor(window)}>
              {fee ? `${rule.percentage}% ${window.feeLabel} ${basis}.` : rule ? "Free cancellation, no cancellation fee." : "No rate is configured for this window, so no cancellation fee applies."}
            </PolicyRow>;
          })}
          <PolicyRow tone="noShow" title={isPackagePurchase ? "No-show" : `No-show: ${policy.noShowPercentage}%`}>
            {isPackagePurchase ? "Missing the appointment forfeits the session. No fee is charged." : `${policy.noShowPercentage}% no-show fee ${basis}.`}
          </PolicyRow>
        </ul>
      </>}
      {policy !== undefined && <ul className="mt-1 list-disc space-y-1.5 pl-5 text-sm">
        {!isPackagePurchase && policy !== null && <li>Any upfront payment already made counts towards a cancellation or no-show fee; only the remainder is charged to your saved card.</li>}
        <li>{isPackagePurchase
          ? "The package upfront payment is not refunded when you cancel a session; it stays credited to your package."
          : "If you cancel within 24 hours of the appointment, the upfront payment is not refunded; it counts towards any fee."} If {businessName} cancels the booking, the upfront payment is refunded in full.</li>
      </ul>}
    </section>

    <p className="border-t border-neutral-200 pt-3 text-sm leading-6">
      {isPackagePurchase
        ? "Cancelling a scheduled session on time returns it to your package balance with no fee. A late cancellation or a no-show forfeits that session — the lost session is the only penalty; no additional fee is charged on top."
        : <>Cancellation and no-show fees, if any, are set by {business?.name ?? preview?.business.name ?? "this Business"} and are calculated
          based on the {appliedPromo ? "booking price after your promo discount" : "full service price"}, not the deposit amount.</>}
    </p>
  </div>;
}
