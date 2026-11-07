"use client";

import React, { useEffect, useId, useState } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, Clock01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";

import BookingSelectionSummary, { type BookingSelection } from "./BookingSelectionSummary";
import BookingPolicyDetails from "./BookingPolicyDetails";
import ReturningCustomerBadge from "@/components/payments/ReturningCustomerBadge";
import type { RetainedPurchaseQuote } from "@/lib/api/package-consent";
import type { BookingCreationPreview } from "@/lib/api/bookings";
import type { CatalogBusiness } from "@/lib/api/catalog";
import { formatBookingDate, formatBookingMoney, formatBookingTimeRange } from "@/lib/bookings/format";

export type WizardStep = "addons" | "travel" | "professionals" | "time" | "payment" | "confirmed";

export type PromoInputStatus = "idle" | "applying" | "applied" | "error";

interface CheckoutSummaryAsideProps {
  bookingStep: WizardStep | null;
  selection?: BookingSelection;
  packageQuote?: RetainedPurchaseQuote;
  policyContent?: React.ReactNode;
  policyTitle?: string;
  hidePolicy?: boolean;
  hideContinue?: boolean;
  continueLabel?: string;
  /** True only for a Package Deal purchase (session 1) — approved rule: the deposit-now/
   * balance-at-venue mechanics are identical to a normal booking, but what unlocks and how
   * cancellation/no-show work afterwards is different enough that the generic copy below would
   * be misleading if left unchanged for this flow. Never affects normal booking copy. */
  isPackagePurchase?: boolean;
  /** Package Deal audit (Phase 1.5 info-clarity fix) — see ConfirmedStep's identical prop doc
   * comment for why this comes from the wizard's in-memory selection, not the preview response
   * (BookingCreationPreview.serviceLines[].serviceSnapshot carries no session-count field). */
  packageSessionsTotal?: number;
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
  promoCodeInput?: string;
  setPromoCodeInput?: (val: string) => void;
  promoStatus?: PromoInputStatus;
  promoErrorMessage?: string;
  onApplyPromo?: () => void;
  onRemovePromo?: () => void;
}

