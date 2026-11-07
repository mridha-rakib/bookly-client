"use client";

import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

export type OnboardingStep = { id: string; label: string };
export const bookingContentClass = "flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-16 py-10 flex flex-col lg:flex-row gap-8 xl:gap-16 items-start relative";
export const bookingMainClass = "min-w-0 flex-1 w-full flex flex-col gap-6 order-first";

/** The Venue wizard's navigation and grid, shared without sharing transaction state. */
export function BookingOnboardingHeader({ steps, current, onBack, onClose, onStep }: {
  steps: OnboardingStep[]; current: string; onBack: () => void; onClose: () => void;
  onStep?: (id: string) => void;
}) {
  const currentIndex = steps.findIndex((step) => step.id === current);
  return <header className="w-full bg-[#FCFAF9] border-b border-neutral-200 py-6 px-4 md:px-16 sticky top-0 z-30">
    <div className="flex items-center gap-3 sm:gap-5 w-full max-w-[1440px] mx-auto">
      <button type="button" onClick={onBack} className="w-11 h-11 bg-[#E2E2E0] rounded flex items-center justify-center text-[#141B34] hover:bg-neutral-300 shrink-0" aria-label="Go back"><HugeiconsIcon icon={ArrowLeft01Icon} size={24} /></button>
      <nav aria-label="Booking progress" className="min-w-0 flex-1">
        <p className="sm:hidden text-sm text-[#45474B]">
          Step {Math.max(currentIndex, 0) + 1} of {steps.length} · <span className="font-semibold text-[#1C1B1C]">{steps[currentIndex]?.label}</span>
        </p>
        <ol className="hidden sm:flex items-center gap-2 lg:gap-3 text-sm font-medium whitespace-nowrap py-1 overflow-x-auto">
          {steps.map((step, index) => {
            const state = index === currentIndex ? "current" : index < currentIndex ? "done" : "upcoming";
            return <li key={step.id} className="flex items-center gap-2 lg:gap-3">
              {index > 0 && <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="text-[#767676] shrink-0" aria-hidden="true" />}
              <button type="button" aria-current={state === "current" ? "step" : undefined} disabled={!onStep}
                onClick={() => onStep?.(step.id)}
                className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 min-h-9 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] ${state === "current"
                  ? "bg-[#1C1B1C] text-white font-semibold" : state === "done" ? "text-[#1C1B1C] enabled:hover:bg-neutral-200" : "text-[#5F5E5A]"} disabled:cursor-default`}>
                <span aria-hidden="true" className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${state === "current"
                  ? "bg-white text-[#1C1B1C]" : state === "done" ? "bg-[#2E9DA7] text-white" : "border border-[#ACAAB4] text-[#5F5E5A]"}`}>{state === "done" ? "✓" : index + 1}</span>
                <span data-step-label>{step.label}</span>
                {state === "done" && <span className="sr-only"> (completed)</span>}
              </button>
            </li>;
          })}
        </ol>
      </nav>
      <button type="button" onClick={onClose} className="shrink-0 text-neutral-500 hover:text-black p-2" aria-label="Close modal"><HugeiconsIcon icon={Cancel01Icon} size={24} /></button>
    </div>
  </header>;
}

export default function BookingOnboarding({ children, summary, ...header }: Parameters<typeof BookingOnboardingHeader>[0] & { children: ReactNode; summary: ReactNode }) {
  return <section className="min-h-screen bg-[#FCFAF9] font-poppins pb-28 lg:pb-8">
    <BookingOnboardingHeader {...header} />
    <div className={bookingContentClass}><div className={bookingMainClass}>{children}</div>{summary}</div>
  </section>;
}
