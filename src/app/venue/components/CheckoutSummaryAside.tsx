"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, Clock01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";

import type { BookingCreationPreview } from "@/lib/api/bookings";
import type { CatalogBusiness } from "@/lib/api/catalog";
import { formatBookingDate, formatBookingMoney, formatBookingTimeRange } from "@/lib/bookings/format";

export type WizardStep = "addons" | "professionals" | "time" | "payment" | "confirmed";

interface CheckoutSummaryAsideProps {
  bookingStep: WizardStep | null;
  business?: CatalogBusiness;
  preview?: BookingCreationPreview;
  isPreviewLoading?: boolean;
  previewError?: boolean;
  showPolicy: boolean;
  setShowPolicy: (val: boolean) => void;
  onContinue: () => void;
  canContinue: boolean;
  isSubmitting?: boolean;
  submitError?: string;
}

export default function CheckoutSummaryAside({
  bookingStep,
  business,
  preview,
  isPreviewLoading,
  previewError,
  showPolicy,
  setShowPolicy,
  onContinue,
  canContinue,
  isSubmitting,
  submitError,
}: CheckoutSummaryAsideProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileSummaryExpanded, setIsMobileSummaryExpanded] = useState(false);
  const [showStickyFooter, setShowStickyFooter] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const handleScroll = () => {
      const asideEl = document.getElementById("wizard-aside");
      if (asideEl) {
        const rect = asideEl.getBoundingClientRect();
        setShowStickyFooter(rect.height > 0 && rect.bottom < 100);
      }
    };
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      setShowStickyFooter(false);
    };
  }, [isMobile, preview]);

  const financials = preview?.financials;
  const serviceLine = preview?.serviceLines[0];
  const buttonLabel = bookingStep === "payment" ? (isSubmitting ? "Confirming…" : "Confirm") : "Continue →";

  const renderPriceBreakdown = () => (
    <div className="border-t border-[#E5E5E5] pt-4 flex flex-col w-full text-sm font-medium text-[#1C1B1C]">
      <div className="flex justify-between items-center py-2.5">
        <span>Subtotal</span>
        <span>
          {financials
            ? formatBookingMoney(financials.servicesSubtotalCents + financials.addonsSubtotalCents + financials.travelFeeCents)
            : "—"}
        </span>
      </div>

      <div className="border-t border-[#E5E5E5] w-full" />

      <div className="flex justify-between items-center py-2.5 relative">
        <div className="flex items-center gap-1.5">
          <span>Deposit due now</span>
          <div className="relative group">
            <button type="button" className="text-neutral-400 hover:text-neutral-600 cursor-pointer flex items-center">
              <HugeiconsIcon icon={InformationCircleIcon} size={16} />
            </button>
            <div className="absolute bottom-full right-[-80px] sm:right-[-40px] mb-3 hidden group-hover:flex w-[290px] sm:w-[420px] md:w-[480px] bg-white border border-neutral-200 shadow-2xl rounded-xl p-5 gap-2.5 z-50 text-left font-inter text-[14.5px] leading-[22px] text-[#666666] items-start transition-opacity duration-200">
              <HugeiconsIcon icon={InformationCircleIcon} size={22} className="text-black shrink-0 mt-0.5" />
              <span>
                Charged now to secure your slot — 20% of the service price, minimum €5, maximum €35. Deducted from your total at the venue.
              </span>
            </div>
          </div>
        </div>
        <span>{financials ? formatBookingMoney(financials.depositCents) : "—"}</span>
      </div>

      <div className="border-t border-[#E5E5E5] w-full" />

      <div className="flex justify-between items-center text-base font-semibold py-2.5">
        <span>Balance due at venue</span>
        <span>{financials ? formatBookingMoney(financials.balanceDueCents) : "—"}</span>
      </div>
    </div>
  );

  const renderPolicy = () => (
    <div className="flex flex-col w-full">
      <div
        onClick={() => setShowPolicy(!showPolicy)}
        className="border-t border-b border-neutral-200 py-4 flex justify-between items-center text-xs font-semibold text-[#4E5F78] hover:bg-neutral-50 transition-colors cursor-pointer px-1 w-full"
      >
        <span>Payment & Cancellation Policy</span>
        <span className="text-xs transition-transform duration-200">{showPolicy ? "▲" : "▼"}</span>
      </div>

      {showPolicy && (
        <div className="bg-[#FFFFFF] border border-neutral-200 rounded-xl p-5 mt-3 flex flex-col gap-3 font-inter text-[#757575] text-[13.9px] leading-relaxed w-full">
          <p>
            A {financials ? formatBookingMoney(financials.depositCents) : "deposit"} is charged now to secure your
            appointment and will be deducted from your total service cost.
          </p>
          <p>
            You will pay the remaining {financials ? formatBookingMoney(financials.balanceDueCents) : ""} at the
            venue by cash or card.
          </p>
          <p>Payment is processed securely via Stripe. Your card is also stored for the Business&apos;s cancellation/no-show policy below.</p>
          <p className="pt-2 border-t border-neutral-100 text-[12px] leading-normal italic">
            Cancellation and no-show fees, if any, are set by {business?.name ?? "this Business"} and are calculated
            based on the full service price, not the deposit amount.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside id="wizard-aside" className="w-full lg:w-[537px] bg-white border border-neutral-200 rounded-xl p-4 sm:p-8 flex flex-col gap-5 lg:sticky lg:top-28 order-first lg:order-last">
        {/* Business Overview Header */}
        <div className="flex items-center gap-4 border-b border-[#E5E5E5] pb-5">
          <div className="w-16 h-16 bg-neutral-200 rounded overflow-hidden relative shrink-0">
            <Image src="/image/imgOfService.png" alt={business?.name ?? "Business"} fill className="object-cover" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <h3 className="font-semibold text-base text-black truncate">{business?.name ?? "—"}</h3>
            <span className="text-xs text-[#4E5F78] truncate">
              {business ? `${business.address.streetName} ${business.address.streetNumber}, ${business.address.area}` : ""}
            </span>
          </div>
        </div>

        {/* Selected Schedule row */}
        {(bookingStep === "time" || bookingStep === "payment") && preview?.schedule ? (
          <div className="flex flex-col gap-3 border-b border-[#E5E5E5] pb-5 font-inter">
            <div className="flex items-center gap-3">
              <HugeiconsIcon icon={Calendar03Icon} size={20} className="text-[#4E5F78]" />
              <span className="text-sm font-semibold text-[#1C1B1C]">
                {formatBookingDate(preview.schedule.startAt, preview.schedule.timezone)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <HugeiconsIcon icon={Clock01Icon} size={20} className="text-[#4E5F78]" />
              <span className="text-sm font-semibold text-[#1C1B1C]">{formatBookingTimeRange(preview.schedule)}</span>
            </div>
          </div>
        ) : null}

        {/* Booking Item Summary Details */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <h4 className="font-semibold text-sm text-[#1C1B1C] truncate">
                {serviceLine?.serviceSnapshot.name ?? (isPreviewLoading ? "Loading…" : "—")}
              </h4>
              {serviceLine ? (
                <span className="text-xs text-[#4E5F78]">{serviceLine.serviceSnapshot.durationMin} min</span>
              ) : null}
            </div>
            <span className="font-semibold text-sm text-[#1C1B1C] shrink-0">
              {serviceLine ? formatBookingMoney(serviceLine.amountCents) : "—"}
            </span>
          </div>

          {serviceLine && serviceLine.addons.length > 0 ? (
            <div className="flex justify-between items-start gap-4 border-t border-[#E5E5E5] pt-4">
              <div className="flex flex-col gap-1 min-w-0">
                <h4 className="font-semibold text-sm text-[#1C1B1C]">Add-ons</h4>
                <p className="text-xs text-[#4E5F78] leading-relaxed">
                  {serviceLine.addons.map((a) => `${a.name} (${formatBookingMoney(a.priceCents)})`).join(" • ")}
                </p>
              </div>
              <span className="font-semibold text-sm text-[#1C1B1C] shrink-0">
                {formatBookingMoney(serviceLine.addons.reduce((sum, a) => sum + a.priceCents, 0))}
              </span>
            </div>
          ) : null}

          {serviceLine?.staffSnapshot ? (
            <div className="flex justify-between items-center border-t border-[#E5E5E5] pt-4">
              <span className="text-xs font-semibold text-[#1C1B1C]">Selected Professional</span>
              <span className="text-xs font-bold text-[#2BB54F]">
                {[serviceLine.staffSnapshot.firstName, serviceLine.staffSnapshot.lastName].filter(Boolean).join(" ")}
              </span>
            </div>
          ) : null}
        </div>

        {renderPriceBreakdown()}
        {renderPolicy()}

        {previewError ? (
          <p className="text-xs text-rose-600 font-medium">
            Couldn&apos;t calculate your total. Please go back and try again.
          </p>
        ) : null}
        {submitError ? <p className="text-xs text-rose-600 font-medium">{submitError}</p> : null}

        <button
          onClick={onContinue}
          disabled={!canContinue || isSubmitting}
          className="w-full h-12 bg-[#2E9DA7] text-white font-poppins font-semibold text-base rounded-[12px] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-sm"
        >
          <span>{buttonLabel}</span>
        </button>
      </aside>

      {/* Sticky Bottom Drawer for Mobile Summary */}
      {showStickyFooter && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-neutral-200 shadow-[0px_-4px_16px_rgba(0,0,0,0.15)] transition-all duration-300">
          {isMobileSummaryExpanded && (
            <div className="p-6 max-h-[75vh] overflow-y-auto border-b border-neutral-100 flex flex-col gap-6 bg-white font-inter">
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <h2 className="font-semibold text-2xl text-[#0D0D0D]">Book a visit</h2>
                </div>
                <button
                  onClick={() => setIsMobileSummaryExpanded(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black font-bold text-xs"
                >
                  ✕
                </button>
              </div>
              {renderPriceBreakdown()}
              {renderPolicy()}
            </div>
          )}

          <div className="p-4 flex items-center justify-between gap-4">
            <button
              onClick={() => setIsMobileSummaryExpanded(!isMobileSummaryExpanded)}
              className="flex flex-col items-start justify-center min-w-0 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-[#0D0D0D]">
                  {financials ? formatBookingMoney(financials.depositCents) : "—"}
                </span>
                <svg
                  className={`w-5 h-5 text-neutral-500 transition-transform duration-300 ${isMobileSummaryExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </div>
              <span className="text-xs text-[#757575] truncate">Due now</span>
            </button>

            <button
              onClick={onContinue}
              disabled={!canContinue || isSubmitting}
              className="flex-1 max-w-[200px] h-12 bg-[#2E9DA7] text-white font-poppins font-semibold text-base rounded-[12px] hover:opacity-95 disabled:opacity-50 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <span>{buttonLabel}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