export default function CheckoutSummaryAside({
  bookingStep,
  selection, packageQuote, policyContent, policyTitle, hidePolicy, hideContinue, continueLabel,
  isPackagePurchase,
  packageSessionsTotal,
  business,
  preview: incomingPreview,
  isPreviewLoading,
  previewError,
  showPolicy,
  setShowPolicy,
  onContinue,
  canContinue,
  isSubmitting,
  submitError,
  promoCodeInput,
  setPromoCodeInput,
  promoStatus,
  promoErrorMessage,
  onApplyPromo,
  onRemovePromo,
}: CheckoutSummaryAsideProps) {
  const preview = isPreviewLoading || previewError ? undefined : incomingPreview;
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

  // A previous quote cannot describe selections currently being re-quoted.
  const financials = preview?.financials;
  const serviceLine = preview?.serviceLines[0];
  const buttonLabel = continueLabel ?? (bookingStep === "payment" ? (isSubmitting ? "Confirming…" : "Confirm") : "Continue →");
  const appliedPromo = preview?.promo;
  // P3 — a RETURNING purchase (normal or package) is €0 online; the server's own due-now figure
  // decides the wording, never a client-side classification or calculation.
  const nothingDueNow = preview?.dueNowCents === 0;

  const renderPromoField = () => {
    if (bookingStep !== "payment" || !setPromoCodeInput || !onApplyPromo) return null;
    return (
      <div className="flex flex-col gap-2 py-2.5">
        {promoStatus === "applied" && appliedPromo ? (
          <div className="flex items-center justify-between gap-2 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs font-semibold text-[#065F46] bg-white border border-[#A7F3D0] rounded px-1.5 py-0.5 shrink-0">
                {appliedPromo.code}
              </span>
              <span className="text-xs text-[#065F46] truncate">
                {appliedPromo.type === "PERCENTAGE" ? `${appliedPromo.value}% off booking price` : `${formatBookingMoney(appliedPromo.value)} off booking price`}
              </span>
            </div>
            <button
              type="button"
              onClick={onRemovePromo}
              className="text-xs font-semibold text-[#065F46] hover:underline cursor-pointer shrink-0"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCodeInput ?? ""}
              onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase().replace(/\s/g, ""))}
              placeholder="Promo code"
              disabled={promoStatus === "applying"}
              className="flex-1 min-w-0 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm font-inter focus:outline-none focus:border-[#2E9DA7] focus:bg-white transition-all text-[#1C1B1C]"
            />
            <button
              type="button"
              onClick={onApplyPromo}
              disabled={!promoCodeInput || promoStatus === "applying"}
              className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
            >
              {promoStatus === "applying" ? "Applying…" : "Apply"}
            </button>
          </div>
        )}
        {promoStatus === "error" && promoErrorMessage ? (
          <span className="text-xs text-rose-600 font-medium">{promoErrorMessage}</span>
        ) : null}
      </div>
    );
  };

  const pending = isPreviewLoading ? "Calculating..." : "Pending quote";
  const quoteRow = (label: string, cents: number, emphasis?: "total" | "due") => <div key={label}
    className={`flex justify-between items-center gap-4 py-2.5 border-b border-[#E5E5E5] last:border-b-0 ${emphasis === "due" ? "text-base font-semibold" : emphasis === "total" ? "font-semibold" : ""}`}>
    <span>{label}</span><span>{formatBookingMoney(cents)}</span>
  </div>;
  const renderPriceBreakdown = () => packageQuote ? (
    <section aria-label="Quoted Package amounts" className="border-t border-[#E5E5E5] pt-4 flex flex-col w-full text-sm font-medium text-[#1C1B1C]">
      <ReturningCustomerBadge returning={!isPreviewLoading && !previewError && packageQuote.financials.classification === "RETURNING"} upfrontCents={packageQuote.financials.requiredUpfrontCents} />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#E1F5EE] px-2.5 py-0.5 text-xs font-semibold text-[#245C4A]">Authoritative quote</span>
        <span className="rounded-full bg-[#F1EDED] px-2.5 py-0.5 text-xs font-semibold text-[#45474B]">{packageQuote.financials.classification}</span>
      </div>
      {quoteRow("Package total", packageQuote.financials.bundlePriceCents)}
      {quoteRow("Add-ons", packageQuote.financials.addonsCents)}
      {quoteRow("Travel fee", packageQuote.financials.travelCents)}
      {quoteRow("Booking total", packageQuote.financials.normalTotalCents, "total")}
      {quoteRow("Upfront payment", packageQuote.financials.requiredUpfrontCents)}
      {quoteRow("Due now", packageQuote.financials.requiredUpfrontCents, "due")}
      {quoteRow("Remaining at appointment", packageQuote.financials.manualVenueDuesCents)}
      <section aria-label="Calculated VAT information" className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-[#45474B]">
        <div className="flex justify-between items-start gap-3">
          <span>Calculated VAT — informational only</span>
          <span className="shrink-0">{packageQuote.tax?.status === "CALCULATED" ? formatBookingMoney(packageQuote.tax.taxCents) : "Unavailable"}</span>
        </div>
        <p className="mt-2">
          {packageQuote.tax?.status === "CALCULATED"
            ? packageQuote.tax.preTaxChargeCents === 0
              ? "Nothing is charged online in this checkout, so no VAT is calculated on an online payment."
              : `Calculated on the ${formatBookingMoney(packageQuote.tax.preTaxChargeCents)} upfront payment. Informational only — not charged in this checkout.`
            : "VAT could not be calculated for this quote. Nothing extra is charged; the amounts above are unchanged."}
        </p>
      </section>
      <p className="mt-3 text-sm text-[#45474B]">{packageQuote.financials.classification} · {packageQuote.timezone}</p>
      <p className="text-sm text-[#45474B]">Original quote deadline: {new Intl.DateTimeFormat("en-GB", {dateStyle:"medium",timeStyle:"short",timeZone:packageQuote.timezone}).format(new Date(packageQuote.expiresAt))}. Returning to review does not renew it.</p>
    </section>
  ) : (
    <div className="border-t border-[#E5E5E5] pt-4 flex flex-col w-full text-sm font-medium text-[#1C1B1C]">
      <ReturningCustomerBadge returning={preview?.isFirstBooking === false && (!business || preview.business.id === business.id)} upfrontCents={preview?.dueNowCents} />
      {/* Travel-fee transparency (info-clarity fix) — display only; the server-derived
          travelFeeCents already flows into Subtotal below exactly as before, this just breaks
          that one number out so a travel customer can see the surcharge, never double-counted. */}
      {financials && financials.travelFeeCents > 0 ? (
        <>
          <div className="flex justify-between items-center py-2.5">
            <span>Travel fee</span>
            <span>{formatBookingMoney(financials.travelFeeCents)}</span>
          </div>
          <div className="border-t border-[#E5E5E5] w-full" />
        </>
      ) : null}

      <div className="flex justify-between items-center py-2.5">
        <span>Subtotal</span>
        <span>
          {financials
            ? formatBookingMoney(financials.servicesSubtotalCents + financials.addonsSubtotalCents + financials.travelFeeCents)
            : pending}
        </span>
      </div>

      <div className="border-t border-[#E5E5E5] w-full" />

      {/* P2 — the promo lowers the booking price itself; every figure below is the server's
          post-promo value (never recomputed here). */}
      {appliedPromo && financials ? (
        <>
          <div className="flex justify-between items-center py-2.5 text-[#0CA678]">
            <span>Promo discount ({appliedPromo.code})</span>
            <span>-{formatBookingMoney(appliedPromo.discountCents)}</span>
          </div>
          <div className="border-t border-[#E5E5E5] w-full" />
        </>
      ) : null}

      <div className="flex justify-between items-center py-2.5">
        <span>Booking total</span>
        <span>{financials ? formatBookingMoney(financials.totalCents) : pending}</span>
      </div>

      <div className="border-t border-[#E5E5E5] w-full" />

      <div className="flex justify-between items-center py-2.5 relative">
        <div className="flex items-center gap-1.5">
          <span>Upfront payment</span>
          <div className="relative group">
            <button
              type="button"
              aria-label="About the upfront payment"
              className="text-neutral-400 hover:text-neutral-600 cursor-pointer flex items-center"
            >
              <HugeiconsIcon icon={InformationCircleIcon} size={16} />
            </button>
            <div className="absolute bottom-full right-[-80px] sm:right-[-40px] mb-3 hidden group-hover:flex w-[290px] sm:w-[420px] md:w-[480px] bg-white border border-neutral-200 shadow-2xl rounded-xl p-5 gap-2.5 z-50 text-left font-inter text-[14.5px] leading-[22px] text-[#666666] items-start transition-opacity duration-200">
              <HugeiconsIcon icon={InformationCircleIcon} size={22} className="text-black shrink-0 mt-0.5" />
              <span>
                {nothingDueNow
                  ? isPackagePurchase
                    ? "Nothing is due online for this package. The full amount remains due at the appointment, and the Business recording full settlement unlocks booking your remaining sessions."
                    : "Nothing is due online for this booking. The full amount remains due at the appointment."
                  : isPackagePurchase
                    ? "The quoted upfront payment secures your first session and is credited against the package total. The Business recording full settlement unlocks booking your remaining sessions."
                    : "The quoted upfront payment secures your slot and is credited against your booking total."}
              </span>
            </div>
          </div>
        </div>
        <span>{preview ? formatBookingMoney(preview.preTaxChargeCents) : pending}</span>
      </div>

      {renderPromoField()}

      <div className="border-t border-[#E5E5E5] w-full" />

      <div className="flex justify-between items-center text-base font-semibold py-2.5">
        <span>Due now</span>
        <span>{preview ? formatBookingMoney(preview.dueNowCents) : pending}</span>
      </div>

      <div className="border-t border-[#E5E5E5] w-full" />

      <div className="flex justify-between items-center py-2.5">
        <span>Remaining at appointment</span>
        <span>{preview ? formatBookingMoney(preview.balanceDueCents) : pending}</span>
      </div>

      <section aria-label="Calculated VAT information" className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-[#45474B]">
        <div className="flex justify-between items-start gap-3">
          <span>Calculated VAT — informational only</span>
          <span className="shrink-0">{preview?.taxMode === "PRE_ACTIVATION" ? formatBookingMoney(preview.taxCents) : "Not included in quote"}</span>
        </div>
        <p className="mt-2">
          {preview?.taxMode === "PRE_ACTIVATION"
            ? "Informational only — not charged in this checkout."
            : "Calculated VAT information is unavailable until a supported quote is obtained."}
        </p>
      </section>
    </div>
  );

  const policyId = useId();
  const renderPolicy = (placement: "aside" | "drawer") => (
    <div className="flex flex-col w-full">
      <button
        type="button" aria-expanded={showPolicy} aria-controls={`${policyId}-${placement}`}
        onClick={() => setShowPolicy(!showPolicy)}
        className="border-t border-b border-neutral-200 min-h-12 py-3 flex justify-between items-center gap-3 text-sm font-semibold text-[#1C1B1C] hover:bg-neutral-50 transition-colors cursor-pointer px-1 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7]"
      >
        <span>{policyTitle ?? "Payment & Cancellation Policy"}</span>
        <span aria-hidden="true" className="text-xs text-[#45474B] transition-transform duration-200">{showPolicy ? "▲" : "▼"}</span>
      </button>

      {showPolicy && (
        <div id={`${policyId}-${placement}`} className="bg-[#FFFFFF] border border-neutral-200 rounded-xl p-4 sm:p-5 mt-3 flex flex-col gap-3 font-inter text-[#45474B] text-sm sm:text-[15px] leading-7 w-full break-words">
          {policyContent ?? <BookingPolicyDetails business={business} preview={preview} isPackagePurchase={isPackagePurchase} />}
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside id="wizard-aside" className="min-w-0 w-full lg:w-[min(40%,537px)] lg:shrink-0 bg-white border border-neutral-200 rounded-xl p-4 sm:p-8 flex flex-col gap-5 lg:sticky lg:top-28 order-last">
        {/* Business Overview Header */}
        <div className="flex items-center gap-4 border-b border-[#E5E5E5] pb-5">
          <div className="w-16 h-16 bg-neutral-200 rounded overflow-hidden relative shrink-0">
            {business?.media?.find((item) => item.role === "PROFILE")?.url && <Image src={business.media.find((item) => item.role === "PROFILE")!.url} alt={business.name} fill className="object-cover" />}
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <h3 className="font-semibold text-base text-black break-words">{business?.name ?? "—"}</h3>
            <span className="text-xs text-[#4E5F78] break-words">
              {business ? `${business.address.streetName} ${business.address.streetNumber}, ${business.address.area}` : ""}
            </span>
          </div>
        </div>

        {selection && <BookingSelectionSummary selection={selection} />}
        {/* Selected Schedule row */}
        {!selection && (bookingStep === "time" || bookingStep === "payment") && preview?.schedule ? (
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
        {!selection && <div className="flex flex-col gap-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <h4 className="font-semibold text-sm text-[#1C1B1C] truncate">
                {serviceLine?.serviceSnapshot.name ?? (isPreviewLoading ? "Loading…" : "—")}
              </h4>
              {serviceLine ? (
                <span className="text-xs text-[#4E5F78]">
                  {isPackagePurchase
                    ? `${packageSessionsTotal ? `${packageSessionsTotal} sessions • ` : ""}${serviceLine.serviceSnapshot.durationMin} min per session`
                    : `${serviceLine.serviceSnapshot.durationMin} min`}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              {isPackagePurchase ? (
                <span className="text-[10px] font-semibold text-[#767676] uppercase tracking-wide">Package total</span>
              ) : null}
              <span className="font-semibold text-sm text-[#1C1B1C]">
                {serviceLine ? formatBookingMoney(serviceLine.amountCents) : "—"}
              </span>
            </div>
          </div>

          {isPackagePurchase && serviceLine ? (
            <p className="text-xs text-[#4E5F78] leading-relaxed border-t border-[#E5E5E5] pt-4">
              This booking schedules your first session. Remaining sessions are booked later from My Packages.
            </p>
          ) : null}

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
        </div>}

        {renderPriceBreakdown()}
        {!hidePolicy && renderPolicy("aside")}

        {previewError ? (
          <p className="text-xs text-rose-600 font-medium">
            Couldn&apos;t calculate your total. Please go back and try again.
          </p>
        ) : null}
        {submitError ? <p className="text-xs text-rose-600 font-medium">{submitError}</p> : null}

        {!hideContinue && <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || isSubmitting}
          className="w-full h-12 bg-[#2E9DA7] text-white font-poppins font-semibold text-base rounded-[12px] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-sm"
        >
          <span>{buttonLabel}</span>
        </button>}
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
              {selection && <BookingSelectionSummary selection={selection} />}
              {renderPriceBreakdown()}
              {!hidePolicy && renderPolicy("drawer")}
            </div>
          )}

          <div className="p-4 flex items-center justify-between gap-4">
            <button
              onClick={() => setIsMobileSummaryExpanded(!isMobileSummaryExpanded)}
              aria-expanded={isMobileSummaryExpanded}
              aria-label="Toggle booking price summary"
              className="flex flex-col items-start justify-center min-w-0 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-[#0D0D0D]">
                  {packageQuote ? formatBookingMoney(packageQuote.financials.requiredUpfrontCents) : preview ? formatBookingMoney(preview.dueNowCents) : pending}
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

            {!hideContinue && <button
              onClick={onContinue}
              disabled={!canContinue || isSubmitting}
              className="flex-1 max-w-[200px] h-12 bg-[#2E9DA7] text-white font-poppins font-semibold text-base rounded-[12px] hover:opacity-95 disabled:opacity-50 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <span>{buttonLabel}</span>
            </button>}
          </div>
        </div>
      )}
    </>
  );
}
