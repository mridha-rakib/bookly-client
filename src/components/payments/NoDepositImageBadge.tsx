/** Shared Home image overlay, using the existing ServiceCard badge dimensions and tokens. */
export default function NoDepositImageBadge() {
  return <span data-no-deposit-badge className="absolute bottom-[8px] sm:bottom-[12px] left-[8px] sm:left-[12px] px-2 py-0.5 sm:w-[152px] sm:h-[22px] bg-[#2E9DA7] text-white flex items-center justify-center gap-0.5 rounded-full text-[9px] sm:text-xs font-medium shadow-sm z-10 whitespace-nowrap">
    No Deposit Needed
    <svg aria-hidden="true" className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white shrink-0 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
  </span>;
}
