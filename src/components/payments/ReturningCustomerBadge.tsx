/** Eligibility comes from the current Business quote, never local Booking history or amount alone. */
export default function ReturningCustomerBadge({ returning, upfrontCents }: { returning: boolean; upfrontCents?: number }) {
  if (!returning || upfrontCents !== 0) return null;
  return <span role="status" className="inline-flex items-center gap-1 rounded-full bg-[#2E9DA7] px-3 py-1 text-xs font-medium text-white">
    Returning Customer — No upfront deposit required
    <svg aria-hidden="true" className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
  </span>;
}
