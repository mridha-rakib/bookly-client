// Match VenueDetailsContent's sidebar Book now CTA. Disabled controls retain readable
// dark text on a pale tint of the same teal, rather than fading the entire button.
export const packagePrimaryCta = "min-h-12 px-5 py-3 bg-[#2E9DA7] border border-[#D5D7DA] text-white font-poppins font-medium text-base rounded-[12px] enabled:hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center justify-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] focus-visible:ring-offset-2 disabled:bg-[#2E9DA7]/20 disabled:text-[#0D0D0D] disabled:opacity-100 disabled:cursor-not-allowed disabled:shadow-none";

// Cancellation and alternative settlement states are secondary, not purchase CTAs.
export const packageSecondaryCta = "min-h-12 px-5 py-3 bg-white border border-[#C6C6CB] text-[#45474B] font-poppins font-medium text-sm rounded-[12px] enabled:hover:bg-neutral-50 transition-colors inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] focus-visible:ring-offset-2 disabled:bg-[#F5F4EE] disabled:cursor-not-allowed";
